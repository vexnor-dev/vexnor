BEGIN TRANSACTION;

IF OBJECT_ID('vexnor_dev.account', 'U') IS NOT NULL
BEGIN
    DROP TABLE vexnor_dev.account;
END

COMMIT;
