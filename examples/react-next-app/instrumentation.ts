export async function register() {
   if (process.env.NEXT_RUNTIME === "nodejs") {
      await import("vexnor-postgres");
      await import("vexnor-mssql");
      await import("vexnor-sqlite3");
   }
}
