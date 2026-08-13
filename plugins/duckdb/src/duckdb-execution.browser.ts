export async function executeDuckDBQuery(): Promise<never> {
   throw new Error("Local DuckDB execution is unavailable in browser builds; use a remote client");
}
