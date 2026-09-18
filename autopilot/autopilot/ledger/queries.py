"""Lectures agregees du Ledger. C'est ce que lisent le dashboard et
l'orchestrateur."""

from __future__ import annotations

import sqlite3
from datetime import date


def _margin_row(conn: sqlite3.Connection, where: str, params: tuple) -> dict:
    row = conn.execute(
        "SELECT "
        " COALESCE(SUM(CASE WHEN kind = 'revenue' THEN amount END), 0) AS revenue, "
        " COALESCE(SUM(CASE WHEN kind = 'cost' THEN amount END), 0) AS cost "
        f"FROM entries WHERE {where}",
        params,
    ).fetchone()
    revenue = round(row["revenue"], 2)
    cost = round(row["cost"], 2)
    return {"revenue": revenue, "cost": cost, "margin": round(revenue - cost, 2)}


def cumulative_margin(conn: sqlite3.Connection, mode: str = "live") -> dict:
    return _margin_row(conn, "mode = ?", (mode,))


def margin_by_strategy(conn: sqlite3.Connection, mode: str = "live") -> list[dict]:
    rows = conn.execute(
        "SELECT strategy, "
        " COALESCE(SUM(CASE WHEN kind = 'revenue' THEN amount END), 0) AS revenue, "
        " COALESCE(SUM(CASE WHEN kind = 'cost' THEN amount END), 0) AS cost "
        "FROM entries WHERE mode = ? GROUP BY strategy ORDER BY 2 - 3 DESC",
        (mode,),
    ).fetchall()
    out = []
    for r in rows:
        revenue = round(r["revenue"], 2)
        cost = round(r["cost"], 2)
        out.append(
            {
                "strategy": r["strategy"],
                "revenue": revenue,
                "cost": cost,
                "margin": round(revenue - cost, 2),
            }
        )
    out.sort(key=lambda d: d["margin"], reverse=True)
    return out


def daily_series(conn: sqlite3.Connection, mode: str = "live") -> list[dict]:
    """Marge par jour et marge cumulee, dans l'ordre chronologique."""
    rows = conn.execute(
        "SELECT day, "
        " COALESCE(SUM(CASE WHEN kind = 'revenue' THEN amount END), 0) AS revenue, "
        " COALESCE(SUM(CASE WHEN kind = 'cost' THEN amount END), 0) AS cost "
        "FROM entries WHERE mode = ? GROUP BY day ORDER BY day",
        (mode,),
    ).fetchall()
    series = []
    running = 0.0
    for r in rows:
        margin = round(r["revenue"] - r["cost"], 2)
        running = round(running + margin, 2)
        series.append(
            {
                "day": r["day"],
                "revenue": round(r["revenue"], 2),
                "cost": round(r["cost"], 2),
                "margin": margin,
                "cumulative": running,
            }
        )
    return series


def spent_total(conn: sqlite3.Connection) -> float:
    """Depenses reelles cumulees, toutes strategies. Les frais PayPal comptent."""
    row = conn.execute(
        "SELECT COALESCE(SUM(amount), 0) AS s FROM entries "
        "WHERE mode = 'live' AND kind = 'cost'"
    ).fetchone()
    return round(row["s"], 2)


def spent_total_strategy(conn: sqlite3.Connection, strategy: str) -> float:
    row = conn.execute(
        "SELECT COALESCE(SUM(amount), 0) AS s FROM entries "
        "WHERE mode = 'live' AND kind = 'cost' AND strategy = ?",
        (strategy,),
    ).fetchone()
    return round(row["s"], 2)


def spent_today(conn: sqlite3.Connection, day: str | None = None) -> float:
    row = conn.execute(
        "SELECT COALESCE(SUM(amount), 0) AS s FROM entries "
        "WHERE mode = 'live' AND kind = 'cost' AND day = ?",
        (day or date.today().isoformat(),),
    ).fetchone()
    return round(row["s"], 2)
