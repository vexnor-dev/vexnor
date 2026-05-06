BEGIN TRANSACTION;

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'vexnor_dev')
BEGIN
    EXEC('CREATE SCHEMA vexnor_dev');
END

COMMIT;
