import { SqlLiteralType } from "#src/plugin/sql-literal.js";

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

export interface SqlPrimaryKeyInfo {
   constraint_name: string;
   column_name: string;
   ordinal_position?: number;
   table_schema: string;
   table_name: string;
}

export interface SqlPrimaryKeyInfo {
   table_schema: string;
   table_name: string;
   column_name: string;
   ordinal_position?: number;
}

export interface SqlForeignKeyInfo {
   constraint_name: string;
   column_name: string;
   referenced_table_schema: string;
   referenced_table_name: string;
   referenced_column_name: string;
   table_schema: string;
   table_name: string;
}

export interface SqlDbColumnSchema {
   dbType: string;
   type: SqlLiteralType;
   nullable?: boolean;
   default?: string;
   values?: string[];
}

export type SqlTableInfo = {
   table_name: string;
   table_type: "table" | "view";
   columns: SqlColumnInfo[];
   table_schema: string;
   primary_keys: SqlPrimaryKeyInfo[];
   foreign_keys?: SqlForeignKeyInfo[];
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
   tsTypeSelect?: string;
   tsTypeInsert?: string;
   tsImport?: string;
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
