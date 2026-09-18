"""Kill switch global. Deux mecanismes, l'un suffit.

1. Un fichier sentinelle sur disque (config killswitch.file). Tu peux le creer
   a la main, sans lancer quoi que ce soit.
2. Une cle dans la table state, activable depuis le dashboard.

Il est relu avant chaque action reelle, jamais mis en cache.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone

from ..audit import log
from ..config import Guardrails
from ..ledger.db import get_state, set_state

STATE_KEY = "killswitch"


def is_active(conn: sqlite3.Connection, guardrails: Guardrails) -> bool:
    if guardrails.killswitch_file.exists():
        return True
    return get_state(conn, STATE_KEY, "off") == "on"


def reason(conn: sqlite3.Connection, guardrails: Guardrails) -> str | None:
    if guardrails.killswitch_file.exists():
        return f"fichier kill switch present: {guardrails.killswitch_file}"
    if get_state(conn, STATE_KEY, "off") == "on":
        return "kill switch actif dans l'etat persistant"
    return None


def engage(conn: sqlite3.Connection, guardrails: Guardrails, *, by: str = "operator") -> None:
    set_state(conn, STATE_KEY, "on")
    guardrails.killswitch_file.parent.mkdir(parents=True, exist_ok=True)
    guardrails.killswitch_file.write_text(
        f"engage {datetime.now(timezone.utc).isoformat(timespec='seconds')} par {by}\n",
        encoding="utf-8",
    )
    log("killswitch.engage", actor=by)


def release(conn: sqlite3.Connection, guardrails: Guardrails, *, by: str = "operator") -> None:
    set_state(conn, STATE_KEY, "off")
    if guardrails.killswitch_file.exists():
        guardrails.killswitch_file.unlink()
    log("killswitch.release", actor=by)
