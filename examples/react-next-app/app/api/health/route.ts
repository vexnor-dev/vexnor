import { pgPool } from "@/shared/db/postgres";
import { getMssqlPool } from "@/shared/db/mssql";
import { sqliteDb } from "@/shared/db/sqlite3";
import { getDuckDb } from "@/shared/db/duckdb";

export async function GET() {
   const checks: Record<string, string> = {};

   try {
      await pgPool.query("SELECT 1");
      checks.postgres = "ok";
   } catch (err) {
      checks.postgres = err instanceof Error ? err.message : String(err);
   }

   try {
      const pool = await getMssqlPool();
      await pool.request().query("SELECT 1");
      checks.mssql = "ok";
   } catch (err) {
      checks.mssql = err instanceof Error ? err.message : String(err);
   }

   try {
      sqliteDb.prepare("SELECT 1").get();
      checks.sqlite3 = "ok";
   } catch (err) {
      checks.sqlite3 = err instanceof Error ? err.message : String(err);
   }

   try {
      await (await getDuckDb()).run("SELECT 1");
      checks.duckdb = "ok";
   } catch (err) {
      checks.duckdb = err instanceof Error ? err.message : String(err);
   }

   const allOk = Object.values(checks).every((v) => v === "ok");
   return Response.json(
      { status: allOk ? "ok" : "degraded", databases: checks },
      { status: allOk ? 200 : 503 },
   );
}
