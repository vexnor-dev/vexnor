import { Sql } from "../sql-base.js";
import { SqlBuildContext } from "./sql-build-context.js";
import { SqlTableColumn, SqlTableColumnAny } from "../schema/index.js";
import { SqlSelectValue, SqlSelectValueAny } from "./sql-select-value.js";
import { newSqlSelectColumn, SqlSelectColumn, SqlSelectColumnAny } from "./sql-select-column.js";
import { SqlTableAll, SqlTableAllAny } from "../charms/index.js";
import { SqlSelectAll, SqlSelectAllAny } from "./sql-select-all.js";
import { InferSelectRowByResult, SqlBuildOptions } from "./sql-query-types.js";
import { SqlBuildError } from "../sql-build-error.js";
import { MergeAll } from "../utils/index.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlSelectRowAny = SqlSelectRow<any>;

export type SqlSelectColumnInput =
   | SqlSelectAllAny
   | SqlSelectValueAny
   | SqlSelectColumnAny
   | SqlTableAllAny
   | SqlTableColumnAny;

export class SqlSelectRow<T extends { Row: Record<string, unknown> }> extends Sql {
   constructor(public readonly columns: SqlSelectColumnInput[]) {
      super({
         ID: `${columns
            .map((col) => {
               return col.toString();
            })
            .join(", ")}`,
      });
   }

   private _$$: SqlSelectAll<T> | null = null;

   get $$(): SqlSelectAll<T> {
      if (!this._$$) {
         this._$$ = new SqlSelectAll(this.row);
      }

      return this._$$;
   }

   private _row: InferSelectRowByResult<T["Row"]> | null = null;

   get row(): InferSelectRowByResult<T["Row"]> {
      if (!this._row) {
         const row: Record<string, unknown> = {};
         for (const item of this.columns) {
            switch (true) {
               case item instanceof SqlSelectAll:
                  if (!item.row) break;

                  for (const col of Object.values(item.row)) {
                     switch (true) {
                        case col instanceof SqlTableColumn:
                           row[`$${col.key}`] = newSqlSelectColumn({
                              columnName: col.key,
                              key: col.key,
                           });
                           break;
                        case col instanceof SqlSelectColumn:
                           row[`$${col.key}`] = newSqlSelectColumn({
                              columnName: col.key,
                              key: col.key,
                           });
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
                     row[`$${col.key}`] = newSqlSelectColumn({
                        columnName: col.key,
                        key: col.key,
                     });
                  }
                  break;
               case item instanceof SqlTableColumn:
                  row[`$${item.key}`] = newSqlSelectColumn({
                     columnName: item.key,
                     key: item.key,
                  });
                  break;
               case item instanceof SqlSelectColumn:
                  row[`$${item.key}`] = newSqlSelectColumn({
                     columnName: item.key,
                     key: item.key,
                  });
                  break;
               case item instanceof SqlSelectValue:
                  row[`$${item.key}`] = newSqlSelectColumn({
                     columnName: item.key,
                     key: item.key,
                  });
                  break;
               default:
                  throw new SqlBuildError(`Invalid column type: ${item}`, {
                     data: { column: item },
                  });
            }
         }

         this._row = row as InferSelectRowByResult<T["Row"]>;
      }

      return this._row;
   }

   build(context: SqlBuildContext, options?: SqlBuildOptions): void {
      let index = 0;
      for (const item of this.columns) {
         if (index++ > 0) context.addStrings(", ");
         item.build(context, options);
      }
   }
}

export function row<
   Column extends SqlSelectAllAny | SqlSelectValueAny | SqlSelectColumnAny | SqlTableAllAny | SqlTableColumnAny,
   Columns extends Column[],
>(...columns: Columns): SqlSelectRow<{ Row: InferResultRowFromColumns<typeof columns> }> {
   return new SqlSelectRow(columns);
}

export type InferResultRowFromColumn<T> = T extends
   | SqlTableColumn<infer U>
   | SqlSelectValue<infer U>
   | SqlSelectColumn<infer U>
   ? U extends { Key: infer K extends string; Type: infer V }
      ? Record<K, V>
      : never
   : unknown;

export type InferResultRowFromAll<T> = T extends SqlTableAll<infer U> | SqlSelectAll<infer U>
   ? U["Row"] extends Record<string, unknown>
      ? {
           [K in keyof U["Row"]]: K extends string ? U["Row"][K] : never;
        }
      : never
   : unknown;

export type InferResultRowFromSelect<T> =
   T extends SqlSelectRow<infer U extends { Row: Record<string, unknown> }> ? U["Row"] : unknown;

export type InferResultRowFromColumns<T> = T extends [infer Start, ...infer Rest]
   ? MergeAll<
        [
           InferResultRowFromSelect<Start>,
           InferResultRowFromColumn<Start>,
           InferResultRowFromColumns<Rest>,
           InferResultRowFromAll<Start>,
        ]
     >
   : {};
