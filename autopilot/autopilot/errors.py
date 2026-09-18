class AutopilotError(Exception):
    """Base."""


class ConfigError(AutopilotError):
    """Configuration invalide ou manquante."""


class GuardrailViolation(AutopilotError):
    """Une action reelle a ete refusee par un garde-fou."""


class ApprovalRequired(AutopilotError):
    """Une action reelle attend une validation manuelle."""

    def __init__(self, approval_id: int, message: str):
        super().__init__(message)
        self.approval_id = approval_id
