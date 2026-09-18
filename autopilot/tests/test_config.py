from autopilot import config
from autopilot.errors import ConfigError
from helpers import IsolatedCase


class TestConfig(IsolatedCase):
    def test_loads_defaults(self):
        cfg = config.load()
        self.assertEqual(cfg.guardrails.budget.max_total, 0.0)
        self.assertTrue(cfg.guardrails.approval.auto_approve_zero_cost)
        self.assertIn("hello_revenue", cfg.strategies)
        self.assertEqual(cfg.strategies["hello_revenue"].mode, "dry_run")

    def test_allowlist_refuses_by_default(self):
        cfg = config.load()
        self.assertFalse(cfg.guardrails.allowlist.allows_platform("gumroad"))
        self.assertFalse(cfg.guardrails.allowlist.allows_api("example.com"))

    def test_paypal_fee(self):
        fees = config.load().guardrails.fees
        self.assertEqual(fees.paypal_fee(0), 0.0)
        self.assertEqual(fees.paypal_fee(100), round(100 * 0.034 + 0.35, 2))

    def test_guardrails_are_frozen(self):
        cfg = config.load()
        with self.assertRaises(Exception):
            cfg.guardrails.budget.max_total = 1000.0  # type: ignore[misc]

    def test_rejects_strategy_budget_above_cap(self):
        (self.root / "config" / "strategies.toml").write_text(
            '[hello_revenue]\nenabled = true\nmode = "dry_run"\nbudget = 50.0\n',
            encoding="utf-8",
        )
        with self.assertRaises(ConfigError):
            config.load()

    def test_rejects_incoherent_budget(self):
        path = self.root / "config" / "guardrails.toml"
        path.write_text(
            path.read_text(encoding="utf-8").replace(
                "max_per_strategy = 0.0", "max_per_strategy = 10.0"
            ),
            encoding="utf-8",
        )
        with self.assertRaises(ConfigError):
            config.load()
