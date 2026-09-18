"""hello_revenue: aucune valeur economique, valeur de test totale.

Elle produit des chiffres deterministes a partir de la date, pour que deux
cycles le meme jour donnent le meme resultat et que la boucle soit verifiable.
Elle tente aussi une action reelle a chaque execute, ce qui sert de test vivant
des garde-fous: tant que la liste blanche est vide, elle doit etre refusee.
"""

from __future__ import annotations

import hashlib
from datetime import date
from pathlib import Path

from ...approvals.action import RealAction
from ..base import Context, Plan, RunResult, Step, Strategy
from ..manifest import Manifest

MANIFEST = Manifest.load(Path(__file__).with_name("manifest.toml"))


def _seeded(day: str, salt: str, low: float, high: float) -> float:
    """Valeur stable dans [low, high], derivee du jour. Pas d'alea non
    reproductible: un cycle doit pouvoir etre rejoue."""
    digest = hashlib.sha256(f"{day}:{salt}".encode()).digest()
    ratio = int.from_bytes(digest[:4], "big") / 0xFFFFFFFF
    return round(low + ratio * (high - low), 2)


class HelloRevenue(Strategy):
    manifest = MANIFEST

    def _day(self, ctx: Context) -> str:
        return ctx.day or date.today().isoformat()

    def plan(self, ctx: Context) -> Plan:
        day = self._day(ctx)
        revenue = _seeded(day, "revenue", 0.0, 12.0)
        cost = _seeded(day, "cost", 0.0, 3.0)
        return Plan(
            strategy=self.name,
            steps=[
                Step("simuler des ventes de la journee", note="aucune sortie externe"),
                Step("simuler le cout d'infrastructure", cost=cost),
                Step(
                    "tenter un appel API externe",
                    external=True,
                    note="doit etre refuse par la liste blanche",
                ),
            ],
            estimated_cost=cost,
            estimated_revenue=revenue,
            notes=[
                "strategie de validation, ne genere aucun revenu reel",
            ],
        )

    def dry_run(self, ctx: Context) -> RunResult:
        day = self._day(ctx)
        plan = self.plan(ctx)
        result = RunResult(strategy=self.name, mode="dry_run")

        ctx.ledger.record_revenue(
            self.name, plan.estimated_revenue, mode="dry_run",
            category="sale", note="vente simulee", day=day,
        )
        ctx.ledger.record_cost(
            self.name, plan.estimated_cost, mode="dry_run",
            category="hosting", note="cout simule", day=day,
        )
        fees = ctx.cfg.guardrails.fees.paypal_fee(plan.estimated_revenue)
        result.revenue = plan.estimated_revenue
        result.cost = round(plan.estimated_cost + fees, 2)
        result.actions_taken.append("ecritures simulees au Ledger")
        result.notes.append(f"frais PayPal simules: {fees} EUR")
        return result

    def execute(self, ctx: Context) -> RunResult:
        """Ne fait rien de reel par construction, mais demande l'autorisation
        comme une vraie strategie, pour verifier que le gate repond bien."""
        result = RunResult(strategy=self.name, mode="live")
        action = RealAction(
            strategy=self.name,
            kind="api_call",
            summary="ping d'une API de demonstration",
            api="example.invalid",
            estimated_cost=0.0,
            risk="low",
            payload={"endpoint": "https://example.invalid/ping"},
        )
        decision = self.request(ctx, action)
        if decision.allowed:
            result.actions_taken.append(action.describe())
            result.notes.append("le gate a autorise, aucun appel reel n'est fait ici")
        else:
            result.actions_blocked.append(f"{action.describe()} refuse: {decision.reason}")
            if decision.approval_id and decision.queued:
                result.pending_approvals.append(decision.approval_id)
        return result

    def report(self, ctx: Context) -> str:
        from ...ledger.queries import margin_by_strategy

        lines = [f"{self.name}: {self.manifest.summary}"]
        for mode in ("dry_run", "live"):
            rows = [r for r in margin_by_strategy(ctx.conn, mode) if r["strategy"] == self.name]
            if rows:
                r = rows[0]
                lines.append(
                    f"  {mode}: revenus {r['revenue']} EUR, couts {r['cost']} EUR, "
                    f"marge {r['margin']} EUR"
                )
            else:
                lines.append(f"  {mode}: aucune ecriture")
        return "\n".join(lines)


STRATEGY = HelloRevenue
