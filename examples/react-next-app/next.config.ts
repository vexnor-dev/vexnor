import type { NextConfig } from "next";

const nextConfig: NextConfig = {
   serverExternalPackages: ["vexnor", "vexnor-postgres", "vexnor-mssql", "vexnor-sqlite3", "pg", "pg-native", "mssql", "better-sqlite3"],
};

export default nextConfig;
