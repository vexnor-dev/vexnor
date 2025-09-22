import { newSqlTable } from "valnor";

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
   },
   {
      table_name: "TABLE_NAME",
      table_schema: "TABLE_SCHEMA",
      column_name: "COLUMN_NAME",
      data_type: "DATA_TYPE",
      is_nullable: "IS_NULLABLE",
      column_default: "COLUMN_DEFAULT",
      character_maximum_length: "CHARACTER_MAXIMUM_LENGTH",
      numeric_precision: "NUMERIC_PRECISION",
      numeric_scale: "NUMERIC_SCALE",
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
