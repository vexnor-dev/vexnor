BEGIN TRANSACTION;

IF EXISTS (SELECT * FROM sys.schemas WHERE name = 'vexnor_dev')
BEGIN
    DROP SCHEMA vexnor_dev;
END

COMMIT;
