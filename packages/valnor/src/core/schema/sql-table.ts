import { newSqlTableColumn, SqlTableColumn, SqlTableColumnAny } from "./sql-table-column.js";
import { SqlBuildContext, SqlBuildOptions } from "../query/index.js";
import { Sql } from "../sql-base.js";
import { ok } from "assert";
import { TableInsertCols, TableInsertRows, TableInsertValues, TableUpdateSet, SqlTableAll } from "../charms/index.js";
import { SqlTableFormat } from "../default-formatter.js";

export type SqlTableOptions<
   T extends {
      Select: Record<string, unknown>;
   },
> = {
   readonly tableInfo: { readonly schema?: string; readonly name: string; readonly alias?: string };
   readonly format?: SqlTableFormat;
   readonly pk: (keyof T["Select"])[];
   readonly columns: Record<keyof T["Select"], string>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlTableAny = SqlTable<any>;

export type SqlTableExtended<
   T extends {
      Select: Record<string, unknown>;
      Insert?: Partial<T["Select"]>;
      Update?: Partial<T["Insert"]>;
   },
> = SqlTable<T> &
   InferTableColumnsByRecord<T["Select"]> & {
      (strings: TemplateStringsArray): SqlTableExtended<T>;
   };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlTableExtendedAny = SqlTableExtended<any>;

export class SqlTable<
   T extends {
      Select: Record<string, unknown>;
      Insert?: Partial<T["Select"]>;
      Update?: Partial<T["Insert"]>;
   },
> extends Sql {
   readonly $$: SqlTableAll<{ Row: T["Select"] }>;
   readonly tableInfo: { schema?: string; name: string; alias?: string };
   readonly format: SqlTableFormat | null;
   readonly row: InferTableColumnsByRecord<T["Select"]>;
   readonly pk: Array<keyof T["Select"]>;

   constructor({ format, pk, tableInfo, ...options }: SqlTableOptions<T>) {
      super({
         ID: (() => {
            const schema = tableInfo.schema ? `${tableInfo.schema}.` : "";
            const alias = tableInfo.alias ? ` as ${tableInfo.alias}` : "";
            return `SqlTable(${schema}${tableInfo.name}${alias})`;
         })(),
      });
      this.tableInfo = tableInfo;
      this.format = format ?? null;
      this.pk = pk;
      const { schema, name } = tableInfo;

      this.row = (() => {
         const row: Record<string, unknown> = {};
         for (const key of Object.keys(options.columns)) {
            const value = options.columns[key];
            if (typeof value === "string") {
               row[key] = newSqlTableColumn({ key: key, columnName: value, tableInfo });
            } else {
               throw new Error(`Column ${schema}.${name} ${key} must be a string or SqlColumn instance`);
            }
         }

         return row as InferTableColumnsByRecord<T["Select"]>;
      })();

      this.$$ = new SqlTableAll<{ Row: T["Select"] }>(this.row);
   }

   column(key: string): SqlTableColumnAny {
      const result = this.row[key as keyof T["Select"]];
      if (!result) throw new Error(`Column not found: ${this.tableInfo.name}.${String(key)}`);

      return result as unknown as SqlTableColumnAny;
   }

   /**
    * Generates the SQL code for UPDATE set values
    * @param update record with update values
    */
   updateSet<U extends T["Update"]>(update: U): T["Update"] extends undefined ? never : Sql {
      ok(update, `Update is required`);
      ok(Object.keys(update), `Update doesn't have any values`);
      return new TableUpdateSet(this.row, update) as unknown as T["Update"] extends undefined ? never : Sql;
   }

   /**
    * Generates the columns and VALUES clause for an INSERT statement, e.g., ("col1", "col2") VALUES (?, ?), (?, ?).
    * @param inserts array of records to insert
    */
   insertColsVals(...inserts: T["Insert"][]): T["Insert"] extends undefined ? never : Sql {
      ok(insertsAreValid(inserts), `Invalid inserts`);
      return new TableInsertValues(this.row, inserts) as never as T["Insert"] extends undefined ? never : Sql;
   }

   /**
    * Generates the column list for an INSERT statement, e.g., ("col1", "col2").
    * @param inserts - One or more objects containing the data to be inserted.
    */
   insertCols(...inserts: T["Insert"][]): T["Insert"] extends undefined ? never : Sql {
      ok(insertsAreValid(inserts), `Invalid inserts`);
      return new TableInsertCols(this.row, inserts) as never as T["Insert"] extends undefined ? never : Sql;
   }

   /**
    * Generates the VALUES clause for an INSERT statement, e.g., VALUES (?, ?), (?, ?).
    * @param inserts - One or more objects containing the data to be inserted.
    */
   insertVals(...inserts: T["Insert"][]): T["Insert"] extends undefined ? never : Sql {
      ok(insertsAreValid(inserts), `Invalid inserts`);
      return new TableInsertRows(this.row, inserts) as never as T["Insert"] extends undefined ? never : Sql;
   }

   // eslint-disable-next-line unused-imports/no-unused-vars
   build(context: SqlBuildContext, _options?: SqlBuildOptions) {
      const schema = this.tableInfo.schema ? `${this.tableInfo.schema}.` : "";

      const format = this.format ?? context.formatter.getTableFormat(context);
      switch (format) {
         case "tableName":
            context.addQuotes(`${this.tableInfo.name}`);
            break;
         case "schema.tableName":
            context.addQuotes(`${schema}${this.tableInfo.name}`);
            switch (context.keyword) {
               case "update":
               case "delete from":
               case "insert into":
                  context.setAlias({
                     ...this.tableInfo,
                     alias: this.tableInfo.name,
                  });
            }
            break;
         case "schema.tableName as tableAlias": {
            const alias = this.tableInfo.alias ?? context.alias(this.tableInfo);
            if (this.tableInfo.name === alias) {
               context.addQuotes(`${schema}${this.tableInfo.name}`);
               break;
            }

            context.addQuotes(`${schema}${this.tableInfo.name} as ${alias}`);
            break;
         }
         case "tableAlias":
            context.addQuotes(`${context.alias(this.tableInfo)}`);
            break;
         default:
            throw new Error(`Unknown table format: ${format}`);
      }
   }
}

export function newSqlTable<
   T extends {
      Select: Record<string, unknown>;
      Insert?: Partial<T["Select"]>;
      Update?: Partial<T["Insert"]>;
   },
>(options: SqlTableOptions<T>): SqlTableExtended<T> {
   const table = new SqlTable(options);
   const name = table.toString();
   const sqlTable = { [name]: () => {} }[name];
   return new Proxy(sqlTable as () => void, {
      ownKeys(): ArrayLike<string | symbol> {
         return [...Object.keys(table), ...Object.keys(table.row).map((z) => `$${z}`)];
      },
      getPrototypeOf(): object | null {
         return Object.getPrototypeOf(table);
      },
      getOwnPropertyDescriptor(_target, p: string | symbol): PropertyDescriptor | undefined {
         const prop = String(p);
         switch (true) {
            case !prop.startsWith("$"):
            case prop.startsWith("$$"):
               return Reflect.getOwnPropertyDescriptor(table, p);
            case prop.startsWith("$"):
               return Reflect.getOwnPropertyDescriptor(table.row, p);
            default:
               throw new Error(`Unknown property: ${prop}`);
         }
      },
      has(_target, p: string | symbol): boolean {
         const prop = String(p);
         switch (true) {
            case !prop.startsWith("$"):
            case prop.startsWith("$$"):
               return Object.hasOwn(table, p);
            case prop.startsWith("$"):
               return Object.hasOwn(table.row, p);
            default:
               throw new Error(`Unknown property: ${prop}`);
         }
      },
      get(_target, p: string | symbol, receiver: unknown): unknown {
         const prop = String(p);
         switch (true) {
            case !prop.startsWith("$"):
            case prop.startsWith("$$"): {
               const result = Reflect.get(table, p, receiver);
               if (typeof result === "function") {
                  return result.bind(table);
               }
               return result;
            }
            case prop.startsWith("$"):
               return Reflect.get(table.row, prop.substring(1), receiver);
            default:
               throw new Error(`Unknown property: ${prop}`);
         }
      },
      apply(_target, _thisArg: unknown, argArray: string[]): SqlTable<T> {
         const key = Array.isArray(argArray[0]) ? argArray[0][0] : argArray[0];
         if (!key) {
            throw new Error("Column alias cannot be empty");
         }

         return newSqlTable({
            ...options,
            tableInfo: {
               ...table.tableInfo,
               alias: key,
            },
         });
      },
   }) as unknown as SqlTableExtended<T>;
}

function insertsAreValid(values: unknown[]): values is Record<string, unknown>[] {
   if (!values.length) return false;
   return !values.some((value) => !value);
}

type InferTableColumnsByRecord<Select> =
   Select extends Record<string, unknown>
      ? {
           [K in keyof Select as `$${string & K}`]: K extends string
              ? SqlTableColumn<{
                   Key: K;
                   Type: Select[K];
                }>
              : never;
        }
      : never;
