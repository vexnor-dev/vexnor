import { SqlQueryContext } from "../query/index.js";
import { Sql } from "../sql-base.js";
import { SqlBuildOptions } from "../sql-types.js";
import { SqlColumnFormat } from "../default-formatter.js";

export interface SqlColumnOptions {
   readonly name: string;
   readonly tableInfo: { schema?: string; name: string; alias?: string };
   readonly alias?: string;
   readonly format?: SqlColumnFormat;
}

export interface SqlColumnCallable {
   (strings: TemplateStringsArray): SqlColumn;
}

export class SqlColumn extends Sql {
   readonly name: string;
   readonly tableInfo: { schema?: string; name: string; alias?: string };
   readonly alias?: string = undefined;
   readonly format?: SqlColumnFormat = undefined;

   constructor(options: SqlColumnOptions) {
      super();
      this.name = options.name;
      this.tableInfo = options.tableInfo;
      this.alias = options.alias;
      this.format = options.format;
   }

   get [Symbol.toStringTag]() {
      const tokens = ["SqlColumn", "(", this.tableInfo, ".", this.name];
      if (this.alias) {
         tokens.push(" as ", `${this.alias}`);
      }
      tokens.push(")");
      return tokens.join("");
   }

   static newColumn(options: SqlColumnOptions): SqlColumn & SqlColumnCallable {
      const fn = () => {};
      const column = new SqlColumn(options);
      return new Proxy(fn, SqlColumn.ProxyHandler(column)) as unknown as SqlColumn & SqlColumnCallable;
   }

   static ProxyHandler(column: SqlColumn): ProxyHandler<() => void> {
      return {
         apply: (_target, _thisArg, args: [TemplateStringsArray]) => {
            const alias = args[0]![0]!.trim();
            // 1. Create the new aliased instance using the existing $$as method.
            return SqlColumn.newColumn({
               name: column.name,
               tableInfo: column.tableInfo,
               format: column.format,
               alias,
            });
         },
         get: (_target, prop) => {
            // Forward all property access to the underlying SqlTable instance.
            return Reflect.get(column, prop);
         },
      };
   }

   /**
    * Format the SQL Column using the given format
    * @param format
    */
   $$fmt(format: SqlColumnFormat): SqlColumn {
      return new SqlColumn({
         name: this.name,
         tableInfo: this.tableInfo,
         format,
      });
   }

   $build(context: SqlQueryContext, options?: SqlBuildOptions) {
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
      switch (format) {
         case "tableName.columnName as columnAlias": {
            if (this.alias === this.name || !this.alias) {
               push(`${q(this.tableInfo.name)}.${q(this.name)}`);
               break;
            }
            push(`${q(this.tableInfo.name)}.${q(this.name)} as ${q(this.alias)}`);
            break;
         }
         case "tableName.columnName":
            return push(`${q(this.tableInfo.name)}.${q(this.name)}`);
         case "columnName":
            return push(`${q(this.name)}`);
         case "tableName.columnAlias":
            return push(`${q(this.tableInfo.name)}.${q(this.alias ?? this.name)}`);
         case "columnAlias":
            return push(`${q(this.alias ?? this.name)}`);
         case "tableAlias.columnName":
            return push(`${q(context.alias(this.tableInfo))}.${q(this.name)}`);
         case "tableAlias.columnName as columnAlias": {
            if (this.alias === this.name || !this.alias) {
               push(`${q(context.alias(this.tableInfo))}.${q(this.name)}`);
               break;
            }

            push(`${q(context.alias(this.tableInfo))}.${q(this.name)} as ${q(this.alias)}`);
            break;
         }
      }
   }
}
