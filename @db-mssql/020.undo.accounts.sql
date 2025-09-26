BEGIN TRANSACTION;

IF OBJECT_ID('one_sql.account', 'U') IS NOT NULL
BEGIN
    DROP TABLE one_sql.account;
END

COMMIT;
