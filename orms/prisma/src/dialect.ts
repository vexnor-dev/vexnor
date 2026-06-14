const dialectByPrismaProvider: Record<string, string> = {
   postgresql: "postgresql",
   postgres: "postgresql",
   cockroachdb: "postgresql",
   mysql: "mysql",
   mariadb: "mariadb",
   sqlserver: "tsql",
   sqlite: "sqlite",
};

export function getDialectFromPrismaProvider(provider: string): string {
   return dialectByPrismaProvider[provider] ?? "sql";
}
