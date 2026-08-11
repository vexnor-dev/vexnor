CREATE TYPE account_status AS ENUM ('created', 'confirmed', 'deleted');
CREATE TYPE order_status AS ENUM ('created', 'paid', 'delivered', 'received');

CREATE TABLE account (
    account_id UUID NOT NULL DEFAULT uuid(),
    status account_status NOT NULL DEFAULT 'created',
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    modified_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    parent_id UUID,
    CONSTRAINT account_pk PRIMARY KEY (account_id),
    CONSTRAINT account_parent_fk FOREIGN KEY (parent_id) REFERENCES account (account_id)
);

CREATE INDEX idx_account_parent_id ON account (parent_id);

CREATE TABLE product (
    product_id UUID NOT NULL DEFAULT uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    modified_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    label VARCHAR(255) NOT NULL,
    price DECIMAL(18, 2) NOT NULL,
    discount DECIMAL(18, 2),
    is_available BOOLEAN NOT NULL DEFAULT true,
    is_published BOOLEAN NOT NULL DEFAULT false,
    metadata JSON,
    tags VARCHAR[],
    CONSTRAINT product_pk PRIMARY KEY (product_id),
    CONSTRAINT product_metadata_json CHECK (metadata IS NULL OR json_valid(metadata))
);

CREATE TABLE "order" (
    order_id UUID NOT NULL DEFAULT uuid(),
    status order_status NOT NULL DEFAULT 'created',
    created_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    modified_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    account_id UUID NOT NULL,
    CONSTRAINT order_pk PRIMARY KEY (order_id),
    CONSTRAINT order_account_fk FOREIGN KEY (account_id) REFERENCES account (account_id)
);

CREATE TABLE order_item (
    order_id UUID NOT NULL,
    product_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    modified_at TIMESTAMPTZ NOT NULL DEFAULT current_timestamp,
    product_price DECIMAL(18, 2) NOT NULL,
    discount_price DECIMAL(18, 2),
    quantity INTEGER NOT NULL,
    metadata JSON,
    CONSTRAINT order_item_pk PRIMARY KEY (order_id, product_id),
    CONSTRAINT order_item_order_fk FOREIGN KEY (order_id) REFERENCES "order" (order_id),
    CONSTRAINT order_item_product_fk FOREIGN KEY (product_id) REFERENCES product (product_id),
    CONSTRAINT order_item_metadata_json CHECK (metadata IS NULL OR json_valid(metadata))
);

CREATE TABLE type_coverage (
    col_uuid UUID NOT NULL DEFAULT uuid(),
    col_boolean BOOLEAN NOT NULL,
    col_tinyint TINYINT NOT NULL,
    col_smallint SMALLINT NOT NULL,
    col_integer INTEGER NOT NULL,
    col_bigint BIGINT NOT NULL,
    col_hugeint HUGEINT NOT NULL,
    col_utinyint UTINYINT NOT NULL,
    col_usmallint USMALLINT NOT NULL,
    col_uinteger UINTEGER NOT NULL,
    col_ubigint UBIGINT NOT NULL,
    col_uhugeint UHUGEINT NOT NULL,
    col_real REAL NOT NULL,
    col_double DOUBLE NOT NULL,
    col_decimal DECIMAL(18, 4) NOT NULL,
    col_varchar VARCHAR NOT NULL,
    col_char CHAR(10) NOT NULL,
    col_blob BLOB NOT NULL,
    col_bit BIT NOT NULL,
    col_date DATE NOT NULL,
    col_time TIME NOT NULL,
    col_timestamp_s TIMESTAMP_S NOT NULL,
    col_timestamp_ms TIMESTAMP_MS NOT NULL,
    col_timestamp TIMESTAMP NOT NULL,
    col_timestamp_ns TIMESTAMP_NS NOT NULL,
    col_timestamptz TIMESTAMPTZ NOT NULL,
    col_interval INTERVAL NOT NULL,
    col_json JSON NOT NULL,
    col_list INTEGER[] NOT NULL,
    col_struct STRUCT(name VARCHAR, score INTEGER) NOT NULL,
    col_map MAP(VARCHAR, INTEGER) NOT NULL,
    CONSTRAINT type_coverage_pk PRIMARY KEY (col_uuid)
);

CREATE VIEW account_order_summary AS
SELECT
    a.account_id,
    a.email,
    a.first_name,
    a.last_name,
    a.status,
    count(o.order_id) AS order_count,
    max(o.created_at) AS latest_order_at
FROM account AS a
LEFT JOIN "order" AS o ON o.account_id = a.account_id
GROUP BY a.account_id, a.email, a.first_name, a.last_name, a.status;
