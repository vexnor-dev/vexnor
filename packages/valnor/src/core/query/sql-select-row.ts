import { Sql } from "../sql-base.js";
import { SqlBuildContext } from "./sql-build-context.js";
import { SqlBuildError } from "../sql-build-error.js";
import { SqlTableColumn, SqlTableColumnAny, SqlTableColumnExtended } from "../schema/index.js";
import { SqlValue, SqlValueAny } from "./sql-value.js";
import {
   newSqlSelectColumn,
   SqlSelectColumn,
   SqlSelectColumnAny,
   SqlSelectColumnExtended,
} from "./sql-select-column.js";
import { SqlTableAll, SqlTableAllAny } from "../charms/index.js";
import { SqlSelectAll, SqlSelectAllAny } from "./sql-select-all.js";
import { InferSelectRowByResult, SqlBuildOptions } from "./sql-query-types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlSelectRowAny = SqlSelectRow<any>;

export type SqlSelectColumnTypes =
   | SqlTableAllAny
   | SqlSelectAllAny
   | SqlTableColumnAny
   | SqlValueAny
   | SqlSelectColumnAny;

export type SqlSelectRowExtended<T extends { Row: Record<string, unknown> }> = SqlSelectRow<T> &
   InferSelectRowByResult<T["Row"]>;

export class SqlSelectRow<T extends { Row: Record<string, unknown> }> extends Sql {
   readonly $$: SqlSelectAll<T>;
   readonly row: InferSelectRowByResult<T["Row"]>;
   private readonly columns: SqlSelectColumnTypes[];

   constructor(columns: SqlSelectColumnTypes[]) {
      super({
         ID: `${columns
            .map((col) => {
               return col.toString();
            })
            .join(", ")}`,
      });
      this.columns = columns;
      this.row = (() => {
         const row: Record<string, SqlSelectColumnAny> = {};
         for (const item of columns) {
            switch (true) {
               case item instanceof SqlSelectAll:
               case item instanceof SqlTableAll:
                  if (!item.row) break;

                  for (const [key, value] of Object.entries(item.row)) {
                     row[key] = newSqlSelectColumn({
                        columnName: value.columnName,
                        key,
                     });
                  }
                  break;
               case item instanceof SqlSelectColumn:
               case item instanceof SqlTableColumn:
               case item instanceof SqlValue:
                  row[item.key] = newSqlSelectColumn({
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

         return row as InferSelectRowByResult<T["Row"]>;
      })();
      this.$$ = new SqlSelectAll(this.row);
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
   Column extends SqlSelectAllAny | SqlValueAny | SqlSelectColumnAny | SqlTableAllAny | SqlTableColumnAny,
   Columns extends Column[],
>(...columns: Columns) {
   return new Proxy(new SqlSelectRow(columns), {
      ownKeys(target: SqlSelectRow<{ Row: Record<string, unknown> }>): ArrayLike<string | symbol> {
         return [...Object.keys(target), ...Object.keys(target.row).map((z) => `$${z}`)];
      },
      getOwnPropertyDescriptor(target, p: string | symbol): PropertyDescriptor | undefined {
         const prop = String(p);
         switch (true) {
            case !prop.startsWith("$"):
            case prop.startsWith("$$"):
               return Reflect.getOwnPropertyDescriptor(target, p);
            case prop.startsWith("$"):
               return Reflect.getOwnPropertyDescriptor(target.row, p);
            default:
               throw new Error(`Unknown property: ${prop}`);
         }
      },
      has(target, p: string | symbol): boolean {
         const prop = String(p);
         switch (true) {
            case !prop.startsWith("$"):
            case prop.startsWith("$$"):
               return Object.hasOwn(target, p);
            case prop.startsWith("$"):
               return Object.hasOwn(target.row, p);
            default:
               throw new Error(`Unknown property: ${prop}`);
         }
      },
      get(target, p: string | symbol, receiver: unknown): unknown {
         const prop = String(p);
         switch (true) {
            case !prop.startsWith("$"):
            case prop.startsWith("$$"): {
               const result = Reflect.get(target, p, receiver);
               if (typeof result === "function") {
                  return result.bind(target);
               }
               return result;
            }
            case prop.startsWith("$"):
               return Reflect.get(target.row, prop.substring(1), receiver);
            default:
               throw new Error(`Unknown property: ${prop}`);
         }
      },
   }) as SqlSelectRowExtended<{ Row: InferResultRowFromColumns<typeof columns> }>;
}

export type InferResultRowFromColumn<T> = T extends
   | SqlTableColumnExtended<infer U>
   | SqlTableColumn<infer U>
   | SqlValue<infer U>
   | SqlSelectColumnExtended<infer U>
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
   ? InferResultRowFromSelect<Start> &
        InferResultRowFromColumn<Start> &
        InferResultRowFromAll<Start> &
        InferResultRowFromColumns<Rest>
   : Record<string, unknown>;
