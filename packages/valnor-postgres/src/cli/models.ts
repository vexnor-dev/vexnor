import { newSqlTable } from "valnor";

export const PgType = newSqlTable(
   {
      schema: "pg_catalog",
      name: "pg_type",
   },
   {
      oid: "oid",
      typname: "typname",
      typcategory: "typcategory",
      typnamespace: "typnamespace",
      typelem: "typelem",
   },
);

export const PgEnum = newSqlTable(
   {
      name: "pg_enum",
      schema: "pg_catalog",
   },
   {
      oid: "oid",
      enumtypid: "enumtypid",
      enumlabel: "enumlabel",
      enumsortorder: "enumsortorder",
   },
);

export const EnumValues = newSqlTable(
   {
      name: "enum_values",
   },
   {
      enumtypid: "enumtypid",
      enumlabel: "enumlabel",
      enumsortorder: "enumsortorder",
   },
);

export const PgNamespace = newSqlTable(
   {
      name: "pg_namespace",
      schema: "pg_catalog",
   },
   {
      oid: "oid",
      nspname: "nspname",
   },
);

export const Columns = newSqlTable(
   {
      name: "columns",
      schema: "information_schema",
   },
   {
      table_name: "table_name",
      table_schema: "table_schema",
      column_name: "column_name",
      data_type: "data_type",
      is_nullable: "is_nullable",
      column_default: "column_default",
      character_maximum_length: "character_maximum_length",
      numeric_precision: "numeric_precision",
      numeric_scale: "numeric_scale",
      is_identity: "is_identity",
      identity_generation: "identity_generation",
      identity_start: "identity_start",
      identity_increment: "identity_increment",
      identity_maximum: "identity_maximum",
      identity_minimum: "identity_minimum",
      identity_cycle: "identity_cycle",
      is_generated: "is_generated",
      generation_expression: "generation_expression",
      is_updatable: "is_updatable",
      is_unique: "is_unique",
      is_primary_key: "is_primary_key",
   },
);

export const TableConstraints = newSqlTable(
   {
      name: "table_constraints",
      schema: "information_schema",
   },
   {
      constraint_name: "constraint_name",
      table_name: "table_name",
      table_schema: "table_schema",
      constraint_type: "constraint_type",
   },
);
