import mssql from "mssql";

let _pool: mssql.ConnectionPool | null = null;

export async function getMssqlPool(): Promise<mssql.ConnectionPool> {
   if (!_pool) {
      _pool = await mssql.connect({
         server: process.env.MSSQL_HOST ?? "localhost",
         port: Number(process.env.MSSQL_PORT ?? 1433),
         database: process.env.MSSQL_DATABASE ?? "vexnor",
         user: process.env.MSSQL_USER ?? "vexnor_dev",
         password: process.env.MSSQL_PASSWORD ?? "P@ssw0rd!",
         options: { trustServerCertificate: true },
      });
   }
   return _pool;
}
