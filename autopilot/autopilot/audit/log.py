"""Journal auditable en append-only. Une ligne JSON par evenement.

Tout passage par le gate, toute ecriture au Ledger, toute decision de
l'orchestrateur et toute validation manuelle laissent une trace ici.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from ..paths import audit_log


def log(event: str, *, actor: str = "autopilot", **payload: Any) -> dict:
    record = {
        "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "actor": actor,
        "event": event,
        "payload": payload,
    }
    path = audit_log()
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")
    return record


def read_tail(limit: int = 100) -> list[dict]:
    path = audit_log()
    if not path.exists():
        return []
    lines = path.read_text(encoding="utf-8").splitlines()
    out = []
    for line in lines[-limit:]:
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out
