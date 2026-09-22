"""Manifeste d'une strategie: cout estime, risque, dependances externes.

Declare dans un manifest.toml a cote du code, lu au chargement. Une strategie
sans manifeste n'est pas chargee.
"""

from __future__ import annotations

import tomllib
from dataclasses import dataclass, field
from pathlib import Path

from ..errors import ConfigError

RISKS = ("low", "medium", "high")

# revenue: elle doit rapporter, et son verdict se juge sur la marge
# support:  elle sert les autres, juger sa marge propre n'a pas de sens
# test:     elle valide la boucle, elle ne doit jamais passer en reel
KINDS = ("revenue", "support", "test")


@dataclass(frozen=True)
class Manifest:
    name: str
    summary: str
    risk: str
    estimated_setup_cost: float
    estimated_monthly_cost: float
    platforms: tuple[str, ...] = ()
    apis: tuple[str, ...] = ()
    needs_operator: tuple[str, ...] = field(default=())
    kind: str = "revenue"
    # une strategie de validation ne doit jamais etre proposee pour du reel
    test_only: bool = False

    @classmethod
    def load(cls, path: Path) -> "Manifest":
        with path.open("rb") as fh:
            raw = tomllib.load(fh)
        try:
            data = raw["strategy"]
        except KeyError as exc:
            raise ConfigError(f"section [strategy] manquante dans {path}") from exc
        risk = str(data.get("risk", "low"))
        if risk not in RISKS:
            raise ConfigError(f"{path}: risque inconnu {risk!r}")
        kind = str(data.get("kind", "revenue"))
        if kind not in KINDS:
            raise ConfigError(f"{path}: nature inconnue {kind!r}, attendu {KINDS}")
        return cls(
            name=str(data["name"]),
            summary=str(data.get("summary", "")),
            risk=risk,
            estimated_setup_cost=float(data.get("estimated_setup_cost", 0.0)),
            estimated_monthly_cost=float(data.get("estimated_monthly_cost", 0.0)),
            platforms=tuple(data.get("platforms", ())),
            apis=tuple(data.get("apis", ())),
            needs_operator=tuple(data.get("needs_operator", ())),
            kind=kind,
            test_only=bool(data.get("test_only", False)) or kind == "test",
        )

    def as_dict(self) -> dict:
        return {
            "name": self.name,
            "summary": self.summary,
            "risk": self.risk,
            "estimated_setup_cost": self.estimated_setup_cost,
            "estimated_monthly_cost": self.estimated_monthly_cost,
            "platforms": list(self.platforms),
            "apis": list(self.apis),
            "needs_operator": list(self.needs_operator),
            "kind": self.kind,
            "test_only": self.test_only,
        }
