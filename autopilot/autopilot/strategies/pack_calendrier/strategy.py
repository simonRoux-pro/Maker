"""Vente d'un produit numerique telechargeable, a versement immediat.

Modele different des APIs: vente a l'unite au lieu d'un abonnement, et surtout
l'argent arrive sur le PayPal des la transaction, au lieu d'environ deux mois
apres sur une marketplace d'APIs. C'est la seule raison d'etre de cette
strategie: raccourcir la boucle de mesure. Si elle ne vend rien, on le saura
en jours plutot qu'en trimestres.

Les frais sont differents eux aussi: commission de plateforme sur le prix, et
frais PayPal d'encaissement direct, qui existent ici alors qu'un versement de
marketplace n'en supporte pas.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

from ...approvals.action import RealAction
from ..base import Context, Plan, RunResult, Step, Strategy, traffic_needed
from ..manifest import Manifest

MANIFEST = Manifest.load(Path(__file__).with_name("manifest.toml"))

PRODUCT_DIR = "products/pack_calendrier"

ASSUMPTIONS = {
    "page_views_per_month": 300,     # visites de la fiche produit
    "conversion_rate": 0.012,        # un acheteur pour environ 80 visites
    "price_eur": 9.0,
    "platform_fee_rate": 0.05,       # commission du palier gratuit
    "refund_rate": 0.03,             # remboursements sur produit numerique
}


def project(months: int = 12, assumptions: dict | None = None, fees=None) -> list[dict]:
    """Projection mensuelle. Une vente ne se reporte pas d'un mois sur l'autre:
    pas de churn ici, mais pas de cumul non plus."""
    a = {**ASSUMPTIONS, **(assumptions or {})}
    rows = []
    for month in range(1, months + 1):
        units = a["page_views_per_month"] * a["conversion_rate"] * (1 - a["refund_rate"])
        gross = round(units * a["price_eur"], 2)
        platform = round(gross * a["platform_fee_rate"], 2)
        paypal = round(fees.paypal_fee(gross), 2) if fees and gross > 0 else 0.0
        rows.append(
            {
                "month": month,
                "units": round(units, 2),
                "gross": gross,
                "platform_fee": platform,
                "paypal_fee": paypal,
                "net": round(gross - platform - paypal, 2),
            }
        )
    return rows


class PackCalendrier(Strategy):
    manifest = MANIFEST

    def _options(self, ctx: Context) -> dict:
        scfg = ctx.cfg.strategies.get(self.name)
        return dict(scfg.options) if scfg else {}

    def listed(self, ctx: Context) -> str | None:
        return self._options(ctx).get("listing_url") or None

    def operator_tasks(self, ctx: Context) -> list[str]:
        return [] if self.listed(ctx) else list(self.manifest.needs_operator)

    def project(self, months: int = 12, ctx: Context | None = None) -> list[dict]:
        fees = ctx.cfg.guardrails.fees if ctx else None
        return project(months, ASSUMPTIONS, fees)

    def monthly_ceiling(self, ctx: Context | None = None) -> float:
        """Une vente ne se cumule pas d'un mois sur l'autre: le revenu mensuel
        est stable, donc le premier mois est deja le plafond."""
        return self.project(1, ctx)[0]["net"]

    def views_needed(self, target: float, ctx: Context | None = None) -> int | None:
        fees = ctx.cfg.guardrails.fees if ctx else None

        def net_for(views: int) -> float:
            return project(1, {**ASSUMPTIONS, "page_views_per_month": views}, fees)[0]["net"]

        return traffic_needed(net_for, target)

    def _viability_note(self, ctx: Context) -> str:
        seuil = ctx.cfg.guardrails.min_monthly_margin
        besoin = self.views_needed(seuil, ctx)
        if besoin is None:
            return f"le modele ne peut pas atteindre {seuil} EUR par mois, a abandonner"
        return (
            f"seuil de {seuil} EUR par mois atteint a partir de {besoin} visites "
            f"mensuelles de la fiche, contre {ASSUMPTIONS['page_views_per_month']} supposees"
        )

    def plan(self, ctx: Context) -> Plan:
        first = self.project(1, ctx)[0]
        listed = self.listed(ctx)
        steps = [
            Step(
                "generer le pack",
                note=f"node generate.mjs dans {PRODUCT_DIR}, 28 fichiers, 317 ko",
            ),
        ]
        if listed:
            steps.append(Step("fiche produit publiee", note=listed))
        else:
            steps.append(
                Step(
                    "publier la fiche et televerser le pack",
                    external=True,
                    note="demande un compte vendeur relie au PayPal",
                )
            )
        steps.append(
            Step("relever les ventes chaque cycle", note="versement immediat, mesure rapide")
        )
        return Plan(
            strategy=self.name,
            steps=steps,
            estimated_cost=0.0,
            estimated_revenue=first["net"],
            notes=[
                f"produit genere et teste dans {PRODUCT_DIR}",
                f"prix {ASSUMPTIONS['price_eur']} EUR, commission "
                f"{ASSUMPTIONS['platform_fee_rate'] * 100:.0f} pourcent",
                "l'argent arrive sur le PayPal des la transaction",
                self._viability_note(ctx),
            ],
        )

    def dry_run(self, ctx: Context) -> RunResult:
        day = ctx.day or date.today().isoformat()
        rows = self.project(12, ctx)
        first, last = rows[0], rows[-1]
        result = RunResult(strategy=self.name, mode="dry_run")

        # Meme regle que pour les APIs: pas de fiche, pas de vente, pas
        # d'ecriture. Le potentiel reste lisible dans les notes.
        if not self.listed(ctx):
            result.notes += [
                "fiche non publiee: aucune vente possible, rien d'ecrit au Ledger",
                f"si elle l'etait, avec {ASSUMPTIONS['page_views_per_month']} visites "
                f"par mois, le modele donnerait {first['net']:.2f} EUR par mois",
                "ce produit depend entierement du trafic amene par outils_web",
            ]
            return result

        # apply_paypal_fee=True: ici l'encaissement est direct, les frais
        # PayPal s'appliquent vraiment, contrairement a un versement de
        # marketplace deja net.
        ctx.ledger.record_revenue(
            self.name, first["gross"], mode="dry_run", category="sale",
            note="ventes modelisees du premier mois", day=day, apply_paypal_fee=True,
        )
        ctx.ledger.record_cost(
            self.name, first["platform_fee"], mode="dry_run",
            category="platform_fee", note="commission de la plateforme", day=day,
        )

        result.revenue = first["gross"]
        result.cost = round(first["platform_fee"] + first["paypal_fee"], 2)
        result.actions_taken.append("modele du premier mois ecrit au Ledger en simulation")
        result.notes += [
            f"hypothese: {ASSUMPTIONS['page_views_per_month']} visites par mois, "
            f"{ASSUMPTIONS['conversion_rate'] * 100:.1f} pourcent d'achat",
            f"mois 1: {first['units']:.2f} vente, net {first['net']:.2f} EUR",
            f"a trafic constant, {last['net']:.2f} EUR par mois",
            "sans trafic, ce produit ne vend rien: tout depend des pages publiques",
        ]
        return result

    def execute(self, ctx: Context) -> RunResult:
        result = RunResult(strategy=self.name, mode="live")
        if self.listed(ctx):
            result.notes.append("fiche deja publiee, la strategie attend des ventes reelles")
            return result

        action = RealAction(
            strategy=self.name,
            kind="publish",
            summary="publier le pack calendrier sur la plateforme de vente",
            platform="payhip",
            estimated_cost=0.0,
            risk="low",
            payload={
                "dossier": f"{PRODUCT_DIR}/dist",
                "prix_eur": ASSUMPTIONS["price_eur"],
                "versement": "PayPal immediat",
            },
        )
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

        lines = [f"{self.name}: {self.manifest.summary}"]
        lines.append(f"  fiche: {self.listed(ctx) or 'pas encore publiee'}")
        for mode in ("live", "dry_run"):
            rows = [r for r in margin_by_strategy(ctx.conn, mode) if r["strategy"] == self.name]
            r = rows[0] if rows else None
            lines.append(
                f"  {mode}: marge {r['margin']} EUR" if r else f"  {mode}: aucune ecriture"
            )
        for need in self.operator_tasks(ctx):
            lines.append(f"  demande Simon: {need}")
        return "\n".join(lines)


STRATEGY = PackCalendrier

__all__ = ["STRATEGY", "PackCalendrier", "project", "ASSUMPTIONS"]
