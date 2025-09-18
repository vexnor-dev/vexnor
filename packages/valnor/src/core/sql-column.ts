import { SqlQueryContext } from "./sql-query-context.js";
import { Sql, SqlBuildOptions } from "./sql-base.js";
import { SqlBuildError } from "./sql-build-error.js";
import { SqlKeyword } from "./sql-keyword.js";

export interface SqlColumnOptions {
   readonly name: string;
   readonly table: { name: string; alias?: string };
   readonly alias?: string;
   readonly format?: SqlColumnFormat;
}

export type SqlColumnFormat =
   | "table.column"
   | "table.column as alias"
   | "tableName.column"
   | "column"
   | "tableName.alias"
   | "alias"
   | "tableName.column as alias"
   | "tableAlias.column"
   | "tableAlias.column as alias";

const SQL_COLUMN_FORMATS: Partial<Record<SqlKeyword, SqlColumnFormat>> = {
   select: "tableAlias.column as alias",
   returning: "tableAlias.column as alias",
   fn: "tableAlias.column",
   where: "tableAlias.column",
   on: "tableAlias.column",
   "insert into": "column",
   values: "column",
   set: "column",
   "group by": "tableAlias.column",
   "order by": "tableAlias.column",
};

const DEFAULT_COLUMN_FORMAT: SqlColumnFormat = "tableAlias.column";

export class SqlColumn extends Sql {
   readonly name: string;
   readonly table: { name: string; alias?: string };
   readonly alias?: string = undefined;
   readonly format?: SqlColumnFormat = undefined;

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

   static getFormat(column: SqlColumn, context: SqlQueryContext): SqlColumnFormat {
      if (!context.keyword) {
         throw new SqlBuildError(`SQL context keyword required for column '${column.table.name}.${this.name}'`, {
            token: column,
            strings: context.strings,
         });
      }

      return SQL_COLUMN_FORMATS[context.keyword] ?? DEFAULT_COLUMN_FORMAT;
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

   build(context: SqlQueryContext, options?: SqlBuildOptions) {
      const { strings } = context;

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

      const format = options?.formatProvider
         ? options.formatProvider.getColumnFormat(this, context)
         : SqlColumn.getFormat(this, context);

      // Use this.format if available
      switch (format) {
         case "tableName.column as alias": {
            if (this.alias === this.name || !this.alias) {
               push(`${q(this.table.name)}.${q(this.name)}`);
               break;
            }
            push(`${q(this.table.name)}.${q(this.name)} as ${q(this.alias)}`);
            break;
         }
         case "tableName.column":
            return push(`${q(this.table.name)}.${q(this.name)}`);
         case "column":
            return push(`${q(this.name)}`);
         case "tableName.alias":
            return push(`${q(this.table.name)}.${q(this.alias ?? this.name)}`);
         case "alias":
            return push(`${q(this.alias ?? this.name)}`);
         case "table.column":
         case "tableAlias.column":
            return push(`${q(this.table.alias ?? this.table.name)}.${q(this.name)}`);
         case "table.column as alias":
         case "tableAlias.column as alias": {
            if (this.alias === this.name || !this.alias) {
               push(`${q(this.table.alias ?? this.table.name)}.${q(this.name)}`);
               break;
            }
            push(`${q(this.table.alias ?? this.table.name)}.${q(this.name)} as ${q(this.alias)}`);
            break;
         }
      }
   }
}
