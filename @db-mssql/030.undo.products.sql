BEGIN TRANSACTION;

IF OBJECT_ID('vexnor_dev.product', 'U') IS NOT NULL
BEGIN
    DROP TABLE vexnor_dev.product;
END

COMMIT;
