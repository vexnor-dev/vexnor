import { SqlColumnFormat } from "../default-formatter.js";
import { TYPE, Sql } from "../sql-base.js";
import { SqlBuildContext, SqlBuildOptions } from "../query/index.js";

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

export class SqlTableColumn<
   T extends {
      Key: string;
      Type: unknown;
   },
> extends Sql {
   declare readonly [TYPE]: Record<T["Key"], T["Type"]>;

   readonly key: T["Key"];
   readonly columnName: string;
   readonly tableInfo: { schema?: string; name: string; alias?: string };
   readonly format?: SqlColumnFormat;

   constructor({ columnName, key, tableInfo, format }: SqlTableColumnOptions<T>) {
      super({
         ID: (() => {
            const table = tableInfo.alias || tableInfo.name;
            const alias = key !== columnName ? ` as ${key}` : "";
            return `${table}.${columnName}${alias}`;
         })(),
      });
      this.columnName = columnName;
      this.key = key;
      this.tableInfo = tableInfo;
      this.format = format;
   }

   as<Key extends string>(key: Key): SqlTableColumn<{ Key: Key; Type: T["Type"] }> {
      return new SqlTableColumn({
         columnName: this.columnName,
         key,
         tableInfo: this.tableInfo,
         format: this.format,
      });
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
>(options: SqlTableColumnOptions<T>): SqlTableColumn<T> {
   return new SqlTableColumn(options);
}
