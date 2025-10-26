BEGIN TRANSACTION;

IF OBJECT_ID('valnor_test.order_item', 'U') IS NOT NULL
BEGIN
    DROP TABLE valnor_test.order_item;
END

IF OBJECT_ID('valnor_test.[order]', 'U') IS NOT NULL
BEGIN
    DROP TABLE valnor_test.[order];
END

COMMIT;
