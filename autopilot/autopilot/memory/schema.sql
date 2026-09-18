-- Memoire d'agent: ce qui a ete tente, le resultat, la lecon.
-- Empeche de relancer deux fois la meme hypothese morte.

CREATE TABLE IF NOT EXISTS attempts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  TEXT NOT NULL,
    cycle       INTEGER NOT NULL,
    strategy    TEXT NOT NULL,
    hypothesis  TEXT NOT NULL,
    outcome     TEXT NOT NULL CHECK (outcome IN ('pending', 'win', 'loss', 'inconclusive', 'killed')),
    margin      REAL,
    lesson      TEXT
);

CREATE INDEX IF NOT EXISTS idx_attempts_strategy ON attempts (strategy);

CREATE TABLE IF NOT EXISTS cycles (
    number      INTEGER PRIMARY KEY,
    started_at  TEXT NOT NULL,
    ended_at    TEXT,
    margin      REAL,
    journal     TEXT
);
