BEGIN TRANSACTION;

CREATE TABLE vexnor_dev.type_coverage
(
    -- string types
    col_uniqueidentifier    uniqueidentifier    NOT NULL DEFAULT NEWID(),
    col_varchar             varchar(255)        NOT NULL,
    col_nvarchar            nvarchar(255)       NOT NULL,
    col_char                char(10)            NOT NULL,
    col_nchar               nchar(10)           NOT NULL,
    col_text                text                NOT NULL,
    col_ntext               ntext               NOT NULL,
    col_xml                 xml,
    col_time                time,
    -- number types
    col_int                 int                 NOT NULL,
    col_smallint            smallint            NOT NULL,
    col_tinyint             tinyint             NOT NULL,
    col_decimal             decimal(10, 2),
    col_numeric             numeric(10, 2),
    col_float               float               NOT NULL,
    col_real                real                NOT NULL,
    col_money               money,
    col_smallmoney          smallmoney,
    -- bigint
    col_bigint              bigint              NOT NULL,
    -- boolean
    col_bit                 bit                 NOT NULL,
    -- date types
    col_date                date                NOT NULL,
    col_datetime            datetime            NOT NULL,
    col_datetime2           datetime2           NOT NULL,
    col_smalldatetime       smalldatetime       NOT NULL,
    col_datetimeoffset      datetimeoffset      NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    -- binary types
    col_binary              binary(10),
    col_varbinary           varbinary(max),
    col_image               image,

    CONSTRAINT type_coverage_pk PRIMARY KEY (col_uniqueidentifier)
);

COMMIT;
