BEGIN TRANSACTION;

IF OBJECT_ID('vexnor_dev.order_item', 'U') IS NOT NULL
BEGIN
    DROP TABLE vexnor_dev.order_item;
END

IF OBJECT_ID('vexnor_dev.[order]', 'U') IS NOT NULL
BEGIN
    DROP TABLE vexnor_dev.[order];
END

COMMIT;
