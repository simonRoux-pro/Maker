"""Isolation des tests: un AUTOPILOT_HOME temporaire, une config ecrite a la
main. Aucun test ne touche aux donnees reelles."""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path

GUARDRAILS = """
[budget]
max_total = {max_total}
max_per_strategy = {max_per_strategy}
max_daily = {max_daily}

[approval]
auto_approve_zero_cost = {auto_zero}
manual_above = 0.0

[killswitch]
file = "data/KILL"

[allowlist]
platforms = {platforms}
apis = {apis}

[fees]
paypal_percent = 3.4
paypal_fixed = 0.35
"""

STRATEGIES = """
[hello_revenue]
enabled = {enabled}
mode = "{mode}"
budget = {budget}

[jours_feries_api]
enabled = {enabled}
mode = "{mode}"
budget = {budget}
{options}
"""


class IsolatedCase(unittest.TestCase):
    """Chaque test tourne dans son propre dossier, avec sa propre config."""

    # surchargeables par test
    max_total = 0.0
    max_per_strategy = 0.0
    max_daily = 0.0
    auto_zero = "true"
    platforms: list[str] = []
    apis: list[str] = []
    enabled = "true"
    mode = "dry_run"
    strategy_budget = 0.0
    # lignes TOML supplementaires pour jours_feries_api, par exemple base_url
    strategy_options = ""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        root = Path(self._tmp.name)
        (root / "config").mkdir()
        (root / "data").mkdir()
        (root / "logs").mkdir()
        (root / "journal").mkdir()
        (root / "config" / "guardrails.toml").write_text(
            GUARDRAILS.format(
                max_total=self.max_total,
                max_per_strategy=self.max_per_strategy,
                max_daily=self.max_daily,
                auto_zero=self.auto_zero,
                platforms=_toml_list(self.platforms),
                apis=_toml_list(self.apis),
            ),
            encoding="utf-8",
        )
        (root / "config" / "strategies.toml").write_text(
            STRATEGIES.format(
                enabled=self.enabled,
                mode=self.mode,
                budget=self.strategy_budget,
                options=self.strategy_options,
            ),
            encoding="utf-8",
        )
        self._env = {
            "AUTOPILOT_HOME": str(root),
            "AUTOPILOT_CONFIG_DIR": str(root / "config"),
        }
        self._old = {k: os.environ.get(k) for k in self._env}
        os.environ.update(self._env)
        self.root = root

    def tearDown(self) -> None:
        for key, value in self._old.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        self._tmp.cleanup()


def _toml_list(values: list[str]) -> str:
    inner = ", ".join(f'"{v}"' for v in values)
    return f"[{inner}]"
