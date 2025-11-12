import { SqlColumnFormat } from "../default-formatter.js";
import { Sql } from "../sql-base.js";
import { SqlBuildContext } from "../query/index.js";
import { SqlBuildOptions } from "../sql-types.js";
import { ISqlColumn } from "../types/index.js";

export interface SqlTableColumnOptions<
   T extends {
      Key: string;
      Type: unknown;
   },
> {
   readonly columnName: string;
   readonly key: T["Key"];
   readonly tableInfo: { schema?: string; name: string; alias?: string };
   readonly format?: SqlColumnFormat;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlTableColumnAny = SqlTableColumn<any>;

export type SqlTableColumnExtended<
   T extends {
      Key: string;
      Type: unknown;
   },
> = SqlTableColumn<T> & {
   <Key extends string>(key: Key): SqlTableColumn<{ Key: Key; Type: T["Type"] }>;
};

export class SqlTableColumn<
      T extends {
         Key: string;
         Type: unknown;
      },
   >
   extends Sql
   implements ISqlColumn<T>
{
   readonly key: T["Key"];
   readonly columnName: string;
   readonly tableInfo: { schema?: string; name: string; alias?: string };
   readonly format?: SqlColumnFormat;
   readonly ID: string;

   constructor({ columnName, key, tableInfo, format }: SqlTableColumnOptions<T>) {
      super();
      this.columnName = columnName;
      this.key = key;
      this.tableInfo = tableInfo;
      this.format = format;

      this.ID = (() => {
         const table = this.tableInfo.alias || this.tableInfo.name;
         const alias = this.key !== this.columnName ? ` as ${this.key}` : "";
         return `SqlColumn(${table}.${this.columnName}${alias})`;
      })();
   }

   // eslint-disable-next-line unused-imports/no-unused-vars
   build(context: SqlBuildContext, _options?: SqlBuildOptions) {
      const format = this.format ?? context.formatter.getColumnFormat(context);
      switch (format) {
         case "tableName.columnName as columnAlias": {
            if (this.key === this.columnName || !this.key) {
               context.addQuotes(`${this.tableInfo.name}.${this.columnName}`);
               break;
            }
            context.addQuotes(`${this.tableInfo.name}.${this.columnName} as ${this.key}`);
            break;
         }
         case "tableName.columnName":
            context.addQuotes(`${this.tableInfo.name}.${this.columnName}`);
            break;
         case "columnName":
            context.addQuotes(`${this.columnName}`);
            break;
         case "tableName.columnAlias":
            context.addQuotes(`${this.tableInfo.name}.${this.key ?? this.columnName}`);
            break;
         case "columnAlias":
            context.addQuotes(`${this.key ?? this.columnName}`);
            break;
         case "tableAlias.columnName":
            context.addQuotes(`${context.alias(this.tableInfo)}.${this.columnName}`);
            break;
         case "tableAlias.columnName as columnAlias": {
            if (this.key === this.columnName || !this.key) {
               context.addQuotes(`${context.alias(this.tableInfo)}.${this.columnName}`);
               break;
            }

            context.addQuotes(`${context.alias(this.tableInfo)}.${this.columnName} as ${this.key}`);
            break;
         }
      }
   }
}

export function newSqlTableColumn<
   T extends {
      Key: string;
      Type: unknown;
   },
>(options: SqlTableColumnOptions<T>): SqlTableColumnExtended<T> {
   const column = new SqlTableColumn(options);
   const name = column.toString();
   const sqlTableColumn = { [name]: () => {} }[name];
   return new Proxy(sqlTableColumn as () => void, {
      ownKeys(): ArrayLike<string | symbol> {
         return Object.keys(column);
      },
      getPrototypeOf(): object | null {
         return Object.getPrototypeOf(column);
      },
      getOwnPropertyDescriptor(_target, p: string | symbol): PropertyDescriptor | undefined {
         return Reflect.getOwnPropertyDescriptor(column, p);
      },
      has(_target, p: string | symbol): boolean {
         return Object.hasOwn(column, p);
      },
      get(_target, p: string | symbol, receiver: unknown): unknown {
         const result = Reflect.get(column, p, receiver);
         if (typeof result === "function") return result.bind(column);
         return result;
      },
      apply<Key extends string>(_target: unknown, _thisArg: unknown, argArray: Key[]): SqlTableColumn<T> {
         const key = Array.isArray(argArray) ? argArray[0] : argArray;
         if (!key) {
            throw new Error("Column alias cannot be empty");
         }

         return new SqlTableColumn<T>({
            columnName: column.columnName,
            key,
            format: column.format,
            tableInfo: column.tableInfo,
         });
      },
   }) as unknown as SqlTableColumnExtended<T>;
}
