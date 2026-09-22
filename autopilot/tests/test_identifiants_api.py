from autopilot import approvals
from autopilot.config import load
from autopilot.ledger import Ledger, connect
from autopilot.strategies import Context, registry
from autopilot.strategies.identifiants_api import strategy as module
from helpers import IsolatedCase

NAME = "identifiants_api"


class TestSecondProduct(IsolatedCase):
    def _ctx(self):
        cfg = load()
        conn = connect()
        return cfg, conn, Context(conn=conn, cfg=cfg, ledger=Ledger(conn, cfg.guardrails.fees))

    def test_is_discovered(self):
        found = registry.discover()
        self.assertIn(NAME, found)
        self.assertEqual(found[NAME].manifest.estimated_setup_cost, 0.0)

    def test_has_its_own_assumptions(self):
        from autopilot.strategies.jours_feries_api import ASSUMPTIONS as first

        self.assertNotEqual(module.ASSUMPTIONS, first)
        self.assertGreater(
            module.ASSUMPTIONS["listing_views_per_month"],
            first["listing_views_per_month"],
        )

    def test_projection_differs_from_the_first_product(self):
        from autopilot.strategies.jours_feries_api import ASSUMPTIONS as first
        from autopilot.strategies.marketplace_api import project

        self.assertNotEqual(project(12, module.ASSUMPTIONS), project(12, first))

    def test_dry_run_writes_nothing_without_a_listing(self):
        cfg, conn, ctx = self._ctx()
        result = registry.discover()[NAME].dry_run(ctx)
        self.assertEqual(result.revenue, 0.0)
        from autopilot.ledger.queries import cumulative_margin

        self.assertEqual(cumulative_margin(conn, "dry_run")["revenue"], 0.0)
        self.assertTrue(any("non publiee" in n for n in result.notes))
        # le potentiel reste lisible, il n'est simplement pas compte
        self.assertTrue(any("si elle l'etait" in n for n in result.notes))
        conn.close()

    def test_nothing_is_deployed_yet(self):
        cfg, conn, ctx = self._ctx()
        strategy = registry.discover()[NAME]
        self.assertIsNone(strategy.deployed(ctx))
        self.assertIsNone(strategy.listed(ctx))
        self.assertEqual(len(strategy.operator_tasks(ctx)), 3)
        conn.close()


class TestSecondProductLive(IsolatedCase):
    mode = "live"
    platforms = ["rapidapi"]
    apis = ["cloudflare-workers"]

    def test_both_actions_wait_for_validation(self):
        cfg = load()
        conn = connect()
        ctx = Context(conn=conn, cfg=cfg, ledger=Ledger(conn, cfg.guardrails.fees))
        result = registry.discover()[NAME].execute(ctx)
        self.assertEqual(result.actions_taken, [])
        self.assertEqual(len(result.pending_approvals), 2)
        pending = approvals.list_by_status(conn, "pending")
        payload = next(p for p in pending if p["platform"] == "rapidapi")["payload"]
        self.assertEqual(len(payload["paliers"]), 3)
        conn.close()


class TestPlanBeforeAnything(IsolatedCase):
    def test_plan_marks_the_steps_that_need_a_human(self):
        cfg = load()
        conn = connect()
        ctx = Context(conn=conn, cfg=cfg, ledger=Ledger(conn, cfg.guardrails.fees))
        plan = registry.discover()[NAME].plan(ctx)
        externes = [s for s in plan.steps if s.external]
        self.assertEqual(len(externes), 2, "deploiement et publication de la fiche")
        self.assertEqual(plan.estimated_cost, 0.0)
        conn.close()
