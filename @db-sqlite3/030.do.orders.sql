CREATE TABLE "order" (
    order_id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'delivered', 'received')),
    created_at TEXT NOT NULL,
    modified_at TEXT NOT NULL,
    account_id TEXT NOT NULL,
    FOREIGN KEY (account_id) REFERENCES account (account_id)
);

CREATE TABLE order_item (
    order_item_id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
    created_at TEXT NOT NULL,
    modified_at TEXT NOT NULL,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_price REAL NOT NULL,
    discount_price REAL,
    quantity INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES "order" (order_id),
    FOREIGN KEY (product_id) REFERENCES product (product_id)
);