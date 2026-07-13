import { Sql } from "#src/core/sql-base.js";
import { SqlTable, SqlTableAny } from "#src/core/schema/sql-table.js";
import { SqlTableColumnAny } from "#src/core/schema/sql-table-column.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { SqlBuildError } from "#src/core/sql-build-error.js";

/**
 * Emits no SQL text but pre-populates context.columnMap with dot-notation keys
 * from joined tables so that projection/filter/orderBy can resolve them
 * before the joinBy node runs.
 */
export class SqlPreColumnMap extends Sql {
   constructor(
      private readonly rootTable: SqlTableAny,
      private readonly joinMap: Record<string, SqlTableAny> | null,
      private readonly joinArgTables: Record<string, SqlTableAny>,
      private readonly joinKeyRegistry: Map<string, string>,
   ) {
      super({ type: "SqlPreColumnMap", id: "preColumnMap", hashId: "preColumnMap" });
   }

   write(context: SqlBuildContext): void {
      if (!context.params) return;

      // Only activate when there are actual joins to resolve
      const params = context.params as Record<string, unknown>;
      const hasJoinMap = this.joinMap && Object.keys(this.joinMap).length > 0;
      const hasJoinArgTables = Object.keys(this.joinArgTables).length > 0;
      const hasJoinByParam = !this.joinMap && params["joinBy"] != null;
      if (!hasJoinMap && !hasJoinArgTables && !hasJoinByParam) return;

      for (const [key, col] of Object.entries(this.rootTable.cols)) {
         const column = col as SqlTableColumnAny;
         const colKey = key.slice(1);
         context.addColumns({
            [colKey]: column,
            [`${this.rootTable.tableInfo.name}.${colKey}`]: column,
         });
      }

      if (this.joinMap) {
         for (const [alias, jt] of Object.entries(this.joinMap)) {
            for (const [key, col] of Object.entries(jt.cols)) {
               const column = col as SqlTableColumnAny;
               const colKey = key.slice(1);
               context.addColumns({ [`${alias}.${colKey}`]: column, [colKey]: column });
            }
         }
      }

      // Populate columns from compile-time JOIN arg tables
      for (const [alias, jt] of Object.entries(this.joinArgTables)) {
         for (const [key, col] of Object.entries(jt.cols)) {
            const column = col as SqlTableColumnAny;
            const colKey = key.slice(1);
            context.addColumns({ [`${alias}.${colKey}`]: column, [colKey]: column });
         }
      }

      // Populate columns from runtime joinBy param (with conflict detection)
      if (!this.joinMap) {
         const joinByParam = params["joinBy"];
         if (joinByParam && typeof joinByParam === "object") {
            const tableNames: string[] = Array.isArray(joinByParam)
               ? (joinByParam as { table: string }[]).map((e) => e.table)
               : Object.keys(joinByParam as Record<string, unknown>);
            for (const alias of tableNames) {
               if (this.joinKeyRegistry.has(alias)) {
                  const existing = [...this.joinKeyRegistry.entries()].map(([k, v]) => `${k}:${v}`).join(", ");
                  throw new SqlBuildError(
                     `[joinBy] Table "${alias}" conflicts with existing join key. Registered: ${existing}`,
                  );
               }
               const jt = SqlTable.resolve({
                  source: this.rootTable.source,
                  schema: this.rootTable.tableInfo.schema ?? "public",
                  table: alias,
               });
               if (!jt) continue;
               for (const [key, col] of Object.entries(jt.cols)) {
                  const column = col as SqlTableColumnAny;
                  const colKey = key.slice(1);
                  context.addColumns({ [`${alias}.${colKey}`]: column, [colKey]: column });
               }
            }
         }
      }
   }
}
