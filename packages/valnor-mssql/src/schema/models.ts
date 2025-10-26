import { newSqlTable } from "valnor";
import { SqlColumnInfo } from "valnor/plugin";

export const Tables = newSqlTable(
   {
      name: "TABLES",
      schema: "INFORMATION_SCHEMA",
   },
   {
      table_name: "TABLE_NAME",
      table_schema: "TABLE_SCHEMA",
      table_type: "TABLE_TYPE",
   },
);

export const Columns = newSqlTable(
   {
      name: "COLUMNS",
      schema: "INFORMATION_SCHEMA",
      types: <{ Select: SqlColumnInfo }>{},
   },
   {
      is_updatable: "IS_UPDATABLE",
      column_name: "COLUMN_NAME",
      udt_name: "DATA_TYPE",
      is_nullable: "IS_NULLABLE",
      column_default: "COLUMN_DEFAULT",
      numeric_precision_radix: "NUMERIC_PRECISION_RADIX",
      domain_name: "DOMAIN_NAME",
      table_schema: "TABLE_SCHEMA",
      table_name: "TABLE_NAME",
      ordinal_position: "ORDINAL_POSITION",
      data_type: "DATA_TYPE",
   },
);

export const TableConstraints = newSqlTable(
   {
      name: "TABLE_CONSTRAINTS",
      schema: "INFORMATION_SCHEMA",
   },
   {
      constraint_name: "CONSTRAINT_NAME",
      table_name: "TABLE_NAME",
      table_schema: "TABLE_SCHEMA",
      constraint_type: "CONSTRAINT_TYPE",
   },
);

export const KeyColumnUsage = newSqlTable(
   {
      name: "KEY_COLUMN_USAGE",
      schema: "INFORMATION_SCHEMA",
   },
   {
      constraint_name: "CONSTRAINT_NAME",
      column_name: "COLUMN_NAME",
      table_name: "TABLE_NAME",
      table_schema: "TABLE_SCHEMA",
   },
);
