"""Chargement et validation des garde-fous.

Charge une seule fois, en lecture seule. Une strategie recoit l'objet mais ne
peut rien en changer: les dataclasses sont frozen.
"""

from __future__ import annotations

import tomllib
from dataclasses import dataclass, field
from pathlib import Path

from .errors import ConfigError
from .paths import config_dir, home


@dataclass(frozen=True)
class Budget:
    max_total: float
    max_per_strategy: float
    max_daily: float


@dataclass(frozen=True)
class ApprovalPolicy:
    auto_approve_zero_cost: bool
    manual_above: float


@dataclass(frozen=True)
class Allowlist:
    platforms: tuple[str, ...] = ()
    apis: tuple[str, ...] = ()

    def allows_platform(self, name: str) -> bool:
        return name.lower() in {p.lower() for p in self.platforms}

    def allows_api(self, name: str) -> bool:
        return name.lower() in {a.lower() for a in self.apis}


@dataclass(frozen=True)
class Fees:
    paypal_percent: float
    paypal_fixed: float

    def paypal_fee(self, gross: float) -> float:
        """Frais preleves sur un encaissement brut."""
        if gross <= 0:
            return 0.0
        return round(gross * self.paypal_percent / 100 + self.paypal_fixed, 2)


@dataclass(frozen=True)
class Guardrails:
    budget: Budget
    approval: ApprovalPolicy
    allowlist: Allowlist
    fees: Fees
    killswitch_file: Path


@dataclass(frozen=True)
class StrategyConfig:
    name: str
    enabled: bool
    mode: str
    budget: float

    @property
    def is_live(self) -> bool:
        return self.mode == "live"


@dataclass(frozen=True)
class Config:
    guardrails: Guardrails
    strategies: dict[str, StrategyConfig] = field(default_factory=dict)


def _read(path: Path) -> dict:
    if not path.exists():
        raise ConfigError(f"fichier de configuration absent: {path}")
    with path.open("rb") as fh:
        return tomllib.load(fh)


def _require(d: dict, section: str, path: Path) -> dict:
    if section not in d:
        raise ConfigError(f"section [{section}] manquante dans {path}")
    return d[section]


def load(config_path: Path | None = None, strategies_path: Path | None = None) -> Config:
    cfg_dir = config_dir()
    gpath = config_path or cfg_dir / "guardrails.toml"
    spath = strategies_path or cfg_dir / "strategies.toml"

    raw = _read(gpath)
    b = _require(raw, "budget", gpath)
    a = _require(raw, "approval", gpath)
    k = _require(raw, "killswitch", gpath)
    al = raw.get("allowlist", {})
    f = _require(raw, "fees", gpath)

    budget = Budget(
        max_total=float(b["max_total"]),
        max_per_strategy=float(b["max_per_strategy"]),
        max_daily=float(b["max_daily"]),
    )
    for name, value in (
        ("max_total", budget.max_total),
        ("max_per_strategy", budget.max_per_strategy),
        ("max_daily", budget.max_daily),
    ):
        if value < 0:
            raise ConfigError(f"budget.{name} negatif")
    if budget.max_per_strategy > budget.max_total:
        raise ConfigError("budget.max_per_strategy depasse budget.max_total")
    if budget.max_daily > budget.max_total:
        raise ConfigError("budget.max_daily depasse budget.max_total")

    kill_file = Path(k["file"])
    if not kill_file.is_absolute():
        kill_file = home() / kill_file

    guardrails = Guardrails(
        budget=budget,
        approval=ApprovalPolicy(
            auto_approve_zero_cost=bool(a["auto_approve_zero_cost"]),
            manual_above=float(a["manual_above"]),
        ),
        allowlist=Allowlist(
            platforms=tuple(al.get("platforms", ())),
            apis=tuple(al.get("apis", ())),
        ),
        fees=Fees(
            paypal_percent=float(f["paypal_percent"]),
            paypal_fixed=float(f["paypal_fixed"]),
        ),
        killswitch_file=kill_file,
    )

    strategies: dict[str, StrategyConfig] = {}
    if spath.exists():
        for name, block in _read(spath).items():
            if not isinstance(block, dict):
                raise ConfigError(f"entree invalide pour la strategie {name}")
            mode = str(block.get("mode", "dry_run"))
            if mode not in ("dry_run", "live"):
                raise ConfigError(f"{name}: mode inconnu {mode!r}")
            sbudget = float(block.get("budget", 0.0))
            if sbudget > guardrails.budget.max_per_strategy:
                raise ConfigError(
                    f"{name}: budget {sbudget} depasse budget.max_per_strategy "
                    f"{guardrails.budget.max_per_strategy}"
                )
            strategies[name] = StrategyConfig(
                name=name,
                enabled=bool(block.get("enabled", False)),
                mode=mode,
                budget=sbudget,
            )

    return Config(guardrails=guardrails, strategies=strategies)
