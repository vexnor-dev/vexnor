export function parseCallerLocation(stack: string | undefined): string | null {
   if (!stack) return null;
   const lines = stack.split("\n");
   const caller = lines.find(
      (line) =>
         line.includes("at ") &&
         !line.includes("/vexnor/") &&
         !line.includes("/vexnor-postgres/") &&
         !line.includes("/vexnor-mssql/") &&
         !line.includes("/vexnor-sqlite3/") &&
         !line.includes("/node_modules/"),
   );
   if (!caller) return null;
   const match = caller.match(/\((.+)\)$/) ?? caller.match(/at (.+)$/);
   return match?.[1]?.trim() ?? null;
}
