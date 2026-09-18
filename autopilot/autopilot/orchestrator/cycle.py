"""Un cycle complet.

1. expiration des vieilles approbations
2. pour chaque strategie activee: plan, dry-run, puis execute si mode live
3. lecture du Ledger et verdicts
4. propositions pour le cycle suivant
5. ecriture du compte-rendu et de la memoire
"""

from __future__ import annotations

from datetime import date

from .. import approvals, memory
from ..audit import log
from ..config import Config, load
from ..guardrails import killswitch
from ..ledger import Ledger, connect
from ..ledger.queries import cumulative_margin
from ..strategies import Context, registry
from . import journal
from .analyze import PROMOTE, analyze
from .propose import propose


def run(cfg: Config | None = None, *, day: str | None = None) -> dict:
    cfg = cfg or load()
    conn = connect()
    mem = memory.connect()
    today = day or date.today().isoformat()

    cycle = memory.next_cycle_number(mem)
    memory.start_cycle(mem, cycle)
    log("cycle.start", cycle=cycle, day=today)

    approvals.expire_older_than(conn, days=7)

    ledger = Ledger(conn, cfg.guardrails.fees)
    ctx = Context(conn=conn, cfg=cfg, ledger=ledger, day=today)

    runs = []
    plans = []
    operator_tasks = []
    for name, strategy in registry.enabled(cfg).items():
        for task in strategy.manifest.needs_operator:
            operator_tasks.append({"strategy": name, "task": task})
        plans.append(strategy.plan(ctx).as_dict())

        # la simulation est rejouee a neuf a chaque cycle, sinon elle s'empile
        ledger.clear_dry_run(name)
        dry = strategy.dry_run(ctx)
        runs.append(dry.as_dict())

        scfg = cfg.strategies[name]
        if scfg.is_live:
            if killswitch.is_active(conn, cfg.guardrails):
                log("cycle.execute_skipped", cycle=cycle, strategy=name,
                    reason="kill switch actif")
            else:
                runs.append(strategy.execute(ctx).as_dict())

        memory.record_attempt(
            mem,
            cycle=cycle,
            strategy=name,
            hypothesis=f"{name}:{scfg.mode}:{today}",
            outcome="pending" if scfg.mode == "dry_run" else "inconclusive",
            margin=dry.margin,
            lesson=None,
        )

    test_only = frozenset(
        name for name, strategy in registry.discover().items() if strategy.manifest.test_only
    )
    analysis = analyze(conn, cfg, test_only)
    proposals = propose(mem, analysis)
    pending = approvals.list_by_status(conn, "pending")

    summary = {
        "cycle": cycle,
        "day": today,
        "plans": plans,
        "runs": runs,
        "analysis": analysis,
        "proposals": proposals,
        "pending_approvals": pending,
        "operator_tasks": operator_tasks,
        "killswitch": killswitch.is_active(conn, cfg.guardrails),
    }

    path = journal.write(cycle, summary)
    summary["journal_path"] = str(path)

    live_margin = cumulative_margin(conn, "live")["margin"]
    memory.end_cycle(mem, cycle, live_margin, str(path))
    log("cycle.end", cycle=cycle, live_margin=live_margin,
        proposals=len(proposals), pending=len(pending),
        operator_tasks=len(operator_tasks))

    conn.close()
    mem.close()
    return summary


def promote_candidates(analysis: dict) -> list[str]:
    """Strategies dont la simulation justifie un passage en reel. Le passage
    lui-meme reste une decision de l'operateur."""
    return [r["strategy"] for r in analysis["strategies"] if r["verdict"] == PROMOTE]
