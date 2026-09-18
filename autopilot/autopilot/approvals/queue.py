"""File d'approbation. Une action reelle qui coute de l'argent ou qui sort vers
l'exterieur y atterrit et y reste jusqu'a ta decision."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timedelta, timezone

from ..audit import log
from .action import RealAction


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def create(conn: sqlite3.Connection, action: RealAction) -> int:
    cur = conn.execute(
        "INSERT INTO approvals (created_at, strategy, kind, summary, platform, "
        "estimated_cost, risk, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (
            _now(),
            action.strategy,
            action.kind,
            action.summary,
            action.platform or action.api,
            round(action.estimated_cost, 2),
            action.risk,
            action.payload_json(),
        ),
    )
    conn.commit()
    approval_id = int(cur.lastrowid)
    log(
        "approval.created",
        approval_id=approval_id,
        strategy=action.strategy,
        kind=action.kind,
        estimated_cost=round(action.estimated_cost, 2),
        risk=action.risk,
        summary=action.summary,
    )
    return approval_id


def get(conn: sqlite3.Connection, approval_id: int) -> dict | None:
    row = conn.execute("SELECT * FROM approvals WHERE id = ?", (approval_id,)).fetchone()
    return _as_dict(row) if row else None


def list_by_status(conn: sqlite3.Connection, status: str = "pending") -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM approvals WHERE status = ? ORDER BY created_at", (status,)
    ).fetchall()
    return [_as_dict(r) for r in rows]


def list_all(conn: sqlite3.Connection, limit: int = 100) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM approvals ORDER BY id DESC LIMIT ?", (limit,)
    ).fetchall()
    return [_as_dict(r) for r in rows]


def approve(conn: sqlite3.Connection, approval_id: int, *, by: str = "operator",
            note: str | None = None) -> dict:
    return _decide(conn, approval_id, "approved", by=by, note=note)


def reject(conn: sqlite3.Connection, approval_id: int, *, by: str = "operator",
           note: str | None = None) -> dict:
    return _decide(conn, approval_id, "rejected", by=by, note=note)


def mark_executed(conn: sqlite3.Connection, approval_id: int) -> dict:
    conn.execute("UPDATE approvals SET status = 'executed' WHERE id = ?", (approval_id,))
    conn.commit()
    log("approval.executed", approval_id=approval_id)
    return get(conn, approval_id)  # type: ignore[return-value]


def expire_older_than(conn: sqlite3.Connection, days: int = 7) -> int:
    """Une action non validee ne traine pas indefiniment: elle expire."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat(timespec="seconds")
    cur = conn.execute(
        "UPDATE approvals SET status = 'expired', decided_at = ? "
        "WHERE status = 'pending' AND created_at < ?",
        (_now(), cutoff),
    )
    conn.commit()
    if cur.rowcount:
        log("approval.expired", count=cur.rowcount, older_than_days=days)
    return cur.rowcount


def _decide(conn: sqlite3.Connection, approval_id: int, status: str, *, by: str,
            note: str | None) -> dict:
    current = get(conn, approval_id)
    if current is None:
        raise KeyError(f"approbation inconnue: {approval_id}")
    if current["status"] != "pending":
        raise ValueError(
            f"approbation {approval_id} deja traitee (statut {current['status']})"
        )
    conn.execute(
        "UPDATE approvals SET status = ?, decided_at = ?, decided_by = ?, "
        "decision_note = ? WHERE id = ?",
        (status, _now(), by, note, approval_id),
    )
    conn.commit()
    log(f"approval.{status}", actor=by, approval_id=approval_id, note=note)
    return get(conn, approval_id)  # type: ignore[return-value]


def _as_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    try:
        d["payload"] = json.loads(d.get("payload") or "{}")
    except json.JSONDecodeError:
        d["payload"] = {}
    return d
