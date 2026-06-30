import { newSqlTable } from "@vexnor/core";

export const Tables = newSqlTable<{ Select: { table_name: string; table_schema: string; table_type: string } }>({
   crud: {
      select: true,
      insert: false,
      update: false,
      delete: false,
   },
   pk: [],
   tableInfo: {
      name: "TABLES",
      schema: "INFORMATION_SCHEMA",
   },
   columns: {
      table_name: "TABLE_NAME",
      table_schema: "TABLE_SCHEMA",
      table_type: "TABLE_TYPE",
   },
});

export const Columns = newSqlTable<{
   Select: {
      is_updatable: string;
      column_name: string;
      udt_name: string;
      is_nullable: string;
      column_default: string | null;
      numeric_precision_radix: number | null;
      domain_name: string | null;
      table_schema: string;
      table_name: string;
      ordinal_position: number;
      data_type: string;
   };
}>({
   crud: {
      select: true,
      insert: false,
      update: false,
      delete: false,
   },
   pk: [],
   tableInfo: {
      name: "COLUMNS",
      schema: "INFORMATION_SCHEMA",
   },
   columns: {
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
});

export const TableConstraints = newSqlTable<{
   Select: { constraint_name: string; table_name: string; table_schema: string; constraint_type: string };
}>({
   crud: {
      select: true,
      insert: false,
      update: false,
      delete: false,
   },
   pk: [],
   tableInfo: {
      name: "TABLE_CONSTRAINTS",
      schema: "INFORMATION_SCHEMA",
   },
   columns: {
      constraint_name: "CONSTRAINT_NAME",
      table_name: "TABLE_NAME",
      table_schema: "TABLE_SCHEMA",
      constraint_type: "CONSTRAINT_TYPE",
   },
});

export const KeyColumnUsage = newSqlTable<{
   Select: { constraint_name: string; table_name: string; table_schema: string; column_name: string };
}>({
   crud: {
      select: true,
      insert: false,
      update: false,
      delete: false,
   },
   pk: [],
   tableInfo: {
      name: "KEY_COLUMN_USAGE",
      schema: "INFORMATION_SCHEMA",
   },
   columns: {
      constraint_name: "CONSTRAINT_NAME",
      column_name: "COLUMN_NAME",
      table_name: "TABLE_NAME",
      table_schema: "TABLE_SCHEMA",
   },
});

export const ReferentialConstraints = newSqlTable<{
   Select: {
      constraint_name: string;
      constraint_schema: string;
      unique_constraint_name: string;
      unique_constraint_schema: string;
   };
}>({
   crud: {
      select: true,
      insert: false,
      update: false,
      delete: false,
   },
   pk: [],
   tableInfo: {
      name: "REFERENTIAL_CONSTRAINTS",
      schema: "INFORMATION_SCHEMA",
   },
   columns: {
      constraint_name: "CONSTRAINT_NAME",
      constraint_schema: "CONSTRAINT_SCHEMA",
      unique_constraint_name: "UNIQUE_CONSTRAINT_NAME",
      unique_constraint_schema: "UNIQUE_CONSTRAINT_SCHEMA",
   },
});

export const ConstraintColumnUsage = newSqlTable<{
   Select: {
      constraint_name: string;
      constraint_schema: string;
      table_name: string;
      table_schema: string;
      column_name: string;
   };
}>({
   crud: {
      select: true,
      insert: false,
      update: false,
      delete: false,
   },
   pk: [],
   tableInfo: {
      name: "CONSTRAINT_COLUMN_USAGE",
      schema: "INFORMATION_SCHEMA",
   },
   columns: {
      constraint_name: "CONSTRAINT_NAME",
      constraint_schema: "CONSTRAINT_SCHEMA",
      table_name: "TABLE_NAME",
      table_schema: "TABLE_SCHEMA",
      column_name: "COLUMN_NAME",
   },
});