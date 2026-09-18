"""Decouverte des strategies. Un dossier par strategie, un manifest.toml, une
classe qui herite de Strategy exposee sous le nom STRATEGY."""

from __future__ import annotations

import importlib
import pkgutil
from pathlib import Path

from .base import Strategy

PACKAGE = __package__
ROOT = Path(__file__).resolve().parent


def discover() -> dict[str, Strategy]:
    found: dict[str, Strategy] = {}
    for info in pkgutil.iter_modules([str(ROOT)]):
        if not info.ispkg:
            continue
        module = importlib.import_module(f"{PACKAGE}.{info.name}")
        candidate = getattr(module, "STRATEGY", None)
        if candidate is None:
            continue
        instance = candidate() if isinstance(candidate, type) else candidate
        if not isinstance(instance, Strategy):
            continue
        found[instance.name] = instance
    return found


def enabled(cfg) -> dict[str, Strategy]:
    out = {}
    for name, strategy in discover().items():
        scfg = cfg.strategies.get(name)
        if scfg and scfg.enabled:
            out[name] = strategy
    return out
