const dialectByTypeOrmType: Record<string, string> = {
   postgres: "postgresql",
   cockroachdb: "postgresql",
   "aurora-postgres": "postgresql",
   mssql: "tsql",
   sqlite: "sqlite",
   "better-sqlite3": "sqlite",
   sqljs: "sqlite",
   capacitor: "sqlite",
   cordova: "sqlite",
   "react-native": "sqlite",
   expo: "sqlite",
   mysql: "mysql",
   mariadb: "mariadb",
   "aurora-mysql": "mysql",
};

export function getDialect(typeOrmType: string): string {
   return dialectByTypeOrmType[typeOrmType] ?? "sql";
}
