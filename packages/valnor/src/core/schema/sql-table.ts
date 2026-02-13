import { newSqlTableColumn, SqlTableColumnAny } from "./sql-table-column.js";
import { SqlBuildContext, SqlBuildOptions } from "../query/index.js";
import { Sql } from "../sql-base.js";
import { ok } from "assert";
import { TableInsertCols, TableInsertRows, TableInsertValues, TableUpdateSet, SqlTableAll } from "../charms/index.js";
import { SqlTableFormat } from "../default-formatter.js";
import { InferTable$RowBySelect } from "../types/index.js";

export type SqlTableOptions<
   T extends {
      Select: Record<string, unknown>;
   },
> = {
   readonly tableInfo: { readonly schema?: string; readonly name: string; readonly alias?: string };
   readonly format?: SqlTableFormat | null;
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
   InferTable$RowBySelect<T["Select"]> & {
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
   readonly $$: SqlTableAll<T["Select"]>;
   readonly tableInfo: { schema?: string; name: string; alias?: string };
   readonly format: SqlTableFormat | null;
   readonly row: InferTable$RowBySelect<T["Select"]>;
   readonly pk: Array<keyof T["Select"]>;

   readonly tableCache = new Map<string, SqlTableExtended<T>>();

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
               row[`$${key}`] = newSqlTableColumn({ key: key, columnName: value, tableInfo });
            } else {
               throw new Error(`Column ${schema}.${name} ${key} must be a string or SqlColumn instance`);
            }
         }

         return row as InferTable$RowBySelect<T["Select"]>;
      })();

      this.$$ = new SqlTableAll<T["Select"]>(this.row);
   }

   as(tableName: string | TemplateStringsArray): SqlTableExtended<T> {
      const alias = (() => {
         switch (true) {
            case typeof tableName === "string":
               return tableName;
            case Array.isArray(tableName) && tableName.length === 1:
               return tableName[0];
            default:
               throw new Error(`Invalid table name: ${tableName}`);
         }
      })();
      if (!this.tableCache.has(alias)) {
         this.tableCache.set(
            alias,
            newSqlTable({
               format: this.format,
               pk: this.pk,
               columns: (() => {
                  const columns: Record<string, string> = {};
                  for (const { key, columnName } of Object.values(this.row)) {
                     columns[key] = columnName;
                  }

                  return columns as Record<keyof T["Select"], string>;
               })(),
               tableInfo: { ...this.tableInfo, alias },
            }),
         );
      }

      return this.tableCache.get(alias)!;
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

   render(format: SqlTableFormat): SqlTableExtended<T> {
      return newSqlTable({
         format,
         tableInfo: this.tableInfo,
         pk: this.pk,
         columns: (() => {
            const columns: Record<string, string> = {};
            for (const { key, columnName } of Object.values(this.row)) {
               columns[key] = columnName;
            }

            return columns as Record<keyof T["Select"], string>;
         })(),
      });
   }
}

export function newSqlTable<
   T extends {
      Select: Record<string, unknown>;
      Insert?: Partial<T["Select"]>;
      Update?: Partial<T["Insert"]>;
   },
>(options: SqlTableOptions<T>): SqlTableExtended<T> {
   return new Proxy(new SqlTable(options), {
      ownKeys(target): ArrayLike<string | symbol> {
         return [...Object.keys(target), ...Object.keys(target.row)];
      },
      getOwnPropertyDescriptor(target, p: string | symbol): PropertyDescriptor | undefined {
         if (Reflect.has(target, p)) {
            return Reflect.getOwnPropertyDescriptor(target, p);
         }

         if (Reflect.has(target.row, p)) {
            return Reflect.getOwnPropertyDescriptor(target.row, p);
         }

         return undefined;
      },
      has(target, p: string | symbol): boolean {
         return Reflect.has(target, p) || Reflect.has(target.row, p);
      },
      get(target, p: string | symbol, receiver: unknown): unknown {
         if (Reflect.has(target, p)) {
            return Reflect.get(target, p, receiver);
         }

         return Reflect.get(target.row, p, receiver);
      },
   }) as SqlTableExtended<T>;
}

function insertsAreValid(values: unknown[]): values is Record<string, unknown>[] {
   if (!values.length) return false;
   return !values.some((value) => !value);
}
