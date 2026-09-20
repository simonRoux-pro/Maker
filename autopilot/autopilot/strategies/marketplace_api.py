"""Socle commun aux APIs vendues par abonnement sur une marketplace.

Les deux premieres strategies faisaient la meme chose a l'identique: modeliser
un revenu, decrire un deploiement, decrire une publication de fiche, et dire
ce qui reste a faire a la main. Ce socle porte cette mecanique une seule fois.

Une strategie concrete n'a plus qu'a declarer son manifeste, son dossier de
produit, ses hypotheses de revenu et ses paliers tarifaires.

Rien ici ne sort vers l'exterieur: toute action reelle passe par le gate.
"""

from __future__ import annotations

from datetime import date

from ..approvals.action import RealAction
from .base import Context, Plan, RunResult, Step, Strategy

# Hypotheses par defaut, volontairement basses. Une fiche dans une niche
# francaise ne recoit pas un trafic de masse.
DEFAULT_ASSUMPTIONS = {
    "listing_views_per_month": 400,      # visites de la fiche
    "free_signup_rate": 0.04,            # vers le palier gratuit
    "paid_conversion_rate": 0.05,        # du gratuit vers un palier payant
    "monthly_churn": 0.15,               # clients perdus chaque mois
    "arpu_eur": 11.0,                    # panier moyen mensuel
    "marketplace_fee_rate": 0.25,        # commission de la marketplace
    "payout_fee_rate": 0.02,             # frais de versement PayPal
    "hosting_cost_eur": 0.0,             # palier gratuit Cloudflare Workers
}


def project(months: int = 12, assumptions: dict | None = None) -> list[dict]:
    """Projection mois par mois, avec churn. Deterministe, pas d'alea."""
    a = {**DEFAULT_ASSUMPTIONS, **(assumptions or {})}
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


class MarketplaceApiStrategy(Strategy):
    """A completer par une sous-classe: manifest, product_dir, tiers."""

    product_dir: str = ""
    assumptions: dict = DEFAULT_ASSUMPTIONS
    tiers: list[dict] = []

    # ------------------------------------------------------------- etat reel

    def _options(self, ctx: Context) -> dict:
        scfg = ctx.cfg.strategies.get(self.name)
        return dict(scfg.options) if scfg else {}

    def deployed(self, ctx: Context) -> str | None:
        """URL de l'API si elle est en ligne, sinon None."""
        return self._options(ctx).get("base_url") or None

    def listed(self, ctx: Context) -> str | None:
        return self._options(ctx).get("listing_url") or None

    def project(self, months: int = 12) -> list[dict]:
        return project(months, self.assumptions)

    def operator_tasks(self, ctx: Context) -> list[str]:
        tasks = []
        if not self.deployed(ctx):
            tasks.append(self.manifest.needs_operator[0])
        if not self.listed(ctx):
            tasks += list(self.manifest.needs_operator[1:])
        elif not self._options(ctx).get("proxy_secret_set"):
            tasks.append(
                "poser le secret RAPIDAPI_PROXY_SECRET sur le worker, sans quoi "
                "l'API est appelable hors facturation"
            )
        return tasks

    # ------------------------------------------------------------- interface

    def _day(self, ctx: Context) -> str:
        return ctx.day or date.today().isoformat()

    def plan(self, ctx: Context) -> Plan:
        first = self.project(1)[0]
        base_url = self.deployed(ctx)
        steps = []
        if base_url:
            steps.append(Step("API deployee et en ligne", note=f"{base_url}, cout 0 EUR"))
        else:
            steps.append(
                Step(
                    "deployer le worker sur Cloudflare, plan gratuit",
                    external=True,
                    note="demande un compte Cloudflare, sans carte bancaire",
                )
            )
        if self.listed(ctx):
            steps.append(Step("fiche publiee", note=self.listed(ctx)))
        else:
            steps.append(
                Step(
                    "publier la fiche et les paliers tarifaires sur la marketplace",
                    external=True,
                    note="demande un compte fournisseur a ton nom",
                )
            )
        steps.append(
            Step(
                "relever les appels et les abonnements chaque cycle",
                note="remplace les hypotheses par des mesures",
            )
        )
        return Plan(
            strategy=self.name,
            steps=steps,
            estimated_cost=self.assumptions["hosting_cost_eur"],
            estimated_revenue=first["net"],
            notes=[
                f"produit pret et teste dans {self.product_dir}",
                f"en ligne: {base_url}" if base_url else "pas encore deployee",
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
        rows = self.project(12)
        first, last = rows[0], rows[-1]
        result = RunResult(strategy=self.name, mode="dry_run")

        # apply_paypal_fee=False: l'argent ne vient pas d'un encaissement PayPal
        # direct mais d'un versement de la marketplace. Les vrais frais sont la
        # commission et le frais de versement, enregistres a la main.
        ctx.ledger.record_revenue(
            self.name, first["gross"], mode="dry_run", category="subscription",
            note="abonnements modelises du premier mois", day=day,
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
                self.name, first["hosting"], mode="dry_run", category="hosting", day=day,
            )

        result.revenue = first["gross"]
        result.cost = round(first["marketplace_fee"] + first["payout_fee"] + first["hosting"], 2)
        result.actions_taken.append("modele du premier mois ecrit au Ledger en simulation")
        a = self.assumptions
        result.notes += [
            f"hypothese: {a['listing_views_per_month']} visites de fiche par mois, "
            f"{a['free_signup_rate'] * 100:.0f} pourcent d'inscriptions, "
            f"{a['paid_conversion_rate'] * 100:.0f} pourcent de conversion payante",
            f"mois 1: {first['customers']:.2f} client, net {first['net']:.2f} EUR",
            f"mois 12 si les hypotheses tiennent: {last['customers']:.2f} clients, "
            f"net {last['net']:.2f} EUR par mois",
            "infrastructure a zero euro sur le palier gratuit, donc pas de point mort",
            "chiffres a remplacer par des mesures des le premier appel reel",
        ]
        return result

    def execute(self, ctx: Context) -> RunResult:
        """Decrit les actions reelles restantes. Aucune ne part sans passer
        par le gate, et aucune n'est proposee si elle est deja faite."""
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
                        "repertoire_racine": self.product_dir,
                        "fichier_a_coller": f"{self.product_dir}/dist/worker.bundle.mjs",
                        "commande_de_deploiement": (
                            'echo "$RAPIDAPI_PROXY_SECRET" | npx wrangler secret put '
                            "RAPIDAPI_PROXY_SECRET && npx wrangler deploy"
                        ),
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
                        "openapi": f"{self.deployed(ctx) or ''}/openapi.json?download=1",
                        "paliers": self.tiers,
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
        from ..ledger.queries import margin_by_strategy

        base_url = self.deployed(ctx)
        lines = [f"{self.name}: {self.manifest.summary}"]
        lines.append(f"  API: {base_url}" if base_url else "  API: pas encore deployee")
        lines.append(f"  fiche: {self.listed(ctx) or 'pas encore publiee'}")
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
