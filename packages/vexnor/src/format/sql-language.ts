export type SqlLanguage =
   | "bigquery"
   | "clickhouse"
   | "db2"
   | "db2i"
   | "duckdb"
   | "hive"
   | "mariadb"
   | "mysql"
   | "n1ql"
   | "plsql"
   | "postgresql"
   | "redshift"
   | "spark"
   | "sqlite"
   | "sql"
   | "tidb"
   | "trino"
   | "transactsql"
   | "tsql"
   | "singlestoredb"
   | "snowflake";

export const SQL_LANGUAGES = new Set<string>([
   "bigquery",
   "clickhouse",
   "db2",
   "db2i",
   "duckdb",
   "hive",
   "mariadb",
   "mysql",
   "n1ql",
   "plsql",
   "postgresql",
   "redshift",
   "spark",
   "sqlite",
   "sql",
   "tidb",
   "trino",
   "transactsql",
   "tsql",
   "singlestoredb",
   "snowflake",
]);
