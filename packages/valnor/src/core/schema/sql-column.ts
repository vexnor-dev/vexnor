import { SqlQueryContext } from "../query/index.js";
import { Sql } from "../sql-base.js";
import { SqlBuildOptions } from "../sql-types.js";
import { SqlColumnFormat } from "../sql-formatter.js";

export interface SqlColumnOptions {
   readonly name: string;
   readonly table: { name: string; alias?: string };
   readonly alias?: string;
   readonly format?: SqlColumnFormat;
}

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

      const format = this.format ?? context.formatter.getColumnFormat(context);

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
