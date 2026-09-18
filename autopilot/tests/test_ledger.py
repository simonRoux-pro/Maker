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
