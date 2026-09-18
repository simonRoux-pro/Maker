from autopilot import approvals
from autopilot.approvals.action import RealAction
from autopilot.config import load
from autopilot.guardrails import gate, killswitch
from autopilot.ledger import Ledger, connect
from helpers import IsolatedCase


def action(**kw) -> RealAction:
    base = dict(
        strategy="hello_revenue",
        kind="api_call",
        summary="appel de test",
        api="example.com",
        estimated_cost=0.0,
        risk="low",
    )
    base.update(kw)
    return RealAction(**base)


class TestDryRunBlocks(IsolatedCase):
    mode = "dry_run"
    apis = ["example.com"]

    def test_no_real_action_in_dry_run(self):
        cfg, conn = load(), connect()
        decision = gate.authorize(conn, cfg, action())
        self.assertFalse(decision.allowed)
        self.assertIn("dry_run", decision.reason)
        conn.close()


class TestAllowlist(IsolatedCase):
    mode = "live"

    def test_unknown_api_refused(self):
        cfg, conn = load(), connect()
        decision = gate.authorize(conn, cfg, action(api="pas-dans-la-liste.com"))
        self.assertFalse(decision.allowed)
        self.assertIn("api non autorisee", decision.reason)
        conn.close()

    def test_unknown_platform_refused(self):
        cfg, conn = load(), connect()
        decision = gate.authorize(
            conn, cfg, action(kind="publish", api=None, platform="quelque-part")
        )
        self.assertFalse(decision.allowed)
        self.assertIn("plateforme non autorisee", decision.reason)
        conn.close()


class TestZeroCost(IsolatedCase):
    mode = "live"
    apis = ["example.com"]

    def test_zero_cost_api_call_passes(self):
        cfg, conn = load(), connect()
        decision = gate.authorize(conn, cfg, action())
        self.assertTrue(decision.allowed)
        conn.close()

    def test_publish_always_queued(self):
        cfg, conn = load(), connect()
        decision = gate.authorize(conn, cfg, action(kind="publish", api="example.com"))
        self.assertFalse(decision.allowed)
        self.assertTrue(decision.queued)
        self.assertIsNotNone(decision.approval_id)
        conn.close()

    def test_killswitch_wins_over_everything(self):
        cfg, conn = load(), connect()
        killswitch.engage(conn, cfg.guardrails, by="test")
        decision = gate.authorize(conn, cfg, action())
        self.assertFalse(decision.allowed)
        self.assertIn("kill switch", decision.reason)
        killswitch.release(conn, cfg.guardrails, by="test")
        self.assertTrue(gate.authorize(conn, cfg, action()).allowed)
        conn.close()

    def test_killswitch_file_alone_is_enough(self):
        cfg, conn = load(), connect()
        cfg.guardrails.killswitch_file.write_text("stop", encoding="utf-8")
        self.assertTrue(killswitch.is_active(conn, cfg.guardrails))
        self.assertFalse(gate.authorize(conn, cfg, action()).allowed)
        conn.close()


class TestBudget(IsolatedCase):
    mode = "live"
    apis = ["example.com"]
    max_total = 10.0
    max_per_strategy = 10.0
    max_daily = 4.0
    strategy_budget = 10.0

    def test_cost_within_caps_is_queued_not_denied(self):
        cfg, conn = load(), connect()
        decision = gate.authorize(conn, cfg, action(estimated_cost=2.0))
        self.assertFalse(decision.allowed)
        self.assertTrue(decision.queued, "un cout doit aller en file, pas etre refuse")
        conn.close()

    def test_daily_cap_denies(self):
        cfg, conn = load(), connect()
        decision = gate.authorize(conn, cfg, action(estimated_cost=5.0))
        self.assertFalse(decision.allowed)
        self.assertFalse(decision.queued)
        self.assertIn("plafond journalier", decision.reason)
        conn.close()

    def test_spending_accumulates_against_cap(self):
        cfg, conn = load(), connect()
        Ledger(conn, cfg.guardrails.fees).record_cost(
            "hello_revenue", 3.5, mode="live", category="api"
        )
        decision = gate.authorize(conn, cfg, action(estimated_cost=1.0))
        self.assertIn("plafond journalier", decision.reason)
        conn.close()

    def test_approved_action_passes_but_not_beyond_its_cost(self):
        cfg, conn = load(), connect()
        queued = gate.authorize(conn, cfg, action(estimated_cost=2.0))
        approvals.approve(conn, queued.approval_id, by="test")

        ok = gate.authorize(
            conn, cfg, action(estimated_cost=2.0), approval_id=queued.approval_id
        )
        self.assertTrue(ok.allowed)

        too_much = gate.authorize(
            conn, cfg, action(estimated_cost=3.0), approval_id=queued.approval_id
        )
        self.assertFalse(too_much.allowed)
        self.assertIn("superieur au cout valide", too_much.reason)
        conn.close()

    def test_rejected_approval_never_passes(self):
        cfg, conn = load(), connect()
        queued = gate.authorize(conn, cfg, action(estimated_cost=2.0))
        approvals.reject(conn, queued.approval_id, by="test")
        decision = gate.authorize(
            conn, cfg, action(estimated_cost=2.0), approval_id=queued.approval_id
        )
        self.assertFalse(decision.allowed)
        self.assertIn("non validee", decision.reason)
        conn.close()


class TestDisabledStrategy(IsolatedCase):
    mode = "live"
    enabled = "false"
    apis = ["example.com"]

    def test_disabled_strategy_blocked(self):
        cfg, conn = load(), connect()
        decision = gate.authorize(conn, cfg, action())
        self.assertFalse(decision.allowed)
        self.assertIn("desactivee", decision.reason)
        conn.close()

    def test_unknown_strategy_blocked(self):
        cfg, conn = load(), connect()
        decision = gate.authorize(conn, cfg, action(strategy="inexistante"))
        self.assertFalse(decision.allowed)
        self.assertIn("inconnue", decision.reason)
        conn.close()
