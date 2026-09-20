from autopilot.config import load
from autopilot.ledger import Ledger, connect
from autopilot.ledger.queries import (
    cumulative_margin,
    daily_series,
    margin_by_strategy,
    spent_today,
    spent_total,
)
from helpers import IsolatedCase


class TestLedger(IsolatedCase):
    def setUp(self):
        super().setUp()
        self.cfg = load()
        self.conn = connect()
        self.ledger = Ledger(self.conn, self.cfg.guardrails.fees)

    def tearDown(self):
        self.conn.close()
        super().tearDown()

    def test_revenue_carries_paypal_fee(self):
        self.ledger.record_revenue("s", 100.0, mode="live", day="2026-01-01")
        total = cumulative_margin(self.conn, "live")
        self.assertEqual(total["revenue"], 100.0)
        self.assertEqual(total["cost"], 3.75)
        self.assertEqual(total["margin"], 96.25)

    def test_dry_run_never_pollutes_live(self):
        self.ledger.record_revenue("s", 50.0, mode="dry_run", day="2026-01-01")
        self.assertEqual(cumulative_margin(self.conn, "live")["margin"], 0.0)
        self.assertGreater(cumulative_margin(self.conn, "dry_run")["margin"], 0.0)
        self.assertEqual(spent_total(self.conn), 0.0)

    def test_clear_dry_run_keeps_live(self):
        self.ledger.record_revenue("s", 10.0, mode="live", day="2026-01-01")
        self.ledger.record_revenue("s", 10.0, mode="dry_run", day="2026-01-01")
        removed = self.ledger.clear_dry_run()
        self.assertEqual(removed, 2)
        self.assertGreater(cumulative_margin(self.conn, "live")["revenue"], 0.0)
        self.assertEqual(cumulative_margin(self.conn, "dry_run")["revenue"], 0.0)

    def test_margin_by_strategy_sorted(self):
        self.ledger.record_revenue("gagnante", 100.0, mode="live", apply_paypal_fee=False)
        self.ledger.record_cost("perdante", 20.0, mode="live", category="ads")
        rows = margin_by_strategy(self.conn, "live")
        self.assertEqual(rows[0]["strategy"], "gagnante")
        self.assertEqual(rows[-1]["strategy"], "perdante")
        self.assertEqual(rows[-1]["margin"], -20.0)

    def test_daily_series_is_cumulative(self):
        self.ledger.record_revenue("s", 10.0, mode="live", day="2026-01-01",
                                   apply_paypal_fee=False)
        self.ledger.record_revenue("s", 5.0, mode="live", day="2026-01-02",
                                   apply_paypal_fee=False)
        series = daily_series(self.conn, "live")
        self.assertEqual([p["cumulative"] for p in series], [10.0, 15.0])

    def test_costs_count_toward_daily_spend(self):
        today = spent_today(self.conn)
        self.ledger.record_cost("s", 4.0, mode="live", category="api")
        self.assertEqual(spent_today(self.conn), round(today + 4.0, 2))

    def test_rejects_bad_mode_and_negative(self):
        with self.assertRaises(ValueError):
            self.ledger.record_cost("s", 1.0, mode="reel", category="api")
        with self.assertRaises(ValueError):
            self.ledger.record_cost("s", -1.0, mode="live", category="api")


class TestRecordCommand(IsolatedCase):
    """La commande qui fait entrer de l'argent reel dans le Ledger."""

    def test_records_real_revenue_with_fees(self):
        from autopilot.cli import main

        self.assertEqual(
            main(["record", "revenue", "jours_feries_api", "40.0",
                  "--category", "subscription", "--ref", "payout-001"]),
            0,
        )
        conn = connect()
        total = cumulative_margin(conn, "live")
        self.assertEqual(total["revenue"], 40.0)
        self.assertEqual(total["cost"], 0.0, "pas de frais PayPal sans l'option")
        row = conn.execute(
            "SELECT external_ref, mode FROM entries WHERE kind = 'revenue'"
        ).fetchone()
        self.assertEqual(row["external_ref"], "payout-001")
        self.assertEqual(row["mode"], "live")
        conn.close()

    def test_paypal_fee_is_opt_in(self):
        from autopilot.cli import main

        main(["record", "revenue", "jours_feries_api", "100.0", "--paypal-fee"])
        conn = connect()
        self.assertEqual(cumulative_margin(conn, "live")["cost"], 3.75)
        conn.close()

    def test_records_a_real_cost(self):
        from autopilot.cli import main

        main(["record", "cost", "jours_feries_api", "5.0", "--category", "hosting"])
        conn = connect()
        total = cumulative_margin(conn, "live")
        self.assertEqual(total["margin"], -5.0)
        self.assertEqual(spent_total(conn), 5.0)
        conn.close()

    def test_refuses_an_unknown_strategy(self):
        from autopilot.cli import main

        self.assertEqual(main(["record", "revenue", "inexistante", "10.0"]), 1)
        conn = connect()
        self.assertEqual(cumulative_margin(conn, "live")["revenue"], 0.0)
        conn.close()
