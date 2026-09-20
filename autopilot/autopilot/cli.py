"""Ligne de commande.

  python3 -m autopilot.cli cycle              lance un cycle complet
  python3 -m autopilot.cli dry-run [nom]      simule une strategie
  python3 -m autopilot.cli record ...         enregistre un vrai encaissement
  python3 -m autopilot.cli report             etat du Ledger
  python3 -m autopilot.cli approvals          file d'approbation
  python3 -m autopilot.cli approve <id>       valide une action reelle
  python3 -m autopilot.cli reject <id>        refuse une action reelle
  python3 -m autopilot.cli kill               coupe toute action reelle
  python3 -m autopilot.cli resume             relache le kill switch
  python3 -m autopilot.cli dashboard          demarre le poste d'observation
  python3 -m autopilot.cli strategies         liste les strategies chargees
"""

from __future__ import annotations

import argparse
import json
import sys

from . import approvals as approvals_mod
from . import memory
from .config import load
from .guardrails import killswitch
from .ledger import Ledger, connect
from .ledger.queries import cumulative_margin, daily_series, margin_by_strategy
from .orchestrator import analyze
from .orchestrator import cycle as cycle_mod
from .strategies import Context, registry


def _eur(value: float) -> str:
    return f"{value:.2f} EUR"


def cmd_cycle(args) -> int:
    summary = cycle_mod.run()
    print(f"cycle {summary['cycle']} termine, compte-rendu: {summary['journal_path']}")
    for run in summary["runs"]:
        print(f"  {run['strategy']} [{run['mode']}] marge {_eur(run['margin'])}")
        for blocked in run["actions_blocked"]:
            print(f"    bloque: {blocked}")
    pending = summary["pending_approvals"]
    print(f"  en attente de validation: {len(pending)}")
    if args.json:
        print(json.dumps(summary, ensure_ascii=False, indent=2, default=str))
    return 0


def cmd_dry_run(args) -> int:
    cfg = load()
    conn = connect()
    ledger = Ledger(conn, cfg.guardrails.fees)
    ctx = Context(conn=conn, cfg=cfg, ledger=ledger)
    found = registry.discover()
    names = [args.name] if args.name else sorted(found)
    for name in names:
        strategy = found.get(name)
        if strategy is None:
            print(f"strategie inconnue: {name}", file=sys.stderr)
            return 1
        plan = strategy.plan(ctx)
        ledger.clear_dry_run(name)
        result = strategy.dry_run(ctx)
        print(f"{name}: plan {len(plan.steps)} etapes, "
              f"revenus simules {_eur(result.revenue)}, couts {_eur(result.cost)}, "
              f"marge {_eur(result.margin)}")
        for note in result.notes:
            print(f"  note: {note}")
    conn.close()
    return 0


def cmd_record(args) -> int:
    """Ecrit un vrai mouvement d'argent au Ledger.

    Enregistrer n'est pas depenser: aucune action externe, donc aucune
    validation requise. Mais l'ecriture est en mode live, elle compte dans la
    marge reelle, et elle est tracee au journal d'audit.
    """
    cfg = load()
    conn = connect()
    ledger = Ledger(conn, cfg.guardrails.fees)

    if args.strategy not in cfg.strategies:
        print(f"strategie inconnue: {args.strategy}", file=sys.stderr)
        conn.close()
        return 1

    category = args.category or ("subscription" if args.kind == "revenue" else "other")

    if args.kind == "revenue":
        entry_id = ledger.record_revenue(
            args.strategy, args.amount, mode="live", category=category,
            note=args.note, external_ref=args.ref, day=args.day,
            apply_paypal_fee=args.paypal_fee,
        )
        print(f"encaissement #{entry_id}: {_eur(args.amount)} pour {args.strategy}")
        if args.paypal_fee:
            print(f"  frais PayPal deduits: {_eur(cfg.guardrails.fees.paypal_fee(args.amount))}")
    else:
        entry_id = ledger.record_cost(
            args.strategy, args.amount, mode="live", category=category,
            note=args.note, external_ref=args.ref, day=args.day,
        )
        print(f"cout #{entry_id}: {_eur(args.amount)} pour {args.strategy}")

    total = cumulative_margin(conn, "live")
    print(f"marge nette reelle cumulee: {_eur(total['margin'])}")
    conn.close()
    return 0


def cmd_report(args) -> int:
    cfg = load()
    conn = connect()
    for mode in ("live", "dry_run"):
        total = cumulative_margin(conn, mode)
        print(f"[{mode}] revenus {_eur(total['revenue'])}, couts {_eur(total['cost'])}, "
              f"marge {_eur(total['margin'])}")
        for row in margin_by_strategy(conn, mode):
            print(f"  {row['strategy']}: marge {_eur(row['margin'])}")
        series = daily_series(conn, mode)
        if series:
            last = series[-1]
            print(f"  dernier jour {last['day']}: cumul {_eur(last['cumulative'])}")
    test_only = frozenset(
        name for name, strategy in registry.discover().items() if strategy.manifest.test_only
    )
    verdicts = analyze(conn, cfg, test_only)
    print("verdicts:")
    for row in verdicts["strategies"]:
        print(f"  {row['strategy']}: {row['verdict']} ({row['why']})")
    mem = memory.connect()
    for c in memory.cycles(mem, limit=5):
        print(f"cycle {c['number']}: marge reelle {_eur(c['margin'] or 0)} "
              f"-> {c['journal'] or 'pas de compte-rendu'}")
    mem.close()
    conn.close()
    return 0


def cmd_approvals(args) -> int:
    conn = connect()
    rows = approvals_mod.list_by_status(conn, args.status)
    if not rows:
        print(f"aucune approbation au statut {args.status}")
    for a in rows:
        print(f"#{a['id']} {a['strategy']} [{a['kind']}] {a['summary']} "
              f"cout {_eur(a['estimated_cost'])} risque {a['risk']} ({a['created_at']})")
    conn.close()
    return 0


def cmd_approve(args) -> int:
    conn = connect()
    try:
        record = approvals_mod.approve(conn, args.id, by="simon", note=args.note)
    except (KeyError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        return 1
    print(f"#{record['id']} valide")
    conn.close()
    return 0


def cmd_reject(args) -> int:
    conn = connect()
    try:
        record = approvals_mod.reject(conn, args.id, by="simon", note=args.note)
    except (KeyError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        return 1
    print(f"#{record['id']} refuse")
    conn.close()
    return 0


def cmd_kill(args) -> int:
    cfg = load()
    conn = connect()
    killswitch.engage(conn, cfg.guardrails, by="simon")
    print("kill switch actif, aucune action reelle ne part")
    conn.close()
    return 0


def cmd_resume(args) -> int:
    cfg = load()
    conn = connect()
    killswitch.release(conn, cfg.guardrails, by="simon")
    print("kill switch relache")
    conn.close()
    return 0


def cmd_strategies(args) -> int:
    cfg = load()
    for name, strategy in sorted(registry.discover().items()):
        scfg = cfg.strategies.get(name)
        mode = scfg.mode if scfg else "non configuree"
        state = "activee" if scfg and scfg.enabled else "desactivee"
        m = strategy.manifest
        print(f"{name} [{state}, {mode}] risque {m.risk}, "
              f"mise en route {_eur(m.estimated_setup_cost)}, "
              f"mensuel {_eur(m.estimated_monthly_cost)}")
        print(f"  {m.summary}")
        if m.needs_operator:
            for need in m.needs_operator:
                print(f"  demande Simon: {need}")
    return 0


def cmd_dashboard(args) -> int:
    from .dashboard import serve

    serve(host=args.host, port=args.port)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="autopilot", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("cycle", help="lance un cycle complet")
    p.add_argument("--json", action="store_true", help="affiche le resume brut")
    p.set_defaults(func=cmd_cycle)

    p = sub.add_parser("dry-run", help="simule une strategie")
    p.add_argument("name", nargs="?", help="nom de la strategie, toutes par defaut")
    p.set_defaults(func=cmd_dry_run)

    p = sub.add_parser("record", help="enregistre un vrai mouvement d'argent")
    p.add_argument("kind", choices=["revenue", "cost"])
    p.add_argument("strategy")
    p.add_argument("amount", type=float)
    p.add_argument("--category", default=None,
                   help="sale, subscription, marketplace_fee, hosting, ads...")
    p.add_argument("--note")
    p.add_argument("--ref", help="identifiant de la transaction cote plateforme")
    p.add_argument("--day", help="AAAA-MM-JJ, aujourd'hui par defaut")
    p.add_argument("--paypal-fee", action="store_true",
                   help="deduit les frais PayPal d'un encaissement direct")
    p.set_defaults(func=cmd_record)

    p = sub.add_parser("report", help="etat du Ledger et verdicts")
    p.set_defaults(func=cmd_report)

    p = sub.add_parser("approvals", help="file d'approbation")
    p.add_argument("--status", default="pending",
                   choices=["pending", "approved", "rejected", "executed", "expired"])
    p.set_defaults(func=cmd_approvals)

    p = sub.add_parser("approve", help="valide une action reelle")
    p.add_argument("id", type=int)
    p.add_argument("--note")
    p.set_defaults(func=cmd_approve)

    p = sub.add_parser("reject", help="refuse une action reelle")
    p.add_argument("id", type=int)
    p.add_argument("--note")
    p.set_defaults(func=cmd_reject)

    p = sub.add_parser("kill", help="coupe toute action reelle")
    p.set_defaults(func=cmd_kill)

    p = sub.add_parser("resume", help="relache le kill switch")
    p.set_defaults(func=cmd_resume)

    p = sub.add_parser("strategies", help="liste les strategies chargees")
    p.set_defaults(func=cmd_strategies)

    p = sub.add_parser("dashboard", help="demarre le poste d'observation local")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8765)
    p.set_defaults(func=cmd_dashboard)

    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
