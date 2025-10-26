import { logger } from "../cli/logger.js";
import { SqlLiteralType } from "./sql-literal.js";

export interface SqlColumnInfo {
   column_default: string | null;
   column_name: string;
   domain_name?: string;
   udt_name?: string;
   is_nullable: "YES" | "NO";
   is_updatable: "YES" | "NO";
   numeric_precision_radix?: number;
   data_type?: string;
   ordinal_position?: number;
   table_schema: string;
   table_name: string;
}

export type SqlTableInfo = {
   table_name: string;
   table_columns: SqlColumnInfo[];
   table_schema: string;
   primary_keys: string[];
};

export interface SqlEnumValue {
   enum_label: string;
}

export type SqlEnumInfo = {
   enum_name: string;
   enum_schema: string;
   enum_values: SqlEnumValue[];
};

export interface SqlColumnType {
   type: SqlLiteralType;
   udt?: string;
   isArray?: boolean;
}

export type SqlTableInfoArgs = Omit<SqlTableInfo, "table_columns"> & { table_columns: string };

export function newSqlTableInfo({ table_columns, ...args }: SqlTableInfoArgs): SqlTableInfo {
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

export interface SqlOutputFile {
   schemaName: string;
   moduleName: string;
   fileName: string;
   tableTypeName?: string;
}

export interface PrintTableArgs {
   table: SqlTableInfo;
}

export type LibraryOutputFile = Pick<SqlOutputFile, "fileName">;
