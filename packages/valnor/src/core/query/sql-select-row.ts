import { ROW, Sql, TYPE, TypeOf } from "../sql-base.js";
import { SqlTableColumn } from "../schema/index.js";
import { SqlSelectValue } from "./sql-select-value.js";
import { newSqlSelectColumn, SqlQueryColumn } from "./sql-query-column.js";
import { SqlTableAll } from "../charms/index.js";
import { SqlSelectAll } from "./sql-select-all.js";
import { InferSelectRowByResult, SqlBuildOptions } from "./sql-query-types.js";
import { SqlBuildError } from "../sql-build-error.js";
import { SqlQueryAny } from "./sql-query.js";
import { SqlBuildContext } from "./sql-build-context.js";
import { SqlSelectColumn } from "./sql-select-column.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlSelectRowAny = SqlSelectRow<any>;

export class SqlSelectRow<T extends { Row: Record<string, unknown> }> extends Sql {
   declare readonly [ROW]: T["Row"];
   declare readonly [TYPE]: T["Row"];

   readonly rowsByQueryId = new Map<string, InferSelectRowByResult<T["Row"]>>();

   constructor(public readonly columns: Array<Sql>) {
      super({
         id: `${columns
            .map((col) => {
               return col.toString();
            })
            .join(", ")}`,
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
                           [`$${col.key}`]: newSqlSelectColumn({
                              key: col.key,
                              target: col,
                              query,
                           }),
                        };
                        break;
                     case col instanceof SqlQueryColumn:
                        row = {
                           ...(row ?? {}),
                           [`$${col.key}`]: newSqlSelectColumn({
                              key: col.key,
                              target: col,
                              query,
                           }),
                        };
                        break;
                     default:
                        throw new SqlBuildError(`Invalid column type: ${col}`, {
                           data: { column: col },
                        });
                  }
               }
               break;
            case item instanceof SqlTableAll:
               if (!item.row) break;

               for (const col of Object.values(item.row)) {
                  row = {
                     ...(row ?? {}),
                     [`$${col.key}`]: newSqlSelectColumn({
                        key: col.key,
                        target: col,
                        query,
                     }),
                  };
               }
               break;
            case item instanceof SqlTableColumn:
               row = {
                  ...(row ?? {}),
                  [`$${item.key}`]: newSqlSelectColumn({
                     key: item.key,
                     target: item,
                     query,
                  }),
               };
               break;
            case item instanceof SqlQueryColumn:
               row = {
                  ...(row ?? {}),
                  [`$${item.key}`]: newSqlSelectColumn({
                     key: item.key,
                     target: item,
                     query: query,
                  }),
               };
               break;
            case item instanceof SqlSelectValue:
               row = {
                  ...(row ?? {}),
                  [`$${item.key}`]: newSqlSelectColumn({
                     key: item.key,
                     target: item,
                     query,
                  }),
               };
               break;
            case item instanceof SqlSelectColumn:
               row = {
                  ...(row ?? {}),
                  [`$${item.key}`]: newSqlSelectColumn({
                     key: item.key,
                     target: item,
                     query,
                  }),
               };
               break;
            default:
               throw new SqlBuildError(`Invalid column type: ${item}`, {
                  data: { column: item },
               });
         }
      }

      return row as InferSelectRowByResult<T["Row"]>;
   }

   build(context: SqlBuildContext, options?: SqlBuildOptions): void {
      for (let i = 0; i < this.columns.length; i++) {
         const col = this.columns[i]!;
         if (i > 0) {
            context.addStrings(", ");
         }

         col.build(context, options);
      }
   }
}

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
