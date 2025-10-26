-- SQLite doesn't have schemas, enums, or UUID type
-- Using TEXT for UUIDs and CHECK constraints for enums

CREATE TABLE account (
    account_id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'confirmed', 'deleted')),
    email TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    modified_at TEXT NOT NULL DEFAULT (datetime('now')),
    parent_id TEXT,
    FOREIGN KEY (parent_id) REFERENCES account (account_id) ON DELETE SET NULL
);

CREATE INDEX idx_account_parent_id ON account (parent_id);