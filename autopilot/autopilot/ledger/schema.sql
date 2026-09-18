-- Source de verite des revenus, des couts et de la marge nette.
-- mode distingue la simulation du reel: une marge "live" n'est jamais
-- polluee par des chiffres de dry-run.

CREATE TABLE IF NOT EXISTS entries (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    ts            TEXT    NOT NULL,          -- horodatage UTC ISO8601
    day           TEXT    NOT NULL,          -- YYYY-MM-DD, pour l'agregation
    strategy      TEXT    NOT NULL,
    kind          TEXT    NOT NULL CHECK (kind IN ('revenue', 'cost')),
    category      TEXT    NOT NULL,          -- api, hosting, ads, paypal_fee, sale...
    amount        REAL    NOT NULL CHECK (amount >= 0),
    currency      TEXT    NOT NULL DEFAULT 'EUR',
    mode          TEXT    NOT NULL CHECK (mode IN ('dry_run', 'live')),
    note          TEXT,
    external_ref  TEXT                       -- id de transaction cote plateforme
);

CREATE INDEX IF NOT EXISTS idx_entries_strategy ON entries (strategy);
CREATE INDEX IF NOT EXISTS idx_entries_day ON entries (day);
CREATE INDEX IF NOT EXISTS idx_entries_mode ON entries (mode);

-- File d'approbation des actions reelles.
CREATE TABLE IF NOT EXISTS approvals (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at     TEXT    NOT NULL,
    strategy       TEXT    NOT NULL,
    kind           TEXT    NOT NULL,         -- spend, publish, account, api_call
    summary        TEXT    NOT NULL,
    platform       TEXT,
    estimated_cost REAL    NOT NULL DEFAULT 0,
    risk           TEXT    NOT NULL DEFAULT 'low',
    payload        TEXT    NOT NULL DEFAULT '{}',
    status         TEXT    NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected', 'executed', 'expired')),
    decided_at     TEXT,
    decided_by     TEXT,
    decision_note  TEXT
);

CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals (status);

-- Etat global, dont le kill switch persistant.
CREATE TABLE IF NOT EXISTS state (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
