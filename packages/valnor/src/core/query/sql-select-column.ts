import { SqlBuildContext } from "../query/index.js";
import { SqlColumnFormat } from "../default-formatter.js";
import { Sql } from "../sql-base.js";
import { SqlBuildOptions } from "../sql-types.js";

export interface SqlSelectColumnOptions<
   T extends {
      Key: string;
      Type: unknown;
   },
> {
   readonly columnName: string;
   readonly key: T["Key"];
   readonly format?: SqlColumnFormat;
   readonly tableInfo?: { name: string; alias?: string };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlSelectColumnAny = SqlSelectColumn<any>;

export type SqlSelectColumnExtended<
   T extends {
      Key: string;
      Type: unknown;
   },
> = SqlSelectColumn<T> & {
   <Key extends string>(key: Key): SqlSelectColumn<{ Key: Key; Type: T["Type"] }>;
};

export class SqlSelectColumn<
   T extends {
      Key: string;
      Type: unknown;
   },
> extends Sql {
   readonly ID: string;
   readonly columnName: string;
   readonly key: T["Key"];
   readonly format?: SqlColumnFormat;

   constructor({ key, format }: SqlSelectColumnOptions<T>) {
      super();
      this.key = key;
      this.format = format;
      this.columnName = this.key;
      this.ID = (() => {
         const alias = this.key !== this.columnName ? ` as ${this.key}` : "";
         return `SqlSelectColumn(${this.columnName}${alias})`;
      })();
   }

   // eslint-disable-next-line unused-imports/no-unused-vars
   build(context: SqlBuildContext, _options?: SqlBuildOptions) {
      const tableInfo = {
         alias: context.queryName(this),
         name: context.queryName(this),
      };

      const format = this.format ?? context.formatter.getColumnFormat(context);
      switch (format) {
         case "tableName.columnName as columnAlias": {
            if (this.key === this.columnName || !this.key) {
               context.addQuotes(`${tableInfo.name}.${this.columnName}`);
               break;
            }
            context.addQuotes(`${tableInfo.name}.${this.columnName} as ${this.key}`);
            break;
         }
         case "tableName.columnName":
            context.addQuotes(`${tableInfo.name}.${this.columnName}`);
            break;
         case "columnName":
            context.addQuotes(`${this.columnName}`);
            break;
         case "tableName.columnAlias":
            context.addQuotes(`${tableInfo.name}.${this.key ?? this.columnName}`);
            break;
         case "columnAlias":
            context.addQuotes(`${this.key ?? this.columnName}`);
            break;
         case "tableAlias.columnName":
            context.addQuotes(`${context.alias(tableInfo)}.${this.columnName}`);
            break;
         case "tableAlias.columnName as columnAlias": {
            if (this.key === this.columnName || !this.key) {
               context.addQuotes(`${context.alias(tableInfo)}.${this.columnName}`);
               break;
            }

            context.addQuotes(`${context.alias(tableInfo)}.${this.columnName} as ${this.key}`);
            break;
         }
      }
   }
}

export function newSqlSelectColumn<
   T extends {
      Key: string;
      Type: unknown;
   },
>(options: SqlSelectColumnOptions<T>): SqlSelectColumnExtended<T> {
   const column = new SqlSelectColumn(options);
   const name = column.toString();
   const sqlSelectColumn = { [name]: () => {} }[name];
   return new Proxy(sqlSelectColumn as () => void, {
      getPrototypeOf(): object | null {
         return SqlSelectColumn.prototype;
      },
      apply<Key extends string>(
         _target: unknown,
         _thisArg: unknown,
         argArray: Key[] | Key,
      ): SqlSelectColumn<{ Key: Key; Type: T["Type"] }> {
         const key = Array.isArray(argArray[0]) ? argArray[0][0] : argArray;
         if (!key) {
            throw new Error("Column alias cannot be empty");
         }

         return new SqlSelectColumn<{ Key: Key; Type: T["Type"] }>({
            key: key,
            format: column.format,
            columnName: column.columnName,
         });
      },
      get(_target, p: string | symbol, receiver: unknown): unknown {
         const result = Reflect.get(column, p, receiver);
         if (typeof result === "function") return result.bind(column);
         return result;
      },
   }) as unknown as SqlSelectColumnExtended<T>;
}
