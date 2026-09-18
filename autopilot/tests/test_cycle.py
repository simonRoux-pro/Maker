from pathlib import Path

from autopilot import memory
from autopilot.audit import read_tail
from autopilot.dashboard import snapshot
from autopilot.orchestrator import cycle
from helpers import IsolatedCase


class TestCycle(IsolatedCase):
    def test_cycle_end_to_end(self):
        summary = cycle.run()
        self.assertEqual(summary["cycle"], 1)
        self.assertTrue(Path(summary["journal_path"]).exists())
        text = Path(summary["journal_path"]).read_text(encoding="utf-8")
        self.assertIn("Marge", text)
        self.assertIn("Propositions pour le cycle suivant", text)
        self.assertIn("En attente de ta validation", text)
        self.assertIn("Ce que le code ne peut pas faire a ta place", text)
        self.assertIn("compte fournisseur", text)

        self.assertTrue(summary["proposals"])
        self.assertEqual(summary["analysis"]["totals"]["live"]["margin"], 0.0)
        self.assertGreater(summary["analysis"]["totals"]["dry_run"]["revenue"], 0.0)

    def test_second_cycle_does_not_stack_simulation(self):
        first = cycle.run()
        second = cycle.run()
        self.assertEqual(second["cycle"], 2)
        self.assertEqual(
            first["analysis"]["totals"]["dry_run"]["revenue"],
            second["analysis"]["totals"]["dry_run"]["revenue"],
        )

    def test_memory_records_attempts(self):
        cycle.run()
        mem = memory.connect()
        history = memory.history(mem)
        self.assertTrue(history)
        self.assertEqual(
            {row["strategy"] for row in history},
            {"hello_revenue", "jours_feries_api"},
        )
        self.assertEqual(len(memory.cycles(mem)), 1)
        mem.close()

    def test_audit_trail_is_written(self):
        cycle.run()
        events = {e["event"] for e in read_tail(200)}
        self.assertIn("cycle.start", events)
        self.assertIn("cycle.end", events)
        self.assertIn("ledger.entry", events)

    def test_test_only_strategy_is_never_promoted(self):
        summary = cycle.run()
        verdicts = {r["strategy"]: r["verdict"] for r in summary["analysis"]["strategies"]}
        self.assertEqual(verdicts["hello_revenue"], "observer")
        self.assertEqual(verdicts["jours_feries_api"], "passer en live")
        kinds = {p["target"]: p["kind"] for p in summary["proposals"]}
        self.assertEqual(kinds["hello_revenue"], "observer")

    def test_operator_tasks_are_surfaced(self):
        summary = cycle.run()
        tasks = summary["operator_tasks"]
        self.assertTrue(tasks)
        self.assertTrue(all(t["strategy"] == "jours_feries_api" for t in tasks))

    def test_implemented_backlog_entry_is_not_reproposed(self):
        summary = cycle.run()
        targets = [p["target"] for p in summary["proposals"]]
        self.assertNotIn("micro_api_marketplace", targets)

    def test_proposals_do_not_repeat_known_attempts(self):
        first = cycle.run()
        second = cycle.run()
        targets_first = [p["target"] for p in first["proposals"]]
        targets_second = [p["target"] for p in second["proposals"]]
        self.assertEqual(targets_first, targets_second)

    def test_dashboard_snapshot_is_serialisable(self):
        cycle.run()
        state = snapshot()
        for key in ("totals", "by_strategy", "series", "budget", "approvals",
                    "strategies", "analysis", "killswitch", "audit"):
            self.assertIn(key, state)
        self.assertFalse(state["killswitch"]["active"])
