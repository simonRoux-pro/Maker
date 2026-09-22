"""Lecture du Ledger et verdict par strategie.

Regle: on ne juge une strategie que sur le reel. Le dry-run sert a decider si
on l'active, pas a se raconter des histoires sur sa rentabilite.
"""

from __future__ import annotations

import sqlite3

from ..config import Config
from ..ledger.queries import cumulative_margin, margin_by_strategy

KEEP = "garder"
SCALE = "augmenter"
KILL = "tuer"
WATCH = "observer"
PROMOTE = "passer en live"


def analyze(
    conn: sqlite3.Connection,
    cfg: Config,
    test_only: frozenset[str] = frozenset(),
    support: frozenset[str] = frozenset(),
    ceilings: dict[str, float | None] | None = None,
) -> dict:
    live = margin_by_strategy(conn, "live")
    dry = {r["strategy"]: r for r in margin_by_strategy(conn, "dry_run")}
    verdicts = []

    known = set(cfg.strategies) | {r["strategy"] for r in live} | set(dry)
    for name in sorted(known):
        scfg = cfg.strategies.get(name)
        live_row = next((r for r in live if r["strategy"] == name), None)
        dry_row = dry.get(name)
        verdict, why = _verdict(
            scfg,
            live_row,
            dry_row,
            name in test_only,
            name in support,
            (ceilings or {}).get(name),
            cfg.guardrails.min_monthly_margin,
        )
        verdicts.append(
            {
                "strategy": name,
                "mode": scfg.mode if scfg else "absente de la configuration",
                "enabled": bool(scfg and scfg.enabled),
                "live": live_row or {"revenue": 0.0, "cost": 0.0, "margin": 0.0},
                "dry_run": dry_row or {"revenue": 0.0, "cost": 0.0, "margin": 0.0},
                "verdict": verdict,
                "why": why,
            }
        )

    return {
        "totals": {
            "live": cumulative_margin(conn, "live"),
            "dry_run": cumulative_margin(conn, "dry_run"),
        },
        "strategies": verdicts,
    }


def _verdict(
    scfg,
    live_row,
    dry_row,
    test_only: bool = False,
    support: bool = False,
    ceiling: float | None = None,
    minimum: float = 0.0,
) -> tuple[str, str]:
    if scfg is None:
        return KILL, "plus aucune configuration, code orphelin"
    if not scfg.enabled:
        return KILL, "desactivee"
    if test_only:
        return WATCH, "strategie de validation, jamais promue en reel"
    if support:
        return (
            WATCH,
            "brique de distribution: elle n'a pas de revenu propre, "
            "son effet se lit sur les autres strategies",
        )

    # Le plafond est ce que le modele donne au mieux, pas une etape. Une
    # strategie qui ne peut pas atteindre le minimum ne le pourra jamais en
    # l'etat: il faut changer ses hypotheses ou l'abandonner.
    if minimum > 0 and ceiling is not None and ceiling < minimum:
        return (
            KILL,
            f"plafond du modele {ceiling:.2f} EUR par mois, sous le minimum "
            f"de {minimum:.2f} EUR",
        )

    if live_row and (live_row["revenue"] or live_row["cost"]):
        margin = live_row["margin"]
        if margin > 0:
            return SCALE, f"marge reelle positive: {margin} EUR"
        if margin < 0:
            return KILL, f"marge reelle negative: {margin} EUR"
        return WATCH, "activite reelle a marge nulle"

    if scfg.mode == "dry_run":
        if dry_row and dry_row["margin"] > 0:
            return (
                PROMOTE,
                f"simulation positive: {dry_row['margin']} EUR, reste a valider en reel",
            )
        if dry_row and dry_row["margin"] <= 0:
            return KILL, f"simulation non rentable: {dry_row['margin']} EUR"
        return WATCH, "aucune donnee, simulation a lancer"

    return WATCH, "activee en live mais aucun mouvement enregistre"
