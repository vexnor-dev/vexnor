import { SqlColumn } from "./sql-column.js";
import { SqlQueryContext } from "./sql-query-context.js";
import { x } from "./x.js";
import { Sql } from "./sql-base.js";
import { ok } from "assert";
import { SqlInsertValues } from "./sql-insert-values.js";
import { RowIn } from "./sql-types.js";
import { SqlUpdateSet } from "./sql-update-set.js";
import { generateRandomName } from "./types.js";

export interface SqlTableOptions {
   readonly schema?: string;
   readonly name: string;
   readonly alias?: string;
   readonly pk?: SqlColumn;
   readonly cols: Record<string, SqlColumn>;
}

export class SqlTable<T extends { Insert: RowIn; Update: RowIn }> extends Sql {
   readonly $schema?: string;
   readonly $name: string;
   readonly $alias?: string;
   readonly $cols: Record<string, SqlColumn>;
   readonly $pk?: SqlColumn;

   constructor(options: SqlTableOptions) {
      super();
      this.$schema = options.schema;
      this.$name = options.name;
      this.$pk = options.pk;
      this.$alias = options.alias ?? `${options.name}_${generateRandomName(3)}`;
      this.$cols = options.cols;
   }

   get $all(): SqlColumn[] {
      return Object.values(this.$cols);
   }

   get [Symbol.toStringTag]() {
      const tokens = [];
      if (this.$schema) {
         tokens.push(this.$schema, ".");
      }
      tokens.push(this.$name);
      if (this.$alias) {
         tokens.push(" as", this.$alias);
      }

      return tokens.join();
   }

   $as(alias: string): SqlTable<T> {
      return new SqlTable({ name: this.$name, schema: this.$schema, alias, cols: this.$cols });
   }

   /**
    * Generates the SQL code for UPDATE set values
    * @param update record with update values
    */
   $set<U extends T["Update"]>(update: U): Sql {
      ok(Object.keys(update), `Update doesn't have any values`);
      return new SqlUpdateSet(this.$cols, update);
   }

   /**
    * Generates the SQL code for INSERT
    * @param inserts array of records to insert
    */
   $values(...inserts: T["Insert"][]): Sql {
      ok(inserts.length, `No rows for insert`);
      return new SqlInsertValues<T>(this.$cols, inserts);
   }

   build({ keyword }: SqlQueryContext) {
      const schema = this.$schema ? `"${this.$schema}".` : "";
      switch (keyword) {
         case "with":
            return { strings: [`"${this.$name}"`] };
         case "insert":
            return { strings: [`${schema}"${this.$name}"`] };
         case "update":
            if (this.$name === this.$alias) return { strings: [`${schema}"${this.$name}"`] };
            return { strings: [`${schema}"${this.$name}" "${this.$alias}"`] };
         case "delete":
            return { strings: [`${schema}"${this.$name}"`] };
         case "join":
            if (this.$name === this.$alias) return { strings: [`${schema}"${this.$name}"`] };
            else return { strings: [`${schema}"${this.$name}" "${this.$alias}"`] };
         case "from":
            if (this.$name === this.$alias) return { strings: [`${schema}"${this.$name}"`] };
            else return { strings: [`${schema}"${this.$name}" "${this.$alias}"`] };
         case "fn":
            return { strings: [`"${this.$alias ?? this.$name}"`] };
         default:
            throw new Error(`Unknown command: ${keyword}`);
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
