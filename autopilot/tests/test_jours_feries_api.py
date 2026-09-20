from autopilot import approvals
from autopilot.config import load
from autopilot.ledger import Ledger, connect
from autopilot.ledger.queries import cumulative_margin, margin_by_strategy
from autopilot.strategies import Context, registry
from autopilot.strategies.jours_feries_api import project
from helpers import IsolatedCase

NAME = "jours_feries_api"


class TestProjection(IsolatedCase):
    def test_is_deterministic(self):
        self.assertEqual(project(6), project(6))

    def test_grows_then_plateaus_with_churn(self):
        rows = project(24)
        customers = [r["customers"] for r in rows]
        self.assertTrue(all(b >= a for a, b in zip(customers, customers[1:])))
        # le churn borne la croissance, une courbe qui monte sans fin serait fausse
        self.assertLess(rows[-1]["customers"] - rows[-2]["customers"], 0.1)

    def test_net_is_below_gross(self):
        for row in project(12):
            self.assertLess(row["net"], row["gross"])
            self.assertAlmostEqual(
                row["net"],
                round(row["gross"] - row["marketplace_fee"] - row["payout_fee"] - row["hosting"], 2),
                places=2,
            )

    def test_zero_traffic_gives_zero_revenue(self):
        rows = project(6, {"listing_views_per_month": 0})
        self.assertEqual({r["gross"] for r in rows}, {0.0})


class TestStrategyDryRun(IsolatedCase):
    def _ctx(self):
        cfg = load()
        conn = connect()
        return cfg, conn, Context(conn=conn, cfg=cfg, ledger=Ledger(conn, cfg.guardrails.fees))

    def test_is_discovered_with_its_manifest(self):
        found = registry.discover()
        self.assertIn(NAME, found)
        manifest = found[NAME].manifest
        self.assertEqual(manifest.estimated_monthly_cost, 0.0)
        self.assertEqual(manifest.platforms, ("rapidapi",))
        self.assertTrue(manifest.needs_operator)

    def test_plan_marks_external_steps(self):
        cfg, conn, ctx = self._ctx()
        plan = registry.discover()[NAME].plan(ctx)
        self.assertTrue(any(s.external for s in plan.steps))
        self.assertEqual(plan.estimated_cost, 0.0)
        conn.close()

    def test_dry_run_records_fees_separately(self):
        cfg, conn, ctx = self._ctx()
        registry.discover()[NAME].dry_run(ctx)
        categories = {
            row[0]
            for row in conn.execute(
                "SELECT category FROM entries WHERE strategy = ? AND mode = 'dry_run'",
                (NAME,),
            )
        }
        self.assertEqual(categories, {"subscription", "marketplace_fee", "paypal_payout_fee"})
        self.assertEqual(cumulative_margin(conn, "live")["revenue"], 0.0)
        conn.close()

    def test_dry_run_margin_is_positive_but_small(self):
        cfg, conn, ctx = self._ctx()
        result = registry.discover()[NAME].dry_run(ctx)
        self.assertGreater(result.margin, 0)
        self.assertLess(result.margin, 50, "un premier mois a plus de 50 EUR serait de l'optimisme")
        row = next(r for r in margin_by_strategy(conn, "dry_run") if r["strategy"] == NAME)
        self.assertAlmostEqual(row["margin"], result.margin, places=2)
        conn.close()

    def test_execute_blocked_in_dry_run_mode(self):
        cfg, conn, ctx = self._ctx()
        result = registry.discover()[NAME].execute(ctx)
        self.assertEqual(result.actions_taken, [])
        self.assertEqual(len(result.actions_blocked), 2)
        self.assertEqual(approvals.list_by_status(conn, "pending"), [])
        conn.close()


class TestStrategyLive(IsolatedCase):
    mode = "live"

    def _ctx(self):
        cfg = load()
        conn = connect()
        return cfg, conn, Context(conn=conn, cfg=cfg, ledger=Ledger(conn, cfg.guardrails.fees))

    def test_platforms_absent_from_allowlist_are_refused(self):
        cfg, conn, ctx = self._ctx()
        result = registry.discover()[NAME].execute(ctx)
        self.assertEqual(len(result.actions_blocked), 2)
        self.assertEqual(result.pending_approvals, [])
        self.assertTrue(
            all("non autorisee" in blocked for blocked in result.actions_blocked),
            result.actions_blocked,
        )
        conn.close()


class TestStrategyLiveAllowed(IsolatedCase):
    mode = "live"
    platforms = ["rapidapi"]
    apis = ["cloudflare-workers"]

    def _ctx(self):
        cfg = load()
        conn = connect()
        return cfg, conn, Context(conn=conn, cfg=cfg, ledger=Ledger(conn, cfg.guardrails.fees))

    def test_publishing_always_waits_for_validation(self):
        cfg, conn, ctx = self._ctx()
        result = registry.discover()[NAME].execute(ctx)
        self.assertEqual(result.actions_taken, [])
        self.assertEqual(len(result.pending_approvals), 2)
        pending = approvals.list_by_status(conn, "pending")
        self.assertEqual(len(pending), 2)
        self.assertEqual({p["kind"] for p in pending}, {"publish"})
        conn.close()


class TestStrategyDeployed(IsolatedCase):
    """Une fois l'API en ligne, le systeme ne doit plus reclamer son deploiement."""

    mode = "live"
    platforms = ["rapidapi"]
    apis = ["cloudflare-workers"]
    strategy_options = 'base_url = "https://maker.example.workers.dev"'

    def _ctx(self):
        cfg = load()
        conn = connect()
        return cfg, conn, Context(conn=conn, cfg=cfg, ledger=Ledger(conn, cfg.guardrails.fees))

    def test_deployment_is_read_from_the_configuration(self):
        cfg, conn, ctx = self._ctx()
        strategy = registry.discover()[NAME]
        self.assertEqual(strategy.deployed(ctx), "https://maker.example.workers.dev")
        self.assertIsNone(strategy.listed(ctx))
        conn.close()

    def test_operator_is_no_longer_asked_to_deploy(self):
        cfg, conn, ctx = self._ctx()
        tasks = registry.discover()[NAME].operator_tasks(ctx)
        self.assertFalse(any("Cloudflare" in t for t in tasks))
        self.assertTrue(any("compte fournisseur" in t for t in tasks))
        conn.close()

    def test_only_the_listing_remains_to_be_done(self):
        cfg, conn, ctx = self._ctx()
        result = registry.discover()[NAME].execute(ctx)
        self.assertEqual(len(result.pending_approvals), 1)
        pending = approvals.list_by_status(conn, "pending")
        self.assertEqual(len(pending), 1)
        self.assertEqual(pending[0]["platform"], "rapidapi")
        self.assertEqual(
            pending[0]["payload"]["base_url"], "https://maker.example.workers.dev"
        )
        conn.close()

    def test_plan_shows_the_api_as_online(self):
        cfg, conn, ctx = self._ctx()
        plan = registry.discover()[NAME].plan(ctx)
        self.assertIn("en ligne", plan.steps[0].label)
        self.assertFalse(plan.steps[0].external)
        conn.close()


class TestSecretReminder(IsolatedCase):
    """Fiche publiee mais secret absent: l'API est appelable hors facturation."""

    mode = "live"
    strategy_options = (
        'base_url = "https://maker.example.workers.dev"\n'
        'listing_url = "https://marketplace.example/api/jours-feries"\n'
        "proxy_secret_set = false"
    )

    def test_the_missing_secret_is_raised(self):
        cfg = load()
        conn = connect()
        ctx = Context(conn=conn, cfg=cfg, ledger=Ledger(conn, cfg.guardrails.fees))
        tasks = registry.discover()[NAME].operator_tasks(ctx)
        self.assertEqual(len(tasks), 1)
        self.assertIn("RAPIDAPI_PROXY_SECRET", tasks[0])
        conn.close()
