BEGIN TRANSACTION;

CREATE TABLE valnor_test.[order]
(
    order_id    uniqueidentifier NOT NULL DEFAULT NEWID(),
    status      varchar(20)      NOT NULL DEFAULT 'created',
    created_at  datetimeoffset   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    modified_at datetimeoffset   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    account_id  uniqueidentifier NOT NULL,

    CONSTRAINT order_pk PRIMARY KEY (order_id),
    CONSTRAINT order_account_fk FOREIGN KEY (account_id) REFERENCES valnor_test.account (account_id),
    CONSTRAINT order_status_check CHECK (status IN ('created', 'paid', 'delivered', 'received'))
);

CREATE TABLE valnor_test.order_item
(
    order_id       uniqueidentifier NOT NULL,
    product_id     uniqueidentifier NOT NULL,
    created_at     datetimeoffset   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    modified_at    datetimeoffset   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    product_price  decimal(18, 2)   NOT NULL,
    discount_price decimal(18, 2),
    quantity       int              NOT NULL,
    metadata       nvarchar(max),

    CONSTRAINT order_item_pk PRIMARY KEY (order_id, product_id),
    CONSTRAINT order_item_order_fk FOREIGN KEY (order_id) REFERENCES valnor_test.[order] (order_id),
    CONSTRAINT order_item_product_fk FOREIGN KEY (product_id) REFERENCES valnor_test.product (product_id),
    CONSTRAINT order_item_metadata_is_json CHECK (ISJSON(metadata) > 0)
);

COMMIT;
