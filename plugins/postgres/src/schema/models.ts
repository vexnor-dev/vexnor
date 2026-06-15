import { newSqlTable } from "@vexnor/core";

export const PgType = newSqlTable<{
   Select: { oid: number; typname: string; typcategory: string; typnamespace: number; typelem: number };
}>({
   crud: {
      select: true,
      insert: false,
      update: false,
      delete: false,
   },
   tableInfo: {
      schema: "pg_catalog",
      name: "pg_type",
   },
   pk: [],
   columns: {
      oid: "oid",
      typname: "typname",
      typcategory: "typcategory",
      typnamespace: "typnamespace",
      typelem: "typelem",
   },
});

export const PgEnum = newSqlTable<{
   Select: { oid: number; enumtypid: number; enumlabel: string; enumsortorder: number };
}>({
   crud: {
      select: true,
      insert: false,
      update: false,
      delete: false,
   },
   tableInfo: {
      name: "pg_enum",
      schema: "pg_catalog",
   },
   pk: [],
   columns: {
      oid: "oid",
      enumtypid: "enumtypid",
      enumlabel: "enumlabel",
      enumsortorder: "enumsortorder",
   },
});

export const EnumValues = newSqlTable<{
   Select: { enumtypid: number; enumlabel: string; enumsortorder: number };
}>({
   crud: {
      select: true,
      insert: false,
      update: false,
      delete: false,
   },
   tableInfo: {
      name: "enum_values",
   },
   pk: [],
   columns: {
      enumtypid: "enumtypid",
      enumlabel: "enumlabel",
      enumsortorder: "enumsortorder",
   },
});

export const PgNamespace = newSqlTable<{
   Select: { oid: number; nspname: string };
}>({
   crud: {
      select: true,
      insert: false,
      update: false,
      delete: false,
   },
   tableInfo: {
      name: "pg_namespace",
      schema: "pg_catalog",
   },
   pk: [],
   columns: {
      oid: "oid",
      nspname: "nspname",
   },
});

export const Columns = newSqlTable<{
   Select: IColumnsSelect;
}>({
   crud: {
      select: true,
      insert: false,
      update: false,
      delete: false,
   },
   tableInfo: {
      name: "columns",
      schema: "information_schema",
   },
   pk: [],
   columns: {
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
      ordinal_position: "ordinal_position",
      udt_name: "udt_name",
   },
});

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
   readonly ordinal_position: number;
   readonly udt_name: string;
};

export const TableConstraints = newSqlTable<{
   Select: { constraint_name: string; table_name: string; table_schema: string; constraint_type: string };
}>({
   crud: {
      select: true,
      insert: false,
      update: false,
      delete: false,
   },
   tableInfo: {
      name: "table_constraints",
      schema: "information_schema",
   },
   pk: [],
   columns: {
      constraint_name: "constraint_name",
      table_name: "table_name",
      table_schema: "table_schema",
      constraint_type: "constraint_type",
   },
});

export const KeyColumnUsage = newSqlTable<{
   Select: {
      constraint_name: string;
      table_name: string;
      table_schema: string;
      column_name: string;
      ordinal_position: number;
   };
}>({
   crud: {
      select: true,
      insert: false,
      update: false,
      delete: false,
   },
   tableInfo: {
      name: "key_column_usage",
      schema: "information_schema",
   },
   pk: [],
   columns: {
      constraint_name: "constraint_name",
      table_name: "table_name",
      table_schema: "table_schema",
      column_name: "column_name",
      ordinal_position: "ordinal_position",
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
   tableInfo: {
      name: "referential_constraints",
      schema: "information_schema",
   },
   pk: [],
   columns: {
      constraint_name: "constraint_name",
      constraint_schema: "constraint_schema",
      unique_constraint_name: "unique_constraint_name",
      unique_constraint_schema: "unique_constraint_schema",
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
   tableInfo: {
      name: "constraint_column_usage",
      schema: "information_schema",
   },
   pk: [],
   columns: {
      constraint_name: "constraint_name",
      constraint_schema: "constraint_schema",
      table_name: "table_name",
      table_schema: "table_schema",
      column_name: "column_name",
   },
});