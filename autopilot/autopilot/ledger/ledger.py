"""Ecriture au Ledger. Seul point d'entree pour enregistrer argent entrant
et sortant.

Toute ecriture porte un mode: 'dry_run' pour la simulation, 'live' pour le
reel. Les deux cohabitent dans la meme table mais ne sont jamais melangees
dans les agregats.
"""

from __future__ import annotations

import sqlite3
from datetime import date, datetime, timezone

from ..audit import log
from ..config import Fees


class Ledger:
    def __init__(self, conn: sqlite3.Connection, fees: Fees | None = None):
        self.conn = conn
        self.fees = fees

    # ------------------------------------------------------------------ ecriture

    def record_revenue(
        self,
        strategy: str,
        amount: float,
        *,
        mode: str,
        category: str = "sale",
        note: str | None = None,
        external_ref: str | None = None,
        day: str | None = None,
        apply_paypal_fee: bool = True,
    ) -> int:
        """Enregistre un encaissement brut, et les frais PayPal qui vont avec.

        La marge nette est donc toujours nette de frais, pas du brut affiche
        par la plateforme.
        """
        entry_id = self._insert(
            strategy, "revenue", category, amount, mode=mode, note=note,
            external_ref=external_ref, day=day,
        )
        if apply_paypal_fee and self.fees is not None:
            fee = self.fees.paypal_fee(amount)
            if fee > 0:
                self._insert(
                    strategy, "cost", "paypal_fee", fee, mode=mode,
                    note=f"frais sur encaissement #{entry_id}", day=day,
                )
        return entry_id

    def record_cost(
        self,
        strategy: str,
        amount: float,
        *,
        mode: str,
        category: str,
        note: str | None = None,
        external_ref: str | None = None,
        day: str | None = None,
    ) -> int:
        return self._insert(
            strategy, "cost", category, amount, mode=mode, note=note,
            external_ref=external_ref, day=day,
        )

    def _insert(
        self,
        strategy: str,
        kind: str,
        category: str,
        amount: float,
        *,
        mode: str,
        note: str | None = None,
        external_ref: str | None = None,
        day: str | None = None,
    ) -> int:
        if mode not in ("dry_run", "live"):
            raise ValueError(f"mode invalide: {mode!r}")
        if amount < 0:
            raise ValueError("montant negatif interdit, utilise kind='cost'")
        now = datetime.now(timezone.utc)
        cur = self.conn.execute(
            "INSERT INTO entries (ts, day, strategy, kind, category, amount, "
            "currency, mode, note, external_ref) "
            "VALUES (?, ?, ?, ?, ?, ?, 'EUR', ?, ?, ?)",
            (
                now.isoformat(timespec="seconds"),
                day or date.today().isoformat(),
                strategy,
                kind,
                category,
                round(float(amount), 4),
                mode,
                note,
                external_ref,
            ),
        )
        self.conn.commit()
        entry_id = int(cur.lastrowid)
        log(
            "ledger.entry",
            entry_id=entry_id,
            strategy=strategy,
            kind=kind,
            category=category,
            amount=round(float(amount), 4),
            mode=mode,
        )
        return entry_id

    # ------------------------------------------------------------------ nettoyage

    def clear_dry_run(self, strategy: str | None = None) -> int:
        """Purge les ecritures simulees. Ne touche jamais au reel."""
        if strategy:
            cur = self.conn.execute(
                "DELETE FROM entries WHERE mode = 'dry_run' AND strategy = ?", (strategy,)
            )
        else:
            cur = self.conn.execute("DELETE FROM entries WHERE mode = 'dry_run'")
        self.conn.commit()
        return cur.rowcount
