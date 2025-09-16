import { SqlQueryContext } from "./sql-query-context.js";
import { Sql, SqlBuildOptions } from "./sql-base.js";
import { x } from "../x.js";
import { SqlBuildError } from "./sql-build-error.js";
import { SqlKeyword } from "./sql-keyword.js";

export interface SqlColumnOptions {
   readonly name: string;
   readonly table: string;
   readonly alias?: string;
   readonly format?: SqlColumnFormat;
}

export type SqlColumnFormat = "table.column" | "column" | "table.alias" | "alias" | "table.column as alias";

const SQL_COLUMN_FORMATS: Partial<Record<SqlKeyword, SqlColumnFormat>> = {
   select: "table.column as alias",
   returning: "table.column as alias",
   fn: "table.column",
   where: "table.column",
   on: "table.column",
   insert: "column",
   values: "column",
   set: "column",
   "group by": "table.column",
   "order by": "table.column",
};

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
      const tokens = ["SqlColumn", "(", this.table, ".", this.name];
      if (this.alias) {
         tokens.push(" as ", `${this.alias}`);
      }
      tokens.push(")");
      return tokens.join("");
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

      const format = x(() => {
         if (this.format) return this.format;

         if (!keyword) {
            throw new SqlBuildError(`SQL context keyword required for column '${this.table}.${this.name}'`, {
               token: this,
               strings,
            });
         }

         if (!SQL_COLUMN_FORMATS[keyword]) {
            throw new SqlBuildError(
               `Unknown SQL context keyword for column '${this.table}.${this.name}' and keyword '${keyword}'`,
               {
                  token: this,
                  strings,
               },
            );
         }

         return SQL_COLUMN_FORMATS[keyword];
      });

      // Use this.format if available
      switch (format) {
         case "table.column as alias": {
            if (this.alias === this.name || !this.alias) {
               push(`${q(this.table)}.${q(this.name)}`);
               break;
            }
            push(`${q(this.table)}.${q(this.name)} as ${q(this.alias)}`);
            break;
         }
         case "table.column":
            return push(`${q(this.table)}.${q(this.name)}`);
         case "column":
            return push(`${q(this.name)}`);
         case "table.alias":
            return push(`${q(this.table)}.${q(this.alias ?? this.name)}`);
         case "alias":
            return push(`${q(this.alias ?? this.name)}`);
      }
   }
}
