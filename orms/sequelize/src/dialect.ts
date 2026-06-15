const dialectBySequelizeDialect: Record<string, string> = {
   postgres: "postgresql",
   mssql: "tsql",
   sqlite: "sqlite",
   mysql: "mysql",
   mariadb: "mariadb",
   db2: "db2",
   ibmi: "ibmi",
   snowflake: "snowflake",
};

export function getDialect(sequelizeDialect: string): string {
   return dialectBySequelizeDialect[sequelizeDialect] ?? "sql";
}
