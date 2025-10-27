CREATE TABLE "order" (
    order_id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'delivered', 'received')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    modified_at TEXT NOT NULL DEFAULT (datetime('now')),
    account_id TEXT NOT NULL,
    FOREIGN KEY (account_id) REFERENCES account (account_id)
);