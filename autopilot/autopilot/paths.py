"""Emplacements sur disque. AUTOPILOT_HOME permet d'isoler les tests."""

import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def home() -> Path:
    raw = os.environ.get("AUTOPILOT_HOME")
    root = Path(raw).resolve() if raw else PROJECT_ROOT
    return root


def config_dir() -> Path:
    raw = os.environ.get("AUTOPILOT_CONFIG_DIR")
    return Path(raw).resolve() if raw else home() / "config"


def data_dir() -> Path:
    d = home() / "data"
    d.mkdir(parents=True, exist_ok=True)
    return d


def logs_dir() -> Path:
    d = home() / "logs"
    d.mkdir(parents=True, exist_ok=True)
    return d


def journal_dir() -> Path:
    d = home() / "journal"
    d.mkdir(parents=True, exist_ok=True)
    return d


def ledger_db() -> Path:
    return data_dir() / "ledger.db"


def memory_db() -> Path:
    return data_dir() / "memory.db"


def audit_log() -> Path:
    return logs_dir() / "audit.jsonl"
