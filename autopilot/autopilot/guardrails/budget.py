"""Plafonds de depense. Calcules sur le reel enregistre au Ledger, pas sur une
estimation interne."""

from __future__ import annotations

import sqlite3

from ..config import Config
from ..ledger.queries import spent_today, spent_total, spent_total_strategy


def check(conn: sqlite3.Connection, cfg: Config, *, strategy: str, cost: float) -> str | None:
    """Retourne un motif de refus, ou None si la depense tient dans les plafonds."""
    if cost <= 0:
        return None
    b = cfg.guardrails.budget

    total_after = round(spent_total(conn) + cost, 2)
    if total_after > b.max_total:
        return f"budget total depasse: {total_after} > {b.max_total}"

    day_after = round(spent_today(conn) + cost, 2)
    if day_after > b.max_daily:
        return f"plafond journalier depasse: {day_after} > {b.max_daily}"

    strat_after = round(spent_total_strategy(conn, strategy) + cost, 2)
    if strat_after > b.max_per_strategy:
        return f"budget de strategie depasse: {strat_after} > {b.max_per_strategy}"

    scfg = cfg.strategies.get(strategy)
    if scfg is not None and strat_after > scfg.budget:
        return f"budget alloue a {strategy} depasse: {strat_after} > {scfg.budget}"

    return None


def remaining(conn: sqlite3.Connection, cfg: Config, strategy: str | None = None) -> dict:
    b = cfg.guardrails.budget
    out = {
        "total": round(b.max_total - spent_total(conn), 2),
        "today": round(b.max_daily - spent_today(conn), 2),
    }
    if strategy:
        out["strategy"] = round(b.max_per_strategy - spent_total_strategy(conn, strategy), 2)
    return out
