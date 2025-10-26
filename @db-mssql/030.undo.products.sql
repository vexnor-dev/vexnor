BEGIN TRANSACTION;

IF OBJECT_ID('valnor_test.product', 'U') IS NOT NULL
BEGIN
    DROP TABLE valnor_test.product;
END

COMMIT;
