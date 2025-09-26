# MSSQL setup #

```tsql
-- Step 1: Create the server-level login with a password
CREATE LOGIN valnor_dev
    WITH PASSWORD = 'P@ssw0rd!';
GO

```

```tsql
-- 1. Switch the context to your 'valnor' database
USE valnor;
GO

-- 2. Create a database user for the existing server login.
-- This maps the 'valnor_dev' LOGIN to a 'valnor_dev' USER in this database.
CREATE USER valnor_dev FOR LOGIN valnor_dev;
GO

-- 3. (Recommended) Grant permissions to the new user.
-- By default, the new user has no permissions. A common setup for a 
-- development user is to grant read and write access.

ALTER ROLE db_datareader ADD MEMBER valnor_dev;
ALTER ROLE db_datawriter ADD MEMBER valnor_dev;
GO

```

```tsql
-- To grant full ownership permissions (use with care)
USE valnor;
GO
ALTER ROLE db_owner ADD MEMBER valnor_dev;
GO
```