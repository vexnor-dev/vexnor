import { SqlQueryContext } from "../query/index.js";
import { Sql } from "../sql-base.js";
import { SqlBuildOptions, SqlColumnType } from "../sql-types.js";
import { SqlColumnFormat } from "../default-formatter.js";

type Whitespace = " " | "\n" | "\t" | "\r";
type TrimKey<Key extends string> = Key extends `${Whitespace}${infer Rest}`
   ? TrimKey<Rest>
   : Key extends `${infer Rest}${Whitespace}`
     ? TrimKey<Rest>
     : Key;

export interface SqlColumnOptions<
   T extends {
      Key: string;
      Type: unknown;
   },
> {
   readonly name: string;
   readonly key: T["Key"];
   readonly tableInfo: { schema?: string; name: string; alias?: string };
   readonly format?: SqlColumnFormat;
}

// eslint-disable-next-line unused-imports/no-unused-vars
type KeyStringsArray<Key extends string> = TemplateStringsArray;

export interface SqlColumnCallable<
   T extends {
      Key: string;
      Type: unknown;
   },
> {
   <Key extends string>(key: ReadonlyArray<Key> | Key): SqlColumn<{ Type: T["Type"]; Key: Key }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlColumnAny = SqlColumn<any>;

export class SqlColumn<
   T extends {
      Key: string;
      Type: unknown;
   },
> extends Sql {
   readonly name: string;
   readonly key: T["Key"];
   readonly tableInfo: { schema?: string; name: string; alias?: string };

   readonly format?: SqlColumnFormat = undefined;

   constructor(options: SqlColumnOptions<T>) {
      super();
      this.name = options.name;
      this.key = options.key;
      this.tableInfo = options.tableInfo;
      this.format = options.format;
   }

   get [Symbol.toStringTag]() {
      const tokens = ["SqlColumn", "(", this.tableInfo, ".", this.name];
      if (this.key) {
         tokens.push(" as ", `${this.key}`);
      }
      tokens.push(")");
      return tokens.join("");
   }

   static newColumn<
      T extends {
         Key: string;
         Type: SqlColumnType;
      },
   >(options: SqlColumnOptions<T>): SqlColumn<T> & SqlColumnCallable<T> {
      const column = new SqlColumn(options);
      const callable = (<Key extends string>(
         strings: TemplateStringsArray & { readonly 0: Key; readonly length: 1 },
      ) => {
         switch (true) {
            case Array.isArray(strings) && strings.length !== 1:
               throw new Error("Template alias is expected to be a single literal with no interpolations");
            case typeof strings === "string" && !strings:
               throw new Error("Template alias is not allowed to be empty");
         }

         const [rawAlias] = strings;
         const alias = rawAlias.trim();

         if (!alias) {
            throw new Error("Column alias cannot be empty");
         }

         return SqlColumn.newColumn<{ Key: TrimKey<Key>; Type: T["Type"] }>({
            name: column.name,
            tableInfo: column.tableInfo,
            format: column.format,
            key: alias as TrimKey<Key>,
         });
      }) as SqlColumnCallable<T>;

      return new Proxy(callable, SqlColumn.ProxyHandler(column)) as unknown as SqlColumn<T> & SqlColumnCallable<T>;
   }

   static ProxyHandler<
      T extends {
         Key: string;
         Type: SqlColumnType;
      },
   >(column: SqlColumn<T>): ProxyHandler<SqlColumnCallable<T>> {
      return {
         get: (_target, prop) => {
            // Forward all property access to the underlying SqlTable instance.
            return Reflect.get(column, prop);
         },
      };
   }

   as<Key extends string>(key: Key): SqlColumn<{ Key: Key; Type: T["Type"] }> {
      return new SqlColumn({
         name: this.name,
         key,
         tableInfo: this.tableInfo,
         format: this.format,
      });
   }

   /**
    * Format the SQL Column using the given format
    * @param format
    */
   $$fmt(format: SqlColumnFormat): SqlColumn<T> {
      return new SqlColumn({
         name: this.name,
         key: this.key,
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
      function q<U extends string | string[]>(text: U) {
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
            if (this.key === this.name || !this.key) {
               push(`${q(this.tableInfo.name)}.${q(this.name)}`);
               break;
            }
            push(`${q(this.tableInfo.name)}.${q(this.name)} as ${q(this.key)}`);
            break;
         }
         case "tableName.columnName":
            return push(`${q(this.tableInfo.name)}.${q(this.name)}`);
         case "columnName":
            return push(`${q(this.name)}`);
         case "tableName.columnAlias":
            return push(`${q(this.tableInfo.name)}.${q(this.key ?? this.name)}`);
         case "columnAlias":
            return push(`${q(this.key ?? this.name)}`);
         case "tableAlias.columnName":
            return push(`${q(context.alias(this.tableInfo))}.${q(this.name)}`);
         case "tableAlias.columnName as columnAlias": {
            if (this.key === this.name || !this.key) {
               push(`${q(context.alias(this.tableInfo))}.${q(this.name)}`);
               break;
            }

            push(`${q(context.alias(this.tableInfo))}.${q(this.name)} as ${q(this.key)}`);
            break;
         }
      }
   }
}
