CREATE TABLE type_coverage
(
    -- string types
    col_text        TEXT        NOT NULL,
    col_varchar     VARCHAR(255) NOT NULL,
    col_char        CHAR(10)    NOT NULL,
    -- number types
    col_integer     INTEGER     NOT NULL,
    col_int         INT         NOT NULL,
    col_tinyint     TINYINT     NOT NULL,
    col_smallint    SMALLINT    NOT NULL,
    col_bigint      BIGINT      NOT NULL,
    col_real        REAL        NOT NULL,
    col_float       FLOAT       NOT NULL,
    col_double      DOUBLE      NOT NULL,
    col_numeric     NUMERIC(10, 2),
    col_decimal     DECIMAL(10, 2),
    -- boolean
    col_boolean     BOOLEAN     NOT NULL,
    -- date/time (stored as TEXT in SQLite)
    col_date        DATE,
    col_datetime    DATETIME,
    col_timestamp   TIMESTAMP,
    -- binary
    col_blob        BLOB,

    PRIMARY KEY (col_text)
);
