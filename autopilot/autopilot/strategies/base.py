"""Interface commune a toutes les strategies.

Contrat:
  plan()     decrit ce que la strategie ferait, sans rien faire
  dry_run()  simule, ecrit au Ledger en mode dry_run, ne sort jamais
  execute()  agit pour de vrai, uniquement via guardrails.gate
  report()   resume lisible de l'etat de la strategie

Une strategie n'importe jamais requests, httpx ou subprocess directement dans
execute: elle decrit une RealAction et laisse le gate decider.
"""

from __future__ import annotations

import abc
import sqlite3
from dataclasses import dataclass, field

from ..approvals.action import RealAction
from ..config import Config
from ..ledger.ledger import Ledger
from .manifest import Manifest


@dataclass
class Context:
    conn: sqlite3.Connection
    cfg: Config
    ledger: Ledger
    day: str | None = None

    def mode(self, strategy: str) -> str:
        scfg = self.cfg.strategies.get(strategy)
        return scfg.mode if scfg else "dry_run"


@dataclass
class Step:
    label: str
    cost: float = 0.0
    external: bool = False
    note: str = ""


@dataclass
class Plan:
    strategy: str
    steps: list[Step] = field(default_factory=list)
    estimated_cost: float = 0.0
    estimated_revenue: float = 0.0
    notes: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "strategy": self.strategy,
            "estimated_cost": round(self.estimated_cost, 2),
            "estimated_revenue": round(self.estimated_revenue, 2),
            "steps": [
                {"label": s.label, "cost": s.cost, "external": s.external, "note": s.note}
                for s in self.steps
            ],
            "notes": list(self.notes),
        }


@dataclass
class RunResult:
    strategy: str
    mode: str
    revenue: float = 0.0
    cost: float = 0.0
    actions_taken: list[str] = field(default_factory=list)
    actions_blocked: list[str] = field(default_factory=list)
    pending_approvals: list[int] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    @property
    def margin(self) -> float:
        return round(self.revenue - self.cost, 2)

    def as_dict(self) -> dict:
        return {
            "strategy": self.strategy,
            "mode": self.mode,
            "revenue": round(self.revenue, 2),
            "cost": round(self.cost, 2),
            "margin": self.margin,
            "actions_taken": list(self.actions_taken),
            "actions_blocked": list(self.actions_blocked),
            "pending_approvals": list(self.pending_approvals),
            "notes": list(self.notes),
        }


class Strategy(abc.ABC):
    manifest: Manifest

    @property
    def name(self) -> str:
        return self.manifest.name

    @abc.abstractmethod
    def plan(self, ctx: Context) -> Plan:
        ...

    @abc.abstractmethod
    def dry_run(self, ctx: Context) -> RunResult:
        ...

    @abc.abstractmethod
    def execute(self, ctx: Context) -> RunResult:
        ...

    @abc.abstractmethod
    def report(self, ctx: Context) -> str:
        ...

    # utilitaire partage: demande d'autorisation au gate
    def request(self, ctx: Context, action: RealAction, *, approval_id: int | None = None):
        from ..guardrails import gate

        return gate.authorize(ctx.conn, ctx.cfg, action, approval_id=approval_id)
