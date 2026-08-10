#!/usr/bin/env bash
set -euo pipefail

# Bootstrap MSSQL: create the vexnor database and vexnor_dev login/user.
# Idempotent — safe to run multiple times.
# Requires: docker compose services running (mssql healthy).

MSSQL_SA_PASSWORD="${MSSQL_SA_PASSWORD:-P@ssw0rd!}"
MSSQL_DATABASE="${MSSQL_DATABASE:-vexnor}"
MSSQL_USER="${MSSQL_USER:-vexnor_dev}"
MSSQL_PASSWORD="${MSSQL_PASSWORD:-P@ssw0rd!}"

SQLCMD="/opt/mssql-tools18/bin/sqlcmd"
SQLCMD_ARGS="-S localhost -U sa -P ${MSSQL_SA_PASSWORD} -C -b"

echo "Bootstrapping MSSQL: creating database [${MSSQL_DATABASE}] and login [${MSSQL_USER}]..."

docker compose exec -T mssql ${SQLCMD} ${SQLCMD_ARGS} -Q "
  IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = '${MSSQL_DATABASE}')
    CREATE DATABASE [${MSSQL_DATABASE}];
  IF NOT EXISTS (SELECT name FROM sys.server_principals WHERE name = '${MSSQL_USER}')
    CREATE LOGIN [${MSSQL_USER}] WITH PASSWORD = '${MSSQL_PASSWORD}';
"

docker compose exec -T mssql ${SQLCMD} ${SQLCMD_ARGS} -d "${MSSQL_DATABASE}" -Q "
  IF NOT EXISTS (SELECT name FROM sys.database_principals WHERE name = '${MSSQL_USER}')
  BEGIN
    CREATE USER [${MSSQL_USER}] FOR LOGIN [${MSSQL_USER}];
    ALTER ROLE db_owner ADD MEMBER [${MSSQL_USER}];
  END
"

echo "MSSQL bootstrap complete: database [${MSSQL_DATABASE}], user [${MSSQL_USER}] ready."
