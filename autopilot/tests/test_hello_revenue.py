from autopilot.config import load
from autopilot.ledger import Ledger, connect
from autopilot.ledger.queries import cumulative_margin
from autopilot.strategies import Context, registry
from helpers import IsolatedCase


class TestHelloRevenue(IsolatedCase):
    def _ctx(self):
        cfg = load()
        conn = connect()
        return cfg, conn, Context(conn=conn, cfg=cfg, ledger=Ledger(conn, cfg.guardrails.fees))

    def test_is_discovered(self):
        found = registry.discover()
        self.assertIn("hello_revenue", found)
        self.assertEqual(found["hello_revenue"].manifest.risk, "low")

    def test_plan_declares_costs(self):
        cfg, conn, ctx = self._ctx()
        plan = registry.discover()["hello_revenue"].plan(ctx)
        self.assertGreater(len(plan.steps), 0)
        self.assertGreaterEqual(plan.estimated_cost, 0.0)
        conn.close()

    def test_dry_run_writes_only_simulation(self):
        cfg, conn, ctx = self._ctx()
        result = registry.discover()["hello_revenue"].dry_run(ctx)
        self.assertEqual(result.mode, "dry_run")
        self.assertEqual(cumulative_margin(conn, "live")["revenue"], 0.0)
        self.assertGreater(cumulative_margin(conn, "dry_run")["revenue"], 0.0)
        conn.close()

    def test_dry_run_is_reproducible(self):
        cfg, conn, ctx = self._ctx()
        strategy = registry.discover()["hello_revenue"]
        first = strategy.dry_run(ctx)
        ctx.ledger.clear_dry_run("hello_revenue")
        second = strategy.dry_run(ctx)
        self.assertEqual(first.revenue, second.revenue)
        self.assertEqual(first.cost, second.cost)
        conn.close()

    def test_execute_is_blocked_while_in_dry_run_mode(self):
        cfg, conn, ctx = self._ctx()
        result = registry.discover()["hello_revenue"].execute(ctx)
        self.assertEqual(result.actions_taken, [])
        self.assertTrue(result.actions_blocked)
        conn.close()
