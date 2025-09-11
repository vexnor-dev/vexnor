import { SqlQueryContext } from "./sql-query-context.js";
import { Sql, SqlBuildOptions } from "./sql-base.js";

export interface SqlColumnOptions {
   readonly name: string;
   readonly table: string;
   readonly alias?: string;
   readonly format?: SqlColumnFormat;
}

export type SqlColumnFormat = "table.name" | "name" | "table.alias" | "alias" | "table.name+alias";

export class SqlColumn extends Sql {
   readonly name: string;
   readonly table: string;
   readonly alias?: string;
   readonly format?: SqlColumnFormat;

   constructor(options: SqlColumnOptions) {
      super();
      this.name = options.name;
      this.table = options.table;
      this.alias = options.alias;
      this.format = options.format;
   }

   get [Symbol.toStringTag]() {
      const tokens = ["SqlColumn", "(", this.table, this.name];
      if (this.alias) {
         tokens.push(" ", `${this.alias}`);
      }
      tokens.push(")");
      return tokens.join();
   }

   /**
    * Format the SQL Column using the given format
    * @param format
    */
   $$fmt(format: SqlColumnFormat): SqlColumn {
      return new SqlColumn({
         name: this.name,
         table: this.table,
         format,
      });
   }

   build({ keyword, strings }: SqlQueryContext, options?: SqlBuildOptions) {
      /**
       * Quotes text when different from "*".
       * Used for controlling quoting for column names
       * @param text
       */
      function q<T extends string | string[]>(text: T) {
         function __q__(text: string) {
            return text === "*" ? text : `"${text}"`;
         }

         if (Array.isArray(text)) {
            return text.map((t) => `${__q__(t)}`);
         }

         return `${__q__(text)}`;
      }

      function push(...tokens: string[]) {
         if (options?.onAddString) {
            strings.push(...tokens.map(options.onAddString));
            return;
         }

         strings.push(...tokens);
      }

      switch (this.format) {
         case "table.name+alias": {
            if (this.alias === this.name || !this.alias) {
               push(`${q(this.table)}.${q(this.name)}`);
               break;
            }

            push(`${q(this.table)}.${q(this.name)} as ${q(this.alias)}`);
            break;
         }
         case "table.name":
            return push(`${q(this.table)}.${q(this.name)}`);
         case "name":
            return push(`${q(this.name)}`);
         case "table.alias":
            return push(`${q(this.table)}."${q(this.alias ?? this.name)}`);
         case "alias":
            return push(`${q(this.alias ?? this.name)}`);
      }

      switch (keyword) {
         case "select": {
            if (this.alias === this.name || !this.alias) {
               push(`${q(this.table)}.${q(this.name)}`);
               break;
            }

            push(`${q(this.table)}.${q(this.name)} as ${q(this.alias)}`);
            break;
         }
         case "returning":
            if (this.alias === this.name || !this.alias) {
               push(`${q(this.name)}`);
               break;
            }

            push(`${q(this.name)} ${q(this.alias)}`);
            break;
         case "fn":
            push(`${q(this.table)}.${q(this.name)}`);
            break;
         case "where":
            push(`${q(this.table)}.${q(this.name)}`);
            break;
         case "on":
            push(`${q(this.table)}.${q(this.name)}`);
            break;
         case "insert":
            push(`${q(this.name)}`);
            break;
         case "values":
            push(`${q(this.name)}`);
            break;
         case "set":
            push(`${q(this.name)}`);
            break;
         case "group by":
            push(`${q(this.table)}.${q(this.name)}`);
            break;
         default:
            throw new TypeError(`Unknown SQL context keyword: ${keyword}`);
      }
   }
}
