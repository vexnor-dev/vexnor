import { SqlColumn } from "./sql-column.js";
import { SqlQueryContext } from "./sql-query-context.js";
import { x } from "./x.js";
import { Sql } from "./sql-base.js";
import { ok } from "assert";
import { TableInsertValues, TableUpdateSet } from "./plugins/index.js";
import { RowIn } from "./sql-types.js";
import { generateRandomName } from "./types.js";
import { SqlKeyword } from "./sql-keyword.js";
import { SqlBuildError } from "./sql-build-error.js";

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
   with: "table",
   insert: "schema.table as alias",
   update: "schema.table as alias",
   delete: "schema.table",
   join: "schema.table as alias",
   fn: "alias",
};

export class SqlTable<T extends { Insert: RowIn; Update: RowIn }> extends Sql {
   private readonly options: SqlTableOptions;

   constructor(options: SqlTableOptions) {
      super();
      this.options = {
         ...options,
         alias: options.alias ?? `${options.name}_${generateRandomName(3)}`,
      };
   }

   get $$(): SqlTableOptions {
      return this.options;
   }

   get $$all(): SqlColumn[] {
      return Object.values(this.options.cols);
   }

   $$as(alias: string): SqlTable<T> {
      return new SqlTable({
         ...this.options,
         alias,
      });
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

         if (!SQL_TABLE_FORMATS[keyword]) {
            throw new SqlBuildError(
               `Unknown SQL context keyword for column '${this.options.schema}.${this.options.name}' and keyword '${keyword}'`,
               {
                  token: this,
                  strings,
               },
            );
         }

         return SQL_TABLE_FORMATS[keyword];
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
   const tableName = options.alias ?? `${options.name}_${generateRandomName()}`;
   const pk = x(() => {
      if (!options.pk) return undefined;
      if (typeof options.pk === "string") {
         return new SqlColumn({ alias: options.pk, name: options.pk, table: tableName });
      }

      return new SqlColumn({ ...options.pk, table: tableName });
   });
   const __cols__ = x(() => {
      const columns: Record<string, SqlColumn> = {};
      for (const [key, value] of Object.entries(cols)) {
         if (typeof value === "string") {
            columns[key] = new SqlColumn({ alias: key, name: value, table: tableName });
         } else {
            columns[key] = new SqlColumn({
               ...value,
               table: tableName,
               alias: key,
            });
         }
      }

      return columns;
   });
   const table = new SqlTable<TTypes>({
      ...options,
      pk,
      alias: tableName,
      cols: __cols__,
   });

   return Object.assign(table, __cols__) as SqlTable<TTypes> & SqlTableColumns<TColumns>;
}
