"""Refus par defaut. Une plateforme ou une API absente de la liste blanche est
refusee, meme si la strategie insiste."""

from __future__ import annotations

from ..config import Guardrails


def check(guardrails: Guardrails, *, platform: str | None, api: str | None) -> str | None:
    """Retourne un motif de refus, ou None si tout est autorise."""
    if platform and not guardrails.allowlist.allows_platform(platform):
        return f"plateforme non autorisee: {platform}"
    if api and not guardrails.allowlist.allows_api(api):
        return f"api non autorisee: {api}"
    return None
