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
        # derive du registre: ajouter une strategie ne doit pas casser ce test
        from autopilot.config import load
        from autopilot.strategies import registry

        self.assertEqual(
            {row["strategy"] for row in history},
            set(registry.enabled(load())),
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
        raisons = {
            r["strategy"]: r["why"] for r in summary["analysis"]["strategies"]
        }
        self.assertIn("validation", raisons["hello_revenue"])
        # une brique de distribution ne se juge pas non plus sur sa marge
        self.assertEqual(verdicts["outils_web"], "observer")
        self.assertIn("distribution", raisons["outils_web"])
        kinds = {p["target"]: p["kind"] for p in summary["proposals"]}
        self.assertEqual(kinds["hello_revenue"], "observer")

    def test_operator_tasks_are_surfaced(self):
        from autopilot.config import load
        from autopilot.strategies import registry

        summary = cycle.run()
        tasks = summary["operator_tasks"]
        self.assertTrue(tasks)

        enabled = registry.enabled(load())
        # une tache ne peut venir que d'une strategie qui en declare
        for task in tasks:
            self.assertIn(task["strategy"], enabled)
            self.assertIn(task["task"], enabled[task["strategy"]].manifest.needs_operator)
        # la strategie de validation n'en demande jamais
        self.assertNotIn("hello_revenue", {t["strategy"] for t in tasks})

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


class TestReportCommand(IsolatedCase):
    def test_report_never_promotes_a_test_strategy(self):
        from autopilot.cli import main

        cycle.run()
        self.assertEqual(main(["report"]), 0)

        from autopilot.config import load
        from autopilot.ledger import connect
        from autopilot.orchestrator import analyze
        from autopilot.strategies import registry

        conn = connect()
        test_only = frozenset(
            n for n, s in registry.discover().items() if s.manifest.test_only
        )
        verdicts = {
            r["strategy"]: r["verdict"] for r in analyze(conn, load(), test_only)["strategies"]
        }
        self.assertEqual(verdicts["hello_revenue"], "observer")
        conn.close()


class TestViability(IsolatedCase):
    """Le seuil de marge minimale doit bloquer, pas decorer."""

    def test_threshold_is_reported_per_strategy(self):
        summary = cycle.run()
        self.assertEqual(summary["min_monthly_margin"], 0.0)
        rows = {r["strategy"]: r for r in summary["viability"]}
        # les strategies vendeuses savent dire leur plafond
        self.assertIn("jours_feries_api", rows)
        self.assertIn("pack_calendrier", rows)
        # les briques de distribution n'en ont pas
        self.assertNotIn("outils_web", rows)
        self.assertNotIn("npm_packages", rows)

    def test_journal_shows_the_threshold(self):
        from pathlib import Path

        summary = cycle.run()
        text = Path(summary["journal_path"]).read_text(encoding="utf-8")
        self.assertIn("Viabilite", text)
        self.assertIn("visites par mois suffisent", text)


class TestBelowThresholdIsKilled(IsolatedCase):
    """Une strategie qui ne peut pas atteindre le minimum est condamnee."""

    def test_a_ceiling_under_the_minimum_kills(self):
        from autopilot.config import load
        from autopilot.ledger import connect
        from autopilot.orchestrator.analyze import KILL, analyze

        (self.root / "config" / "guardrails.toml").write_text(
            (self.root / "config" / "guardrails.toml").read_text(encoding="utf-8").replace(
                "[fees]", "[objectif]\nmin_monthly_margin = 10.0\n\n[fees]"
            ),
            encoding="utf-8",
        )
        cfg = load()
        self.assertEqual(cfg.guardrails.min_monthly_margin, 10.0)

        conn = connect()
        analysis = analyze(conn, cfg, ceilings={"jours_feries_api": 3.0})
        verdict = next(
            r for r in analysis["strategies"] if r["strategy"] == "jours_feries_api"
        )
        self.assertEqual(verdict["verdict"], KILL)
        self.assertIn("sous le minimum", verdict["why"])
        conn.close()

    def test_a_ceiling_above_the_minimum_survives(self):
        from autopilot.config import load
        from autopilot.ledger import connect
        from autopilot.orchestrator.analyze import KILL, analyze

        conn = connect()
        analysis = analyze(conn, load(), ceilings={"jours_feries_api": 43.0})
        verdict = next(
            r for r in analysis["strategies"] if r["strategy"] == "jours_feries_api"
        )
        self.assertNotEqual(verdict["verdict"], KILL)
        conn.close()


class TestActionsFile(IsolatedCase):
    """La feuille de route doit refleter l'etat reel, pas une liste figee."""

    def _render(self):
        from autopilot.config import load
        from autopilot.ledger import Ledger, connect
        from autopilot.orchestrator import actions
        from autopilot.strategies import Context

        cfg = load()
        conn = connect()
        ctx = Context(conn=conn, cfg=cfg, ledger=Ledger(conn, cfg.guardrails.fees))
        text = actions.render(cfg, ctx)
        conn.close()
        return text

    def test_lists_everything_that_remains(self):
        text = self._render()
        self.assertIn("Deployer l'API identifiants", text)
        self.assertIn("Deployer le site public", text)
        self.assertIn("jeton de publication", text)
        self.assertIn("pack calendrier", text)

    def test_carries_links_settings_and_copy_texts(self):
        text = self._render()
        self.assertIn("https://dash.cloudflare.com", text)
        self.assertIn("autopilot/products/outils_web", text)
        self.assertIn("French Business Identifiers Validation", text)
        self.assertIn("RAPIDAPI_PROXY_SECRET", text)

    def test_totals_the_time(self):
        text = self._render()
        self.assertIn("action(s), environ", text)
        self.assertIn("Aucune carte bancaire", text)

    def test_a_done_step_disappears(self):
        config = self.root / "config" / "strategies.toml"
        config.write_text(
            config.read_text(encoding="utf-8").replace(
                "[outils_web]\nenabled = true\nmode = \"dry_run\"\nbudget = 0.0",
                "[outils_web]\nenabled = true\nmode = \"dry_run\"\nbudget = 0.0\n"
                'base_url = "https://outils.example.workers.dev"',
            ),
            encoding="utf-8",
        )
        text = self._render()
        self.assertNotIn("## 2. Deployer le site public", text)
        self.assertIn("Deja fait", text)
        self.assertIn("https://outils.example.workers.dev", text)

    def test_the_cycle_regenerates_it(self):
        from pathlib import Path

        summary = cycle.run()
        self.assertTrue(Path(summary["actions_path"]).exists())
