CREATE TABLE order_item (
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    modified_at TEXT NOT NULL DEFAULT (datetime('now')),
    product_price REAL NOT NULL,
    discount_price REAL,
    quantity INTEGER NOT NULL,
    metadata TEXT,
    PRIMARY KEY (order_id, product_id),
    FOREIGN KEY (order_id) REFERENCES "order" (order_id),
    FOREIGN KEY (product_id) REFERENCES product (product_id),
    CONSTRAINT order_item_metadata_is_json CHECK (json_valid(metadata))
);