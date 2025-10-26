BEGIN TRANSACTION;

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'valnor_test')
BEGIN
    EXEC('CREATE SCHEMA valnor_test');
END

COMMIT;
