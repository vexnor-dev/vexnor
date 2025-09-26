BEGIN TRANSACTION;

IF OBJECT_ID('one_sql.product', 'U') IS NOT NULL
BEGIN
    DROP TABLE one_sql.product;
END

COMMIT;
