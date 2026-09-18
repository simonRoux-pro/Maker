"""Point de passage unique de toute action reelle.

Une strategie n'appelle jamais le reseau et ne depense jamais directement:
elle decrit une RealAction et demande l'autorisation ici. L'ordre de controle
est volontairement rigide:

  1. kill switch
  2. strategie activee et en mode live
  3. liste blanche plateforme / api
  4. plafonds de budget
  5. politique d'approbation

Tout resultat est trace dans le journal d'audit.
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass

from .. import approvals as approvals_mod
from ..approvals.action import RealAction
from ..audit import log
from ..config import Config
from . import allowlist, budget, killswitch


@dataclass(frozen=True)
class Decision:
    allowed: bool
    reason: str
    approval_id: int | None = None
    queued: bool = False

    def __bool__(self) -> bool:
        return self.allowed


def authorize(conn: sqlite3.Connection, cfg: Config, action: RealAction,
              *, approval_id: int | None = None) -> Decision:
    """Autorise ou refuse une action reelle.

    approval_id: identifiant d'une approbation deja validee par l'operateur.
    Il ne dispense d'aucun autre controle, il ne leve que l'exigence de
    validation manuelle.
    """
    g = cfg.guardrails

    kill_reason = killswitch.reason(conn, g)
    if kill_reason:
        return _deny(action, f"kill switch: {kill_reason}")

    scfg = cfg.strategies.get(action.strategy)
    if scfg is None:
        return _deny(action, f"strategie inconnue dans la configuration: {action.strategy}")
    if not scfg.enabled:
        return _deny(action, f"strategie desactivee: {action.strategy}")
    if not scfg.is_live:
        return _deny(action, f"strategie en mode {scfg.mode}, aucune action reelle")

    deny = allowlist.check(g, platform=action.platform, api=action.api)
    if deny:
        return _deny(action, deny)

    deny = budget.check(conn, cfg, strategy=action.strategy, cost=action.estimated_cost)
    if deny:
        return _deny(action, deny)

    if approval_id is not None:
        record = approvals_mod.get(conn, approval_id)
        if record is None:
            return _deny(action, f"approbation inconnue: {approval_id}")
        if record["status"] != "approved":
            return _deny(
                action,
                f"approbation {approval_id} non validee (statut {record['status']})",
            )
        if record["strategy"] != action.strategy:
            return _deny(action, f"approbation {approval_id} liee a une autre strategie")
        if round(action.estimated_cost, 2) > round(record["estimated_cost"], 2) + 1e-9:
            return _deny(
                action,
                f"cout {action.estimated_cost} superieur au cout valide "
                f"{record['estimated_cost']}",
            )
        log("gate.allow", strategy=action.strategy, approval_id=approval_id,
            summary=action.summary)
        return Decision(True, "approbation validee", approval_id=approval_id)

    zero_cost = action.estimated_cost <= 0
    if zero_cost and g.approval.auto_approve_zero_cost and action.kind == "api_call":
        log("gate.allow", strategy=action.strategy, summary=action.summary,
            reason="cout nul, autorisation permanente")
        return Decision(True, "cout nul sur plateforme autorisee")

    queued_id = approvals_mod.create(conn, action)
    log("gate.queued", strategy=action.strategy, approval_id=queued_id,
        summary=action.summary, estimated_cost=action.estimated_cost)
    return Decision(
        False,
        f"validation manuelle requise, approbation #{queued_id}",
        approval_id=queued_id,
        queued=True,
    )


def _deny(action: RealAction, reason: str) -> Decision:
    strategy = getattr(action, "strategy", "?")
    summary = getattr(action, "summary", "?")
    log("gate.deny", strategy=strategy, summary=summary, reason=reason)
    return Decision(False, reason)
