import { SqlQueryContext } from "./sql-query-context.js";
import { Sql } from "./sql-base.js";
import { SqlBuild } from "./sql-types.js";

export interface SqlColumnOptions {
   readonly name: string;
   readonly table: string;
   readonly alias?: string;
   readonly format?: SqlColumnFormat;
}

export type SqlColumnFormat = "table.name" | "name" | "table.alias" | "alias";

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
   $(format: "table.name" | "name" | "table.alias" | "alias"): SqlColumn {
      return new SqlColumn({
         name: this.name,
         table: this.table,
         format,
      });
   }

   build({ keyword }: SqlQueryContext): SqlBuild {
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

      if (this.format) {
         switch (this.format) {
            case "table.name":
               return { strings: [`${q(this.table)}.${q(this.name)}`] };
            case "name":
               return { strings: [`${q(this.name)}`] };
            case "table.alias":
               return { strings: [`${q(this.table)}."${this.alias ?? this.name}"`] };
            case "alias":
               return { strings: [`"${this.alias ?? this.name}"`] };
         }
      }

      switch (keyword) {
         case "select": {
            if (this.alias === this.name || !this.alias) return { strings: [`${q(this.table)}.${q(this.name)}`] };
            return { strings: [`${q(this.table)}.${q(this.name)} ${q(this.alias)}`] };
         }
         case "returning":
            if (this.alias === this.name || !this.alias) return { strings: [`${q(this.name)}`] };
            return { strings: [`${q(this.name)} ${q(this.alias)}`] };
         case "fn":
            return { strings: [`${q(this.table)}.${q(this.name)}`] };
         case "where":
            return { strings: [`${q(this.table)}.${q(this.name)}`] };
         case "on":
            return { strings: [`${q(this.table)}.${q(this.name)}`] };
         case "insert":
            return { strings: [`${q(this.name)}`] };
         case "values":
            return { strings: [`${q(this.name)}`] };
         case "set":
            return { strings: [`${q(this.name)}`] };
         default:
            throw new TypeError(`Unknown command: ${keyword}`);
      }
   }
}
