BEGIN TRANSACTION;

IF OBJECT_ID('valnor_test.account', 'U') IS NOT NULL
BEGIN
    DROP TABLE valnor_test.account;
END

COMMIT;
