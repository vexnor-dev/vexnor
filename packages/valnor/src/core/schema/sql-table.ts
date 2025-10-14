import { SqlColumn } from "./sql-column.js";
import { SqlQueryContext } from "../query/index.js";
import { Sql } from "../sql-base.js";
import { ok } from "assert";
import { TableInsertValues, TableUpdateSet } from "../charms/index.js";
import { RowIn, RowOut } from "../sql-types.js";
import { SqlTableFormat } from "../sql-formatter.js";
import { randomName } from "../random.js";

export interface SqlTableOptions {
   readonly schema?: string;
   readonly name: string;
   readonly alias?: string;
   readonly pk?: SqlColumn;
   readonly cols: Record<string, SqlColumn>;
   readonly format?: SqlTableFormat;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlTableAny = SqlTable<any>;

export class SqlTable<T extends { Select: RowOut; Insert?: RowIn; Update?: RowIn }> extends Sql {
   private readonly options: SqlTableOptions;

   constructor(options: SqlTableOptions) {
      super();
      this.options = {
         ...options,
         alias: options.alias ?? randomName(options.name),
      };
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
   $$set<U extends T["Update"]>(update: U): T["Update"] extends undefined ? never : Sql {
      ok(update, `Update is required`);
      ok(Object.keys(update), `Update doesn't have any values`);
      return new TableUpdateSet(this.$$.cols, update) as unknown as T["Update"] extends undefined ? never : Sql;
   }

   /**
    * Generates the SQL code for INSERT
    * @param inserts array of records to insert
    */
   $$values(...inserts: T["Insert"][]): T["Insert"] extends undefined ? never : Sql {
      ok(insertsAreValid(inserts), `Invalid inserts`);
      return new TableInsertValues(this.$$.cols, inserts) as never as T["Insert"] extends undefined ? never : Sql;
   }

   build(context: SqlQueryContext) {
      const { strings } = context;
      const schema = this.$$.schema ? `"${this.$$.schema}".` : "";

      const format = this.options.format ?? context.formatter.getTableFormat(context);
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

function insertsAreValid(values: unknown[]): values is RowIn[] {
   if (!values.length) return false;
   return !values.some((value) => !value);
}
