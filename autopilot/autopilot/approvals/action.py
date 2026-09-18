"""Description d'une action reelle. Tout ce qui sort de la machine ou coute de
l'argent se decrit ici avant de passer le gate."""

from __future__ import annotations

import json
from dataclasses import dataclass, field

KINDS = ("spend", "publish", "account", "api_call", "payout")
RISKS = ("low", "medium", "high")


@dataclass(frozen=True)
class RealAction:
    strategy: str
    kind: str
    summary: str
    platform: str | None = None
    api: str | None = None
    estimated_cost: float = 0.0
    risk: str = "low"
    payload: dict = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.kind not in KINDS:
            raise ValueError(f"kind inconnu: {self.kind!r}, attendu un de {KINDS}")
        if self.risk not in RISKS:
            raise ValueError(f"risk inconnu: {self.risk!r}")
        if self.estimated_cost < 0:
            raise ValueError("estimated_cost negatif")

    def payload_json(self) -> str:
        return json.dumps(self.payload, ensure_ascii=False, sort_keys=True)

    def describe(self) -> str:
        target = self.platform or self.api or "local"
        return f"[{self.kind}] {self.strategy} -> {target}: {self.summary} ({self.estimated_cost} EUR)"
