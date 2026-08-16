import type { NextConfig } from "next";

const nextConfig: NextConfig = {
   serverExternalPackages: [
      "@vexnor/core",
      "@vexnor/duckdb",
      "@vexnor/postgres",
      "@vexnor/mssql",
      "@vexnor/sqlite3",
      "pg",
      "pg-native",
      "mssql",
      "better-sqlite3",
      "@duckdb/node-api",
   ],
};

export default nextConfig;
