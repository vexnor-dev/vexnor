import { SqlColumn } from "./sql-column.js";
import { SqlQueryContext } from "./sql-query-context.js";
import { x } from "../x.js";
import { Sql } from "./sql-base.js";
import { ok } from "assert";
import { TableInsertValues, TableUpdateSet } from "./charms/index.js";
import { RowIn } from "./sql-types.js";
import { SqlKeyword } from "./sql-keyword.js";
import { SqlBuildError } from "./sql-build-error.js";
import { randomName } from "./random-name.js";

export interface SqlTableOptions {
   readonly schema?: string;
   readonly name: string;
   readonly alias?: string;
   readonly pk?: SqlColumn;
   readonly cols: Record<string, SqlColumn>;
   readonly format?: SqlTableFormat;
}

export type SqlTableFormat = "table" | "schema.table" | "schema.table as alias" | "alias";

const SQL_TABLE_FORMATS: Partial<Record<SqlKeyword, SqlTableFormat>> = {
   from: "schema.table as alias",
   update: "schema.table as alias",
   "insert into": "schema.table as alias",
   "delete from": "schema.table as alias",
   join: "schema.table as alias",
   fn: "alias",
};

const DEFAULT_TABLE_FORMAT: SqlTableFormat = "schema.table";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlTableAny = SqlTable<any>;

export class SqlTable<T extends { Insert: RowIn; Update: RowIn }> extends Sql {
   private readonly options: SqlTableOptions;

   constructor(options: SqlTableOptions) {
      super();
      this.options = {
         ...options,
         alias: options.alias ?? randomName(options.name),
      };
   }

   static getFormat(table: SqlTableAny, context: SqlQueryContext): SqlTableFormat {
      if (!context.keyword) {
         throw new SqlBuildError(`SQL context keyword required for table '${table.$$.schema}.${table.$$.name}'`, {
            token: table,
            strings: context.strings,
         });
      }

      return SQL_TABLE_FORMATS[context.keyword] ?? DEFAULT_TABLE_FORMAT;
   }

   get $$(): SqlTableOptions {
      return this.options;
   }

   get $$all(): SqlColumn[] {
      return Object.values(this.options.cols);
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

   $$as(alias: string): SqlTable<T> {
      return new SqlTable({
         ...this.options,
         alias,
      });
   }

   /**
    * Generates the SQL code for UPDATE set values
    * @param update record with update values
    */
   $$set<U extends T["Update"]>(update: U): Sql {
      ok(Object.keys(update), `Update doesn't have any values`);
      return new TableUpdateSet(this.$$.cols, update);
   }

   /**
    * Generates the SQL code for INSERT
    * @param inserts array of records to insert
    */
   $$values(...inserts: T["Insert"][]): Sql {
      ok(inserts.length, `No rows for insert`);
      return new TableInsertValues<T>(this.$$.cols, inserts);
   }

   build({ keyword, strings }: SqlQueryContext) {
      const schema = this.$$.schema ? `"${this.$$.schema}".` : "";

      const format = x(() => {
         if (this.options.format) return this.options.format;

         if (!keyword) {
            throw new SqlBuildError(
               `SQL context keyword required for table '${this.options.schema}.${this.options.schema}'`,
               {
                  token: this,
                  strings,
               },
            );
         }

         return SQL_TABLE_FORMATS[keyword] ?? DEFAULT_TABLE_FORMAT;
      });

      switch (format) {
         case "table":
            strings.push(`"${this.$$.name}"`);
            break;
         case "schema.table":
            strings.push(`${schema}"${this.$$.name}"`);
            break;
         case "schema.table as alias":
            if (this.$$.name === this.$$.alias) {
               strings.push(`${schema}"${this.$$.name}"`);
               break;
            }

            strings.push(`${schema}"${this.$$.name}" as "${this.$$.alias}"`);
            break;
         case "alias":
            strings.push(`"${this.$$.alias ?? this.$$.name}"`);
            break;
         default:
            throw new Error(`Unknown table format: ${format}`);
      }
   }
}

type SqlTableColumns<T> = T extends Record<string, SqlColumn | string> ? { [K in keyof T]: SqlColumn } : never;

export interface NewTableOptions<TTypes> {
   readonly schema?: string;
   readonly name: string;
   readonly alias?: string;
   readonly pk?: SqlColumn | string;
   readonly types?: TTypes;
}

export function newTable<
   TColumns extends Record<string, SqlColumn | string>,
   TTypes extends {
      Insert: RowIn;
      Update: RowIn;
   },
>(options: NewTableOptions<TTypes>, cols: TColumns): SqlTable<TTypes> & SqlTableColumns<TColumns> {
   const table = {
      name: options.name,
      alias: options.alias ?? randomName(options.name),
   };
   const pk = x(() => {
      if (!options.pk) return undefined;
      if (typeof options.pk === "string") {
         return new SqlColumn({ alias: options.pk, name: options.pk, table: table });
      }

      return new SqlColumn({ ...options.pk, table: table });
   });
   const __cols__ = x(() => {
      const columns: Record<string, SqlColumn> = {};
      for (const [key, value] of Object.entries(cols)) {
         if (typeof value === "string") {
            columns[key] = new SqlColumn({ alias: key, name: value, table: table });
         } else {
            columns[key] = new SqlColumn({
               ...value,
               table: table,
               alias: key,
            });
         }
      }

      return columns;
   });
   const result = new SqlTable<TTypes>({
      ...options,
      pk,
      alias: table.alias,
      cols: __cols__,
   });

   return Object.assign(result, __cols__) as SqlTable<TTypes> & SqlTableColumns<TColumns>;
}
