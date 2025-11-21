import { SqlBuildContext, SqlBuildOptions } from "../query/index.js";
import { SqlColumnFormat } from "../default-formatter.js";
import { Sql } from "../sql-base.js";

export interface SqlSelectColumnArgs<
   T extends {
      Key: string;
      Type: unknown;
   },
> {
   readonly columnName: string | null;
   readonly key: T["Key"];
   readonly format?: SqlColumnFormat | null;
   readonly tableInfo?: { name: string; alias?: string } | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlSelectColumnAny = SqlSelectColumn<any>;

export class SqlSelectColumn<
   T extends {
      Key: string;
      Type: unknown;
   },
> extends Sql {
   readonly columnName: string | null;
   readonly key: T["Key"];
   readonly format: SqlColumnFormat | null = null;
   readonly tableInfo: { name: string; alias?: string } | null = null;

   constructor({ key, format, columnName, tableInfo }: SqlSelectColumnArgs<T>) {
      super({
         ID: (() => {
            const alias = key !== columnName ? ` as ${key}` : "";
            return `${columnName}${alias}`;
         })(),
      });
      this.key = key;
      this.format = format ?? null;
      this.columnName = columnName;
      this.tableInfo = tableInfo ?? null;
   }

   as<Key extends string>(key: Key) {
      return new SqlSelectColumn<{ Key: Key; Type: T["Type"] }>({
         columnName: this.columnName,
         format: this.format,
         key,
         tableInfo: this.tableInfo,
      });
   }

   // eslint-disable-next-line unused-imports/no-unused-vars
   build(context: SqlBuildContext, _options?: SqlBuildOptions) {
      const tableInfo = () => {
         if (this.tableInfo) return this.tableInfo;

         return {
            alias: context.getQueryName(this),
            name: context.getQueryName(this),
         };
      };

      const format = this.format ?? context.formatter.getColumnFormat(context);
      switch (format) {
         case "tableName.columnName as columnAlias": {
            if (this.key === this.columnName || !this.key) {
               context.addQuotes(`${tableInfo().name}.${this.columnName}`);
               break;
            }
            context.addQuotes(`${tableInfo().name}.${this.columnName} as ${this.key}`);
            break;
         }
         case "tableName.columnName":
            context.addQuotes(`${tableInfo().name}.${this.columnName}`);
            break;
         case "columnName":
            context.addQuotes(`${this.columnName}`);
            break;
         case "tableName.columnAlias":
            context.addQuotes(`${tableInfo().name}.${this.key ?? this.columnName}`);
            break;
         case "columnAlias":
            context.addQuotes(`${this.key ?? this.columnName}`);
            break;
         case "tableAlias.columnName":
            context.addQuotes(`${context.alias(tableInfo())}.${this.columnName}`);
            break;
         case "tableAlias.columnName as columnAlias": {
            if (this.key === this.columnName || !this.key) {
               context.addQuotes(`${context.alias(tableInfo())}.${this.columnName}`);
               break;
            }

            context.addQuotes(`${context.alias(tableInfo())}.${this.columnName} as ${this.key}`);
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
>(options: SqlSelectColumnArgs<T>): SqlSelectColumn<T> {
   return new SqlSelectColumn(options);
}
