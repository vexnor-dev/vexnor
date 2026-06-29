import { ROW, Sql, TYPE, TypeOf } from "#src/core/sql-base.js";
import { InferSelectRowByResult } from "#src/core/query/sql-query-types.js";
import { SqlQueryAny } from "#src/core/query/sql-query.js";
import { SqlSelectAll } from "#src/core/query/sql-select-all.js";
import { SqlTableColumn } from "#src/core/schema/sql-table-column.js";
import { newSqlQueryColumn, SqlQueryColumn } from "#src/core/query/sql-query-column.js";
import { SqlBuildError } from "#src/core/sql-build-error.js";
import { SqlTableAll } from "#src/core/charms/sql-table-all.js";
import { SqlSelectValue } from "#src/core/query/sql-select-value.js";
import { SqlSelectColumn } from "#src/core/query/sql-select-column.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { SqlBuildOptions } from "#src/core/builder/sql-build-options.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlSelectRowAny = SqlSelectRow<any>;

export class SqlSelectRow<T extends { Row: Record<string, unknown> }> extends Sql {
   declare readonly [ROW]: T["Row"];
   declare readonly [TYPE]: T["Row"];

   readonly rowsByQueryId = new Map<string, InferSelectRowByResult<T["Row"]>>();

   constructor(public readonly columns: Array<Sql>) {
      super({
         type: "SqlSelectRow",
         id: `${columns.map((col) => col.toString()).join(", ")}`,
         hashId: columns.map((col) => col.hashId).join(","),
      });
   }

   getRow({
      query,
      columns = this.columns,
   }: {
      columns?: Array<Sql>;
      query: SqlQueryAny;
   }): InferSelectRowByResult<T["Row"]> {
      if (this.rowsByQueryId.has(query.id)) {
         return this.rowsByQueryId.get(query.id) as InferSelectRowByResult<T["Row"]>;
      }

      let row: Partial<InferSelectRowByResult<T["Row"]>> = {};
      for (const item of columns) {
         switch (true) {
            case item instanceof SqlSelectAll:
               if (!item.row) break;

               for (const col of Object.values(item.row)) {
                  switch (true) {
                     case col instanceof SqlTableColumn:
                        row = {
                           ...(row ?? {}),
                           [`$${col.key}`]: newSqlQueryColumn({
                              key: col.key,
                              target: col,
                              query: query,
                           }),
                        };
                        break;
                     case col instanceof SqlQueryColumn:
                        row = {
                           ...(row ?? {}),
                           [`$${col.key}`]: newSqlQueryColumn({
                              key: col.key,
                              target: col,
                              query: query,
                           }),
                        };
                        break;
                     default:
                        throw new SqlBuildError(`Invalid column type '${col}'.`);
                  }
               }
               break;
            case item instanceof SqlTableAll:
               if (!item.row) break;

               for (const col of Object.values(item.row)) {
                  row = {
                     ...(row ?? {}),
                     [`$${col.key}`]: newSqlQueryColumn({
                        key: col.key,
                        target: col,
                        query: query,
                     }),
                  };
               }
               break;
            case item instanceof SqlTableColumn:
               row = {
                  ...(row ?? {}),
                  [`$${item.key}`]: newSqlQueryColumn({
                     key: item.key,
                     target: item,
                     query: query,
                  }),
               };
               break;
            case item instanceof SqlQueryColumn:
               row = {
                  ...(row ?? {}),
                  [`$${item.key}`]: newSqlQueryColumn({
                     key: item.key,
                     target: item,
                     query: query,
                  }),
               };
               break;
            case item instanceof SqlSelectValue:
               row = {
                  ...(row ?? {}),
                  [`$${item.key}`]: newSqlQueryColumn({
                     key: item.key,
                     target: item,
                     query: query,
                  }),
               };
               break;
            case item instanceof SqlSelectColumn:
               row = {
                  ...(row ?? {}),
                  [`$${item.key}`]: newSqlQueryColumn({
                     key: item.key,
                     target: item,
                     query: query,
                  }),
               };
               break;
            default:
               throw new SqlBuildError(`Invalid column type '${item}'.`);
         }
      }

      return row as InferSelectRowByResult<T["Row"]>;
   }

   write(context: SqlBuildContext, options?: SqlBuildOptions): void {
      for (let i = 0; i < this.columns.length; i++) {
         const col = this.columns[i]!;
         if (i > 0) {
            context.addStrings(", ");
         }

         col.build(context, options);
      }
   }
}

/**
 * Declares the columns to SELECT and registers them for result type inference.
 *
 * Pass one or more column references — from a table (`Table.$col`, `Table.$$`),
 * a subquery (`Subquery.row.$col`), or a computed value (`val`...`) — and the
 * query result type will be inferred as the intersection of all their types.
 *
 * Must be used inside a `sql` template literal in the SELECT position.
 *
 * @param columns - One or more column or value references to select.
 * @returns A `SqlSelectRow` node that emits the column list and carries the inferred row type.
 *
 * @example
 * // All columns from a table
 * sql`SELECT ${row(Account.$$)} FROM ${Account}`
 * // result: IAccountSelect
 *
 * @example
 * // Specific columns
 * sql`SELECT ${row(Account.$firstName, Account.$email)} FROM ${Account}`
 * // result: { firstName: string; email: string }
 *
 * @example
 * // With alias
 * sql`SELECT ${row(Account.$firstName.as("name"))} FROM ${Account}`
 * // result: { name: string }
 *
 * @example
 * // Mixing table columns and a computed value
 * sql`
 *   SELECT ${row(
 *     Account.$accountId,
 *     val`COUNT(*)`.as<{ total: number }>("total")
 *   )}
 *   FROM ${Account}
 *   GROUP BY ${Account.$accountId}
 * `
 * // result: { accountId: string; total: number }
 */
export function row<Column extends Sql, Columns extends Column[]>(
   ...columns: Columns
): SqlSelectRow<{ Row: InferResultRowFromColumns<typeof columns> }> {
   return new SqlSelectRow(columns);
}

export type InferResultRowFromColumns<T> = T extends [infer Start, ...infer Rest]
   ? Start extends Sql
      ? TypeOf<Start> & InferResultRowFromColumns<Rest>
      : InferResultRowFromColumns<Rest>
   : // eslint-disable-next-line @typescript-eslint/no-empty-object-type
     {};
