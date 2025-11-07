import { Sql } from "../sql-base.js";
import { SqlBuildOptions } from "../sql-types.js";
import { SqlQueryContext } from "./sql-query-context.js";
import { SqlBuildError } from "../sql-build-error.js";
import { SqlColumnAny, SqlTableColumn, SqlTableColumnExtended } from "../schema/index.js";
import { SqlValue, SqlValueAny } from "./sql-value.js";
import {
   newSqlSelectColumn,
   SqlSelectColumn,
   SqlSelectColumnAny,
   SqlSelectColumnExtended,
} from "./sql-select-column.js";
import { SqlTableAll, SqlTableAllAny } from "../charms/index.js";
import { SqlSelectAll, SqlSelectAllAny } from "./sql-select-all.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlSelectRowAny = SqlSelectRow<any>;

export type SqlSelectColumnTypes = SqlTableAllAny | SqlSelectAllAny | SqlColumnAny | SqlValueAny | SqlSelectColumnAny;

export type SqlSelectRowExtended<T extends { Row: Record<string, unknown> }> = SqlSelectRow<T> &
   InferSelectColumnsByRecord<T["Row"]>;

export class SqlSelectRow<T extends { Row: Record<string, unknown> }> extends Sql {
   readonly $all: SqlSelectAll<T>;
   readonly $$row: InferSelectColumnsByRecord<T["Row"]>;
   readonly #columns: SqlSelectColumnTypes[];

   constructor(columns: SqlSelectColumnTypes[]) {
      super();
      this.#columns = columns;
      this.$$row = (() => {
         const row: Record<string, SqlSelectColumnAny> = {};
         for (const item of columns) {
            switch (true) {
               case item instanceof SqlSelectAll:
               case item instanceof SqlTableAll:
                  for (const [key, value] of Object.entries(item.row)) {
                     row[key] = newSqlSelectColumn({
                        columnName: value.columnName,
                        key,
                     });
                  }
                  break;
               case item instanceof SqlValue:
                  row[item.key] = newSqlSelectColumn({
                     columnName: item.key,
                     key: item.key,
                  });
                  break;
               case item instanceof SqlTableColumn:
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

         return row as InferSelectColumnsByRecord<T["Row"]>;
      })();
      this.$all = new SqlSelectAll(this.$$row);
   }

   $$build(context: SqlQueryContext, options?: SqlBuildOptions): void {
      let index = 0;
      for (const item of this.#columns) {
         if (index++ > 0) context.addStrings(", ");
         item.$$build(context, options);
      }
   }
}

export function row<
   Column extends SqlSelectAllAny | SqlColumnAny | SqlValueAny | SqlSelectColumnAny,
   Columns extends Column[],
>(...columns: Columns): SqlSelectRowExtendedTypedOrGeneric<InferRowSelectFromColumns<typeof columns>> {
   return new Proxy(new SqlSelectRow(columns), {
      ownKeys(target: SqlSelectRow<{ Row: Record<string, unknown> }>): ArrayLike<string | symbol> {
         return [...Object.keys(target), ...Object.keys(target.$$row)];
      },
      has(target, p: string | symbol): boolean {
         return Object.hasOwn(target, p) || Object.hasOwn(target.$$row, p);
      },
      get(target, p: string | symbol, receiver: unknown): unknown {
         const result = Reflect.get(target, p, receiver);
         if (typeof result === "function") return result.bind(target);
         if (result) return result;
         return Reflect.get(target.$$row, p, receiver);
      },
   }) as SqlSelectRowExtendedTypedOrGeneric<InferRowSelectFromColumns<typeof columns>>;
}

type SqlSelectRowExtendedTypedOrGeneric<T> =
   T extends Record<string, unknown>
      ? SqlSelectRowExtended<{ Row: T }>
      : SqlSelectRowExtended<{ Row: Record<string, unknown> }>;

type InferColumnOptions<T> = T extends
   | SqlTableColumnExtended<infer O>
   | SqlTableColumn<infer O>
   | SqlValue<infer O>
   | SqlSelectColumnExtended<infer O>
   | SqlSelectColumn<infer O>
   ? O
   : never;

type InferSelectAllOptions<T> = T extends SqlTableAll<infer O> | SqlSelectAll<infer O> ? O : never;

export type InferRowSelectFromColumns<T> = T extends [infer Start, ...infer Rest]
   ? InferColumnOptions<Start> extends { Key: infer K extends string; Type: infer V }
      ? Record<K, V> & InferRowSelectFromColumns<Rest>
      : InferSelectAllOptions<Start> extends { Row: infer R extends Record<string, unknown> }
        ? R & InferRowSelectFromColumns<Rest>
        : InferRowSelectFromColumns<Rest>
   : unknown;

export type InferSelectColumnsByRecord<Select> =
   Select extends Record<string, unknown>
      ? {
           [K in keyof Select]: K extends string
              ? SqlSelectColumnExtended<{
                   Key: K;
                   Type: Select[K];
                }>
              : never;
        }
      : never;
