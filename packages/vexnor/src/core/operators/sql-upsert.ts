import { PARAMS, Sql, SqlOptions } from "#/core/sql-base.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { SqlTableAny } from "#/core/schema/sql-table.js";
import { SqlTableColumnAny } from "#/core/schema/sql-table-column.js";
import { BuildSqlParams, PathToNested, SqlParam } from "#/core/query/sql-param.js";
import { SqlBuildError } from "#/core/sql-build-error.js";
import { resolvePath } from "#/core/query/resolve-path.js";
import { isPrimitive } from "#/lib/primitive.js";

export type SqlUpsertTypeArgs = { Select: Record<string, unknown>; Insert: Record<string, unknown> };

/**
 * Portable upsert operator. Emits dialect-specific UPSERT SQL at build time:
 * - PostgreSQL/SQLite: INSERT ... ON CONFLICT (keys) DO UPDATE SET col = EXCLUDED.col
 * - MSSQL: MERGE INTO ... USING (VALUES ...) AS src(cols) ON (...) WHEN MATCHED ... WHEN NOT MATCHED ...
 *
 * When params are null (serialization mode), emits an operator token for cross-runtime execution.
 */
export class SqlUpsert<T extends SqlUpsertTypeArgs, ParamName extends string> extends Sql {
   declare readonly [PARAMS]: PathToNested<ParamName, T["Insert"][]>;

   readonly table: SqlTableAny;
   readonly paramName: ParamName;
   readonly conflictKeys: string[];
   readonly params: BuildSqlParams<PathToNested<ParamName, T["Insert"][]>>;

   constructor(table: SqlTableAny, conflictKeys: string[], paramName: ParamName) {
      super({
         type: "SqlUpsert",
         id: `${table.tableInfo.name}.${paramName}.upsert`,
         hashId: `${table.hashId}|upsert:${paramName}:${conflictKeys.join(",")}`,
      } satisfies SqlOptions);

      this.table = table;
      this.paramName = paramName;
      this.conflictKeys = conflictKeys;
      this.params = {
         [paramName]: new SqlParam({ name: paramName, validation: null }),
      } as BuildSqlParams<PathToNested<ParamName, T["Insert"][]>>;
   }

   write(context: SqlBuildContext): void {
      if (!context.params) {
         context.addOperator({
            type: "upsert",
            param: this.paramName,
            columns: getColumnMap(this.table),
            conflictKeys: this.conflictKeys,
         });
         return;
      }

      const rows = resolvePath(context.params as Record<string, unknown>, this.paramName) as Record<string, unknown>[] | null | undefined;
      if (!rows?.length) return;

      const dialect = context.dialect;
      if (dialect === "transactsql") {
         this.writeMssql(context, rows);
      } else {
         this.writePostgresOrSqlite(context, rows);
      }
   }

   private writePostgresOrSqlite(context: SqlBuildContext, rows: Record<string, unknown>[]): void {
      const keys = this.getCanonicalKeys(rows);
      const conflictColNames = this.getConflictColumnNames();

      // (col1, col2, ...)
      context.addStrings("(");
      for (let i = 0; i < keys.length; i++) {
         if (i > 0) context.addStrings(", ");
         const col = this.table.cols[`$${keys[i]}` as `$${string}`] as SqlTableColumnAny;
         context.addQuotes(col.columnName);
      }
      context.addStrings(") values ");

      // VALUES tuples
      for (let r = 0; r < rows.length; r++) {
         if (r > 0) context.addStrings(", ");
         context.addStrings("(");
         for (let i = 0; i < keys.length; i++) {
            if (i > 0) context.addStrings(", ");
            const value = rows[r]![keys[i]!];
            if (!isPrimitive(value)) throw new SqlBuildError(`Value is not a primitive: ${String(value)}`);
            context.addValues(value);
         }
         context.addStrings(")");
      }

      // ON CONFLICT (pk) DO UPDATE SET col = EXCLUDED.col
      context.addStrings(" on conflict (");
      for (let i = 0; i < this.conflictKeys.length; i++) {
         if (i > 0) context.addStrings(", ");
         const col = this.table.cols[`$${this.conflictKeys[i]}` as `$${string}`] as SqlTableColumnAny;
         context.addQuotes(col.columnName);
      }
      context.addStrings(") do update set ");

      let emitted = 0;
      for (const key of keys) {
         if (conflictColNames.has(this.table.cols[`$${key}` as `$${string}`]!.columnName)) continue;
         if (emitted > 0) context.addStrings(", ");
         const col = this.table.cols[`$${key}` as `$${string}`] as SqlTableColumnAny;
         context.addQuotes(col.columnName);
         context.addStrings(` = excluded.`);
         context.addQuotes(col.columnName);
         emitted++;
      }
   }

   private writeMssql(context: SqlBuildContext, rows: Record<string, unknown>[]): void {
      const keys = this.getCanonicalKeys(rows);
      const conflictColNames = this.getConflictColumnNames();

      // USING (VALUES (...)) AS src("col1", "col2")
      context.addStrings("using (values ");
      for (let r = 0; r < rows.length; r++) {
         if (r > 0) context.addStrings(", ");
         context.addStrings("(");
         for (let i = 0; i < keys.length; i++) {
            if (i > 0) context.addStrings(", ");
            const value = rows[r]![keys[i]!];
            if (!isPrimitive(value)) throw new SqlBuildError(`Value is not a primitive: ${String(value)}`);
            context.addValues(value);
         }
         context.addStrings(")");
      }
      context.addStrings(`) as src(`);
      for (let i = 0; i < keys.length; i++) {
         if (i > 0) context.addStrings(", ");
         const col = this.table.cols[`$${keys[i]}` as `$${string}`] as SqlTableColumnAny;
         context.addQuotes(col.columnName);
      }
      context.addStrings(") on (");

      // ON clause: table."pk" = src."pk"
      for (let i = 0; i < this.conflictKeys.length; i++) {
         if (i > 0) context.addStrings(" and ");
         const col = this.table.cols[`$${this.conflictKeys[i]}` as `$${string}`] as SqlTableColumnAny;
         const tableName = this.table.tableInfo.name;
         context.addStrings(`"${tableName}".`);
         context.addQuotes(col.columnName);
         context.addStrings(` = src.`);
         context.addQuotes(col.columnName);
      }
      context.addStrings(") when matched then update set ");

      // SET col = src.col (non-conflict keys only)
      let emitted = 0;
      for (const key of keys) {
         if (conflictColNames.has(this.table.cols[`$${key}` as `$${string}`]!.columnName)) continue;
         if (emitted > 0) context.addStrings(", ");
         const col = this.table.cols[`$${key}` as `$${string}`] as SqlTableColumnAny;
         context.addQuotes(col.columnName);
         context.addStrings(` = src.`);
         context.addQuotes(col.columnName);
         emitted++;
      }

      // WHEN NOT MATCHED THEN INSERT (cols) VALUES (src.cols)
      context.addStrings(" when not matched then insert (");
      for (let i = 0; i < keys.length; i++) {
         if (i > 0) context.addStrings(", ");
         const col = this.table.cols[`$${keys[i]}` as `$${string}`] as SqlTableColumnAny;
         context.addQuotes(col.columnName);
      }
      context.addStrings(") values (");
      for (let i = 0; i < keys.length; i++) {
         if (i > 0) context.addStrings(", ");
         const col = this.table.cols[`$${keys[i]}` as `$${string}`] as SqlTableColumnAny;
         context.addStrings(`src.`);
         context.addQuotes(col.columnName);
      }
      context.addStrings(")");
   }

   private getCanonicalKeys(rows: Record<string, unknown>[]): string[] {
      const insertKeySet = new Set(Object.keys(rows[0]!));
      return Object.keys(this.table.cols).map((k) => k.slice(1)).filter((k) => insertKeySet.has(k));
   }

   private getConflictColumnNames(): Set<string> {
      return new Set(this.conflictKeys.map((k) => {
         const col = this.table.cols[`$${k}` as `$${string}`] as SqlTableColumnAny;
         return col.columnName;
      }));
   }
}

function getColumnMap(table: SqlTableAny): Record<string, string> {
   const map: Record<string, string> = {};
   for (const [key, col] of Object.entries(table.cols)) {
      const column = col as SqlTableColumnAny;
      map[key.slice(1)] = `"${column.columnName}"`;
   }
   return map;
}

/**
 * Creates a portable upsert operator.
 *
 * @param table - The table to upsert into
 * @param conflictKeys - JS property keys of columns forming the conflict target (e.g., ["accountId"])
 * @param paramName - The param name containing the rows (default: "rows")
 */
export function upsert<T extends SqlUpsertTypeArgs, ParamName extends string = "rows">(
   table: SqlTableAny,
   conflictKeys: string[],
   paramName?: ParamName,
): SqlUpsert<T, ParamName> {
   return new SqlUpsert<T, ParamName>(table, conflictKeys, (paramName ?? "rows") as ParamName);
}
