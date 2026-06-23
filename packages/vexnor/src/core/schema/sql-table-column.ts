import { SqlColumnFormat } from "#/core/builder/default-formatter.js";
import { Sql, TYPE } from "#/core/sql-base.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { SqlBuildOptions } from "#/core/builder/sql-build-options.js";
import { SqlTableIdentity } from "#/core/schema/sql-table-identity.js";
import { SqlJsonSchema, SqlJsonType } from "#/core/utils/sql-json-schema.js";

export type SqlTableColumnTypeArgs = {
   Key: string;
   Type: unknown;
};

export type SqlTableColumnOptions<T extends SqlTableColumnTypeArgs> = Pick<
   SqlTableColumn<T>,
   "columnName" | "key" | "tableInfo"
> &
   Partial<Pick<SqlTableColumn<T>, "format" | "jsonType">>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlTableColumnAny = SqlTableColumn<any>;

export class SqlTableColumn<T extends SqlTableColumnTypeArgs> extends Sql {
   declare readonly [TYPE]: Record<T["Key"], T["Type"]>;

   readonly key: T["Key"];
   readonly columnName: string;
   readonly tableInfo: SqlTableIdentity;
   readonly format: SqlColumnFormat | null;
   readonly jsonType: SqlJsonType | null;

   constructor({ columnName, key, tableInfo, format, jsonType }: SqlTableColumnOptions<T>) {
      super({
         type: "SqlTableColumn",
         ...(() => {
            const table = tableInfo.alias || tableInfo.name;
            let hashId = `${table}.${columnName}`;
            if (key !== columnName) hashId += ` as ${key}`;

            return {
               id: hashId,
               hashId,
            };
         })(),
      });
      this.columnName = columnName;
      this.key = key;
      this.tableInfo = tableInfo;
      this.format = format ?? null;
      this.jsonType = jsonType ?? null;
   }

   get jsonSchema(): SqlJsonSchema {
      if (!this.jsonType) {
         return {};
      }

      return { [this.key]: this.jsonType };
   }

   /**
    * Returns a copy of this column reference with a different result key.
    *
    * Use this to rename a column in the SELECT output without changing the
    * underlying column name.
    *
    * @param key - The new result key and TypeScript property name.
    *
    * @example
    * sql`SELECT ${row(Account.$firstName.as("name"))} FROM ${Account}`
    * // result: { name: string }
    */
   as<Key extends string>(key: Key): SqlTableColumn<{ Key: Key; Type: T["Type"] }> {
      return new SqlTableColumn({
         columnName: this.columnName,
         key,
         tableInfo: this.tableInfo,
         format: this.format,
         jsonType: this.jsonType,
      });
   }

   /**
    * Returns a copy of this column with a specific output format.
    *
    * Use this to control how the column is rendered in SQL — e.g., without
    * an alias inside aggregate function calls.
    *
    * @param format - The column format to use when building SQL.
    */
   render(format: SqlColumnFormat): SqlTableColumn<T> {
      return new SqlTableColumn({
         columnName: this.columnName,
         key: this.key,
         tableInfo: this.tableInfo,
         format,
         jsonType: this.jsonType,
      });
   }

   // eslint-disable-next-line unused-imports/no-unused-vars
   write(context: SqlBuildContext, _options?: SqlBuildOptions) {
      const format = this.format ?? context.formatter.getColumnFormat(context);
      switch (format) {
         case "tableName.columnName AS columnAlias": {
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
            context.addQuotes(`${context.getAlias(this.tableInfo)}.${this.columnName}`);
            break;
         case "tableAlias.columnName AS columnAlias": {
            if (this.key === this.columnName || !this.key) {
               context.addQuotes(`${context.getAlias(this.tableInfo)}.${this.columnName}`);
               break;
            }

            context.addQuotes(`${context.getAlias(this.tableInfo)}.${this.columnName} as ${this.key}`);
            break;
         }
         case "rawAlias.columnName":
            context.addStrings(`${this.tableInfo.alias}.${this.columnName}`);
            break;
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
