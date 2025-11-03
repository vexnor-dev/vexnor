import { SqlColumn, SqlColumnAny, SqlColumnCallable } from "./sql-column.js";
import { SqlQueryContext } from "../query/index.js";
import { Sql } from "../sql-base.js";
import { ok } from "assert";
import { TableInsertCols, TableInsertRows, TableInsertValues, TableUpdateSet } from "../charms/index.js";
import { RowIn, SqlQueryRowOut, SqlColumnType } from "../sql-types.js";
import { SqlTableFormat } from "../default-formatter.js";
import { SqlSelectAll } from "./sql-select-all.js";

export interface SqlTableOptions<
   T extends {
      Select: SqlQueryRowOut;
   },
> {
   readonly schema?: string;
   readonly name: string;
   readonly alias?: string;
   readonly columns: Record<keyof T["Select"], string>;
   readonly format?: SqlTableFormat;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlTableAny = SqlTable<any>;

export type SqlTableColumns<Select> =
   Select extends Record<string, unknown>
      ? {
           [K in keyof Select as Select[K] extends SqlColumnType
              ? K extends string
                 ? K
                 : never
              : never]: K extends string
              ? SqlColumn<{
                   Key: K;
                   Type: Select[K];
                }> &
                   SqlColumnCallable<{
                      Key: K;
                      Type: Select[K];
                   }>
              : never;
        }
      : never;

export interface SqlTableCallable<
   T extends {
      Select: SqlQueryRowOut;
      Insert?: RowIn;
      Update?: RowIn;
   },
> {
   (strings: TemplateStringsArray): SqlTable<T> & SqlTableColumns<T["Select"]>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlTableCallableAny = SqlTableCallable<any>;

export class SqlTable<
   T extends {
      Select: SqlQueryRowOut;
      Insert?: RowIn;
      Update?: RowIn;
   },
> extends Sql {
   readonly $columnsByKey: SqlTableColumns<T["Select"]>;
   #$$all: SqlSelectAll<T["Select"]> | undefined;

   private constructor(public readonly $$: SqlTableOptions<T>) {
      super();
      const columns: Record<string, SqlColumnAny> = {};

      const table = {
         schema: $$.schema,
         name: $$.name,
         alias: $$.alias,
      };

      for (const key of Object.keys($$.columns)) {
         const value = $$.columns[key as keyof T["Select"]];
         if (typeof value === "string") {
            columns[key] = SqlColumn.newColumn({ key: key, name: value, tableInfo: table });
         } else {
            throw new Error(`Column ${$$.schema}.${$$.name} ${key} must be a string or SqlColumn instance`);
         }
      }

      this.$columnsByKey = columns as SqlTableColumns<T["Select"]>;
   }

   get $$all(): SqlSelectAll<T["Select"]> {
      return (
         this.#$$all ??
         (() => {
            this.#$$all = new SqlSelectAll<T["Select"]>(Object.values(this.$columnsByKey));
            return this.#$$all;
         })()
      );
   }

   get [Symbol.toStringTag]() {
      const tokens = [];
      if (this.$$.schema) {
         tokens.push(this.$$.schema, ".");
      }
      tokens.push(this.$$.name);
      if (this.$$.alias) {
         tokens.push(" as", this.$$.alias);
      }

      return tokens.join();
   }

   static newTable<
      T extends {
         Select: SqlQueryRowOut;
         Insert?: RowIn;
         Update?: RowIn;
      },
   >(options: SqlTableOptions<T>): SqlTable<T> & SqlTableColumns<T["Select"]> & SqlTableCallable<T> {
      const fn = () => {};
      const table = new SqlTable(options);
      return new Proxy(fn, SqlTable.ProxyHandler(table)) as unknown as SqlTable<T> &
         SqlTableColumns<T["Select"]> &
         SqlTableCallable<T>;
   }

   static ProxyHandler(table: SqlTableAny): ProxyHandler<() => void> {
      return {
         apply: (_target, _thisArg, args: [TemplateStringsArray]) => {
            const alias = args[0]![0]!.trim();
            // 1. Create the new aliased instance using the existing $$as method.
            return SqlTable.newTable({
               ...table.$$,
               alias,
            });
         },
         get: (_target, prop) => {
            if (typeof prop === "string" && prop in table.$columnsByKey) {
               return table.$columnsByKey[prop];
            }

            // Forward all property access to the underlying SqlTable instance.
            return Reflect.get(table, prop);
         },
      };
   }

   $$column(key: string): SqlColumnAny {
      const result = this.$columnsByKey[key as keyof T["Select"]];
      if (!result) throw new Error(`Column not found: ${this.$$.name}.${String(key)}`);

      return result as unknown as SqlColumnAny;
   }

   /**
    * Generates the SQL code for UPDATE set values
    * @param update record with update values
    */
   $$set<U extends T["Update"]>(update: U): T["Update"] extends undefined ? never : Sql {
      ok(update, `Update is required`);
      ok(Object.keys(update), `Update doesn't have any values`);
      return new TableUpdateSet(this.$columnsByKey, update) as unknown as T["Update"] extends undefined ? never : Sql;
   }

   /**
    * Generates the columns and VALUES clause for an INSERT statement, e.g., ("col1", "col2") VALUES (?, ?), (?, ?).
    * @param inserts array of records to insert
    */
   $$values(...inserts: T["Insert"][]): T["Insert"] extends undefined ? never : Sql {
      ok(insertsAreValid(inserts), `Invalid inserts`);
      return new TableInsertValues(this.$columnsByKey, inserts) as never as T["Insert"] extends undefined ? never : Sql;
   }

   /**
    * Generates the column list for an INSERT statement, e.g., ("col1", "col2").
    * @param inserts - One or more objects containing the data to be inserted.
    */
   $$cols(...inserts: T["Insert"][]): T["Insert"] extends undefined ? never : Sql {
      ok(insertsAreValid(inserts), `Invalid inserts`);
      return new TableInsertCols(this.$columnsByKey, inserts) as never as T["Insert"] extends undefined ? never : Sql;
   }

   /**
    * Generates the VALUES clause for an INSERT statement, e.g., VALUES (?, ?), (?, ?).
    * @param inserts - One or more objects containing the data to be inserted.
    */
   $$rows(...inserts: T["Insert"][]): T["Insert"] extends undefined ? never : Sql {
      ok(insertsAreValid(inserts), `Invalid inserts`);
      return new TableInsertRows(this.$columnsByKey, inserts) as never as T["Insert"] extends undefined ? never : Sql;
   }

   $build(context: SqlQueryContext) {
      const { strings } = context;
      const schema = this.$$.schema ? `"${this.$$.schema}".` : "";

      const format = this.$$.format ?? context.formatter.getTableFormat(context);
      switch (format) {
         case "tableName":
            strings.push(`"${this.$$.name}"`);
            break;
         case "schema.tableName":
            strings.push(`${schema}"${this.$$.name}"`);
            switch (context.keyword) {
               case "update":
               case "delete from":
               case "insert into":
                  context.setAlias({
                     ...this.$$,
                     alias: this.$$.name,
                  });
            }
            break;
         case "schema.tableName as tableAlias": {
            const alias = this.$$.alias ?? context.alias(this.$$);
            if (this.$$.name === alias) {
               strings.push(`${schema}"${this.$$.name}"`);
               break;
            }

            strings.push(`${schema}"${this.$$.name}" as "${alias}"`);
            break;
         }
         case "tableAlias":
            strings.push(`"${context.alias(this.$$)}"`);
            break;
         default:
            throw new Error(`Unknown table format: ${format}`);
      }
   }
}

function insertsAreValid(values: unknown[]): values is RowIn[] {
   if (!values.length) return false;
   return !values.some((value) => !value);
}
