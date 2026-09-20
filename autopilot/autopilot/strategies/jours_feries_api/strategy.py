"""Vente d'une API par abonnement sur une marketplace d'APIs.

Le produit est dans products/jours_feries_api: pur calcul, aucune dependance
externe, 57 tests. Il tourne sur le plan gratuit de Cloudflare Workers, donc
le cout d'infrastructure est nul jusqu'a 100 000 requetes par jour.

Ce module ne vend rien tout seul. Il modelise le revenu attendu, il mesure le
revenu reel quand il y en aura, et il decrit les deux actions reelles qui
restent bloquees tant que les comptes n'existent pas.

Le modele ci-dessous est une hypothese, pas une prevision. Il est ecrit pour
etre faux et recalibre: des que le premier chiffre reel arrive, on remplace les
hypotheses par des mesures.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

from ...approvals.action import RealAction
from ..base import Context, Plan, RunResult, Step, Strategy
from ..manifest import Manifest

MANIFEST = Manifest.load(Path(__file__).with_name("manifest.toml"))

PRODUCT_DIR = "products/jours_feries_api"

# Hypotheses de depart, volontairement basses. Une fiche sur une marketplace
# d'APIs dans une niche francaise ne recoit pas un trafic de masse.
ASSUMPTIONS = {
    "listing_views_per_month": 400,      # visites de la fiche
    "free_signup_rate": 0.04,            # vers le palier gratuit
    "paid_conversion_rate": 0.05,        # du gratuit vers un palier payant
    "monthly_churn": 0.15,               # clients perdus chaque mois
    "arpu_eur": 11.0,                    # panier moyen mensuel, net de change
    "marketplace_fee_rate": 0.25,        # commission de la marketplace
    "payout_fee_rate": 0.02,             # frais de versement PayPal
    "hosting_cost_eur": 0.0,             # palier gratuit Cloudflare Workers
}


def project(months: int = 12, assumptions: dict | None = None) -> list[dict]:
    """Projection mois par mois, avec churn. Deterministe, pas d'alea."""
    a = {**ASSUMPTIONS, **(assumptions or {})}
    new_paid = (
        a["listing_views_per_month"] * a["free_signup_rate"] * a["paid_conversion_rate"]
    )
    customers = 0.0
    rows = []
    for month in range(1, months + 1):
        customers = customers * (1 - a["monthly_churn"]) + new_paid
        # les montants sont arrondis au centime avant d'etre soustraits, sinon
        # le net affiche ne correspond pas a la somme des lignes du Ledger
        gross = round(customers * a["arpu_eur"], 2)
        marketplace = round(gross * a["marketplace_fee_rate"], 2)
        payout = round((gross - marketplace) * a["payout_fee_rate"], 2)
        hosting = round(a["hosting_cost_eur"], 2)
        rows.append(
            {
                "month": month,
                "customers": round(customers, 2),
                "gross": gross,
                "marketplace_fee": marketplace,
                "payout_fee": payout,
                "hosting": hosting,
                "net": round(gross - marketplace - payout - hosting, 2),
            }
        )
    return rows


class JoursFeriesApi(Strategy):
    manifest = MANIFEST

    def _day(self, ctx: Context) -> str:
        return ctx.day or date.today().isoformat()

    def _options(self, ctx: Context) -> dict:
        scfg = ctx.cfg.strategies.get(self.name)
        return dict(scfg.options) if scfg else {}

    def deployed(self, ctx: Context) -> str | None:
        """URL de l'API si elle est en ligne, sinon None."""
        return self._options(ctx).get("base_url") or None

    def listed(self, ctx: Context) -> str | None:
        return self._options(ctx).get("listing_url") or None

    def operator_tasks(self, ctx: Context) -> list[str]:
        tasks = []
        if not self.deployed(ctx):
            tasks.append(self.manifest.needs_operator[0])
        if not self.listed(ctx):
            tasks.append(self.manifest.needs_operator[1])
            tasks.append(self.manifest.needs_operator[2])
        elif not self._options(ctx).get("proxy_secret_set"):
            tasks.append(
                "poser le secret RAPIDAPI_PROXY_SECRET sur le worker, sans quoi "
                "l'API est appelable hors facturation"
            )
        return tasks

    def plan(self, ctx: Context) -> Plan:
        first = project(1)[0]
        base_url = self.deployed(ctx)
        steps = []
        if base_url:
            steps.append(
                Step("API deployee et en ligne", note=f"{base_url}, cout 0 EUR")
            )
        else:
            steps.append(
                Step(
                    "deployer le worker sur Cloudflare, plan gratuit",
                    external=True,
                    note="demande un compte Cloudflare, sans carte bancaire",
                )
            )
        steps += [
            Step(
                "publier la fiche et les paliers tarifaires sur la marketplace",
                external=True,
                note="demande un compte fournisseur a ton nom",
            ),
            Step(
                "poser le secret de proxy pour fermer l'acces direct",
                external=True,
                note="la marketplace fournit sa valeur, donc apres la fiche",
            ),
            Step(
                "relever les appels et les abonnements chaque cycle",
                note="remplace les hypotheses par des mesures",
            ),
        ]
        return Plan(
            strategy=self.name,
            steps=steps,
            estimated_cost=ASSUMPTIONS["hosting_cost_eur"],
            estimated_revenue=first["net"],
            notes=[
                f"produit pret et teste dans {PRODUCT_DIR}",
                f"en ligne: {base_url}" if base_url else "pas encore deployee",
                "revenu nul tant que la fiche n'est pas publiee",
                "commission marketplace 25 pourcent, frais de versement 2 pourcent",
                "les versements arrivent avec environ deux mois de decalage",
            ],
        )

    def dry_run(self, ctx: Context) -> RunResult:
        """Enregistre le premier mois modelise, pas la projection entiere.

        Mettre douze mois de projection dans le Ledger donnerait une courbe
        flatteuse et fausse. On n'ecrit que ce que le mois en cours produirait.
        """
        day = self._day(ctx)
        rows = project(12)
        first, last = rows[0], rows[-1]
        result = RunResult(strategy=self.name, mode="dry_run")

        # apply_paypal_fee=False: ici l'argent ne vient pas d'un encaissement
        # PayPal direct mais d'un versement de la marketplace. Les vrais frais
        # sont la commission et le frais de versement, enregistres a la main.
        ctx.ledger.record_revenue(
            self.name,
            first["gross"],
            mode="dry_run",
            category="subscription",
            note="abonnements modelises du premier mois",
            day=day,
            apply_paypal_fee=False,
        )
        ctx.ledger.record_cost(
            self.name, first["marketplace_fee"], mode="dry_run",
            category="marketplace_fee", note="commission 25 pourcent", day=day,
        )
        ctx.ledger.record_cost(
            self.name, first["payout_fee"], mode="dry_run",
            category="paypal_payout_fee", note="frais de versement 2 pourcent", day=day,
        )
        if first["hosting"] > 0:
            ctx.ledger.record_cost(
                self.name, first["hosting"], mode="dry_run",
                category="hosting", day=day,
            )

        result.revenue = first["gross"]
        result.cost = round(first["marketplace_fee"] + first["payout_fee"] + first["hosting"], 2)
        result.actions_taken.append("modele du premier mois ecrit au Ledger en simulation")
        result.notes += [
            f"hypothese: {ASSUMPTIONS['listing_views_per_month']} visites de fiche par mois, "
            f"{ASSUMPTIONS['free_signup_rate'] * 100:.0f} pourcent d'inscriptions, "
            f"{ASSUMPTIONS['paid_conversion_rate'] * 100:.0f} pourcent de conversion payante",
            f"mois 1: {first['customers']:.2f} client, net {first['net']:.2f} EUR",
            f"mois 12 si les hypotheses tiennent: {last['customers']:.2f} clients, "
            f"net {last['net']:.2f} EUR par mois",
            "infrastructure a zero euro sur le palier gratuit, donc pas de point mort a atteindre",
            "chiffres a remplacer par des mesures des le premier appel reel",
        ]
        return result

    def execute(self, ctx: Context) -> RunResult:
        """Decrit les deux actions reelles. Aucune ne part sans validation, et
        les deux resteront refusees tant que les plateformes ne sont pas dans
        la liste blanche."""
        result = RunResult(strategy=self.name, mode="live")

        actions = []
        if not self.deployed(ctx):
            actions.append(
                RealAction(
                    strategy=self.name,
                    kind="publish",
                    summary="deployer l'API sur Cloudflare Workers, plan gratuit",
                    api="cloudflare-workers",
                    estimated_cost=0.0,
                    risk="low",
                    payload={
                        "marche_a_suivre": f"{PRODUCT_DIR}/DEPLOIEMENT.md",
                        "fichier_a_coller": f"{PRODUCT_DIR}/dist/worker.bundle.mjs",
                        "ou_en_ligne_de_commande": "npx wrangler deploy",
                    },
                )
            )
        if not self.listed(ctx):
            actions.append(
                RealAction(
                    strategy=self.name,
                    kind="publish",
                    summary="publier la fiche et les paliers tarifaires sur la marketplace",
                    platform="rapidapi",
                    estimated_cost=0.0,
                    risk="medium",
                    payload={
                        "base_url": self.deployed(ctx),
                        "paliers": [
                            {"nom": "Basic", "prix_eur": 0.0, "quota_mensuel": 500},
                            {"nom": "Pro", "prix_eur": 9.0, "quota_mensuel": 20000},
                            {"nom": "Ultra", "prix_eur": 29.0, "quota_mensuel": 200000},
                        ],
                        "textes": f"{PRODUCT_DIR}/DEPLOIEMENT.md",
                    },
                )
            )

        if not actions:
            result.notes.append(
                "rien a publier: l'API est en ligne et la fiche existe. "
                "La strategie n'attend plus que des chiffres reels."
            )

        for action in actions:
            decision = self.request(ctx, action)
            if decision.allowed:
                result.actions_taken.append(action.describe())
            else:
                result.actions_blocked.append(f"{action.describe()} refuse: {decision.reason}")
                if decision.queued and decision.approval_id:
                    result.pending_approvals.append(decision.approval_id)
        return result

    def report(self, ctx: Context) -> str:
        from ...ledger.queries import margin_by_strategy

        base_url = self.deployed(ctx)
        lines = [f"{self.name}: {self.manifest.summary}"]
        lines.append(f"  API: {base_url}" if base_url else "  API: pas encore deployee")
        for mode in ("live", "dry_run"):
            rows = [r for r in margin_by_strategy(ctx.conn, mode) if r["strategy"] == self.name]
            if rows:
                r = rows[0]
                lines.append(
                    f"  {mode}: revenus {r['revenue']} EUR, couts {r['cost']} EUR, "
                    f"marge {r['margin']} EUR"
                )
            else:
                lines.append(f"  {mode}: aucune ecriture")
        for need in self.operator_tasks(ctx):
            lines.append(f"  demande Simon: {need}")
        return "\n".join(lines)


STRATEGY = JoursFeriesApi
