BEGIN TRANSACTION;

IF OBJECT_ID('one_sql.order_item', 'U') IS NOT NULL
BEGIN
    DROP TABLE one_sql.order_item;
END

IF OBJECT_ID('one_sql.[order]', 'U') IS NOT NULL
BEGIN
    DROP TABLE one_sql.[order];
END

COMMIT;
