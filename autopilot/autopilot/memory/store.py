"""Etat persistant de l'agent entre les cycles."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from ..paths import memory_db

SCHEMA = Path(__file__).with_name("schema.sql")


def connect(path: Path | None = None) -> sqlite3.Connection:
    conn = sqlite3.connect(path or memory_db())
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA.read_text(encoding="utf-8"))
    return conn


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def next_cycle_number(conn: sqlite3.Connection) -> int:
    row = conn.execute("SELECT COALESCE(MAX(number), 0) AS n FROM cycles").fetchone()
    return int(row["n"]) + 1


def start_cycle(conn: sqlite3.Connection, number: int) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO cycles (number, started_at) VALUES (?, ?)",
        (number, _now()),
    )
    conn.commit()


def end_cycle(conn: sqlite3.Connection, number: int, margin: float, journal: str) -> None:
    conn.execute(
        "UPDATE cycles SET ended_at = ?, margin = ?, journal = ? WHERE number = ?",
        (_now(), round(margin, 2), journal, number),
    )
    conn.commit()


def record_attempt(
    conn: sqlite3.Connection,
    *,
    cycle: int,
    strategy: str,
    hypothesis: str,
    outcome: str = "pending",
    margin: float | None = None,
    lesson: str | None = None,
) -> int:
    cur = conn.execute(
        "INSERT INTO attempts (created_at, cycle, strategy, hypothesis, outcome, "
        "margin, lesson) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (_now(), cycle, strategy, hypothesis, outcome, margin, lesson),
    )
    conn.commit()
    return int(cur.lastrowid)


def already_tried(conn: sqlite3.Connection, hypothesis: str) -> dict | None:
    row = conn.execute(
        "SELECT * FROM attempts WHERE hypothesis = ? ORDER BY id DESC LIMIT 1",
        (hypothesis,),
    ).fetchone()
    return dict(row) if row else None


def lessons(conn: sqlite3.Connection, limit: int = 50) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM attempts WHERE lesson IS NOT NULL AND lesson != '' "
        "ORDER BY id DESC LIMIT ?",
        (limit,),
    ).fetchall()
    return [dict(r) for r in rows]


def history(conn: sqlite3.Connection, limit: int = 100) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM attempts ORDER BY id DESC LIMIT ?", (limit,)
    ).fetchall()
    return [dict(r) for r in rows]


def cycles(conn: sqlite3.Connection, limit: int = 50) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM cycles ORDER BY number DESC LIMIT ?", (limit,)
    ).fetchall()
    return [dict(r) for r in rows]
