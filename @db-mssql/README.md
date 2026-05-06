# MSSQL setup #

```tsql
-- Step 1: Create the server-level login with a password
CREATE LOGIN vexnor_dev
    WITH PASSWORD = 'P@ssw0rd!';
GO

```

```tsql
-- 1. Switch the context to your 'vexnor' database
USE vexnor;
GO

-- 2. Create a database user for the existing server login.
-- This maps the 'vexnor_dev' LOGIN to a 'vexnor_dev' USER in this database.
CREATE USER vexnor_dev FOR LOGIN vexnor_dev;
GO

-- 3. (Recommended) Grant permissions to the new user.
-- By default, the new user has no permissions. A common setup for a 
-- development user is to grant read and write access.

ALTER ROLE db_datareader ADD MEMBER vexnor_dev;
ALTER ROLE db_datawriter ADD MEMBER vexnor_dev;
GO

```

```tsql
-- To grant full ownership permissions (use with care)
USE vexnor;
GO
ALTER ROLE db_owner ADD MEMBER vexnor_dev;
GO
```
