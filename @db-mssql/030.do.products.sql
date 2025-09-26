BEGIN TRANSACTION;

CREATE TABLE one_sql.product
(
    product_id   uniqueidentifier NOT NULL DEFAULT NEWID(),
    created_at   datetimeoffset   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    modified_at  datetimeoffset   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    label        varchar(255)     NOT NULL,
    price        decimal(18, 2)   NOT NULL,
    discount     decimal(18, 2)   NULL,
    is_available bit              NOT NULL DEFAULT 1,
    is_published bit              NOT NULL DEFAULT 0,

    CONSTRAINT product_pk PRIMARY KEY (product_id)
);

COMMIT;
