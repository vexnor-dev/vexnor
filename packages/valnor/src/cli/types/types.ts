import { SqlLiteralType } from "./sql-literal.js";
import { logger } from "../logger.js";
import { x } from "../../lib/x.js";

export interface SqlColumnInfo {
   column_default: string | null;
   column_name: string;
   domain_name?: string;
   udt_name?: string;
   is_nullable: "YES" | "NO";
   is_updatable: "YES" | "NO";
   numeric_precision_radix?: number;
}

export type SqlTableInfo = {
   table_name: string;
   table_columns: SqlColumnInfo[];
   table_schema: string;
   primary_key?: string;
};

export type SqlTableInfoArgs = Omit<SqlTableInfo, "table_columns"> & { table_columns: string };

export function SqlTableInfo({ table_columns, ...args }: SqlTableInfoArgs): SqlTableInfo {
   let data: undefined | SqlColumnInfo[];
   try {
      data = JSON.parse(table_columns) as SqlColumnInfo[];
   } catch (error) {
      logger.error({ json: table_columns }, `Error parsing table_columns from JSON text`);
      throw error;
   }

   return {
      ...args,
      table_columns: data,
   };
}

export interface SqlEnumValue {
   enum_label: string;
}

export type SqlEnumInfo = {
   enum_name: string;
   enum_schema: string;
   enum_values: SqlEnumValue[];
};

export interface SqlOutputFile {
   schemaName: string;
   moduleName: string;
   fileName: string;
   tableTypeName?: string;
}

export interface SqlTableKey {
   column_name: string;
   data_type: string;
}

export interface FindEnums {
   (args: { schemas: string[] }): Promise<SqlEnumInfo[]>;
}

export interface FindTables {
   (args: { schemas: string[] }): Promise<SqlTableInfo[]>;
}

export interface ColumnType {
   type: SqlLiteralType;
   udt?: string;
}

export type SqlDriver = "pg" | "postgres.js" | "mssql" | "mysql" | "better-sqlite3";

export const SqlDrivers: SqlDriver[] = x(() => {
   return Object.keys({
      pg: null,
      "postgres.js": null,
      mssql: null,
      mysql: null,
      "better-sqlite3": null,
   } satisfies Record<SqlDriver, null>) as SqlDriver[];
});

export interface GetColumnType {
   (columns: SqlColumnInfo): ColumnType;
}

export interface CommandOptions {
   outDir: string;
   uri?: string;
   schema: string[];
   pascalCaseTables?: boolean;
   camelCaseColumns?: boolean;
   driver: "pg" | "postgres.js";
   host?: string;
   database?: string;
   user?: string;
   password?: string;
   port?: number;
}

export interface PrintTableArgs {
   table: SqlTableInfo;
}
