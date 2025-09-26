BEGIN TRANSACTION;

CREATE TABLE one_sql.[order]
(
    order_id    uniqueidentifier NOT NULL DEFAULT NEWID(),
    status      varchar(20)      NOT NULL DEFAULT 'created',
    created_at  datetimeoffset   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    modified_at datetimeoffset   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    account_id  uniqueidentifier NOT NULL,

    CONSTRAINT order_pk PRIMARY KEY (order_id),
    CONSTRAINT order_account_fk FOREIGN KEY (account_id) REFERENCES one_sql.account (account_id),
    CONSTRAINT order_status_check CHECK (status IN ('created', 'paid', 'delivered', 'received'))
);

CREATE TABLE one_sql.order_item
(
    order_item_id  uniqueidentifier NOT NULL DEFAULT NEWID(),
    created_at     datetimeoffset   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    modified_at    datetimeoffset   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    order_id       uniqueidentifier NOT NULL,
    product_id     uniqueidentifier NOT NULL,
    product_price  decimal(18, 2)   NOT NULL,
    discount_price decimal(18, 2),
    quantity       int              NOT NULL,

    CONSTRAINT order_item_pk PRIMARY KEY (order_item_id),
    CONSTRAINT order_item_order_fk FOREIGN KEY (order_id) REFERENCES one_sql.[order] (order_id),
    CONSTRAINT order_item_product_fk FOREIGN KEY (product_id) REFERENCES one_sql.product (product_id)
);

COMMIT;
