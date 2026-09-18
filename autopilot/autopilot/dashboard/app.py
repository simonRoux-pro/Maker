"""Dashboard local. Bibliotheque standard uniquement, aucune dependance.

Sert une page unique et une petite API JSON. Ecoute sur 127.0.0.1 par defaut:
ce poste d'observation n'est pas expose au reseau.

  python3 -m autopilot.cli dashboard
"""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from .. import approvals, memory
from ..audit import read_tail
from ..config import load
from ..guardrails import budget, killswitch
from ..ledger import connect
from ..ledger.queries import cumulative_margin, daily_series, margin_by_strategy
from ..orchestrator import analyze
from ..strategies import registry

TEMPLATE = Path(__file__).parent / "templates" / "index.html"


def snapshot() -> dict:
    cfg = load()
    conn = connect()
    mem = memory.connect()
    try:
        strategies = []
        discovered = registry.discover()
        for name, strategy in sorted(discovered.items()):
            scfg = cfg.strategies.get(name)
            strategies.append(
                {
                    "name": name,
                    "mode": scfg.mode if scfg else "non configuree",
                    "enabled": bool(scfg and scfg.enabled),
                    "manifest": strategy.manifest.as_dict(),
                }
            )
        return {
            "killswitch": {
                "active": killswitch.is_active(conn, cfg.guardrails),
                "reason": killswitch.reason(conn, cfg.guardrails),
            },
            "totals": {
                "live": cumulative_margin(conn, "live"),
                "dry_run": cumulative_margin(conn, "dry_run"),
            },
            "by_strategy": {
                "live": margin_by_strategy(conn, "live"),
                "dry_run": margin_by_strategy(conn, "dry_run"),
            },
            "series": {
                "live": daily_series(conn, "live"),
                "dry_run": daily_series(conn, "dry_run"),
            },
            "budget": {
                "max_total": cfg.guardrails.budget.max_total,
                "max_daily": cfg.guardrails.budget.max_daily,
                "max_per_strategy": cfg.guardrails.budget.max_per_strategy,
                "remaining": budget.remaining(conn, cfg),
            },
            "allowlist": {
                "platforms": list(cfg.guardrails.allowlist.platforms),
                "apis": list(cfg.guardrails.allowlist.apis),
            },
            "approvals": {
                "pending": approvals.list_by_status(conn, "pending"),
                "recent": approvals.list_all(conn, limit=20),
            },
            "strategies": strategies,
            "analysis": analyze(conn, cfg),
            "cycles": memory.cycles(mem, limit=10),
            "audit": read_tail(30)[::-1],
        }
    finally:
        conn.close()
        mem.close()


class Handler(BaseHTTPRequestHandler):
    server_version = "autopilot"

    def log_message(self, fmt, *args):  # silence les logs par requete
        pass

    # ------------------------------------------------------------------ GET

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/":
            self._html(TEMPLATE.read_text(encoding="utf-8"))
        elif path == "/api/state":
            self._json(snapshot())
        else:
            self._json({"error": "route inconnue"}, status=404)

    # ------------------------------------------------------------------ POST

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        body = self._body()
        cfg = load()
        conn = connect()
        try:
            parts = [p for p in path.split("/") if p]
            if parts[:2] == ["api", "approvals"] and len(parts) == 4:
                approval_id = int(parts[2])
                verb = parts[3]
                note = body.get("note")
                if verb == "approve":
                    record = approvals.approve(conn, approval_id, by="simon", note=note)
                elif verb == "reject":
                    record = approvals.reject(conn, approval_id, by="simon", note=note)
                else:
                    return self._json({"error": "verbe inconnu"}, status=404)
                return self._json({"approval": record})

            if path == "/api/killswitch":
                if body.get("active"):
                    killswitch.engage(conn, cfg.guardrails, by="simon")
                else:
                    killswitch.release(conn, cfg.guardrails, by="simon")
                return self._json(
                    {"active": killswitch.is_active(conn, cfg.guardrails)}
                )

            if path == "/api/cycle":
                from ..orchestrator import cycle as cycle_mod

                summary = cycle_mod.run(cfg)
                return self._json(
                    {
                        "cycle": summary["cycle"],
                        "journal_path": summary["journal_path"],
                        "runs": summary["runs"],
                    }
                )

            self._json({"error": "route inconnue"}, status=404)
        except (KeyError, ValueError) as exc:
            self._json({"error": str(exc)}, status=400)
        finally:
            conn.close()

    # ------------------------------------------------------------------ utils

    def _body(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        try:
            return json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            return {}

    def _json(self, payload: dict, status: int = 200) -> None:
        raw = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _html(self, text: str) -> None:
        raw = text.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


def serve(host: str = "127.0.0.1", port: int = 8765) -> None:
    httpd = ThreadingHTTPServer((host, port), Handler)
    print(f"dashboard sur http://{host}:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
