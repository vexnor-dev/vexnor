BEGIN TRANSACTION;

IF EXISTS (SELECT * FROM sys.schemas WHERE name = 'valnor_test')
BEGIN
    DROP SCHEMA valnor_test;
END

COMMIT;
