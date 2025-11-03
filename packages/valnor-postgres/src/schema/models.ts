import { newSqlTable } from "valnor";

export const PgType = newSqlTable(
   {
      schema: "pg_catalog",
      name: "pg_type",
      types: <
         { Select: { oid: number; typname: string; typcategory: string; typnamespace: number; typelem: number } }
      >{},
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
      types: <{ Select: { oid: number; enumtypid: number; enumlabel: string; enumsortorder: number } }>{},
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
      types: <{ Select: { enumtypid: number; enumlabel: string; enumsortorder: number } }>{},
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
      types: <{ Select: { oid: number; nspname: string } }>{},
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
      types: <{ Select: IColumnsSelect }>{},
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
      // is_unique: "is_unique",
      // is_primary_key: "is_primary_key",
      ordinal_position: "ordinal_position",
      udt_name: "udt_name",
   },
);

export type IColumnsSelect = {
   readonly table_name: string;
   readonly table_schema: string;
   readonly column_name: string;
   readonly data_type: string;
   readonly is_nullable: string;
   readonly column_default: string | null;
   readonly character_maximum_length: number | null;
   readonly numeric_precision: number | null;
   readonly numeric_scale: number | null;
   readonly is_identity: string;
   readonly identity_generation: string | null;
   readonly identity_start: number | null;
   readonly identity_increment: number | null;
   readonly identity_maximum: number | null;
   readonly identity_minimum: number | null;
   readonly identity_cycle: string;
   readonly is_generated: string;
   readonly generation_expression: string | null;
   readonly is_updatable: string;
   // readonly is_unique: string;
   // readonly is_primary_key: string;
   readonly ordinal_position: number;
};

export const TableConstraints = newSqlTable(
   {
      name: "table_constraints",
      schema: "information_schema",
      types: <
         { Select: { constraint_name: string; table_name: string; table_schema: string; constraint_type: string } }
      >{},
   },
   {
      constraint_name: "constraint_name",
      table_name: "table_name",
      table_schema: "table_schema",
      constraint_type: "constraint_type",
   },
);
