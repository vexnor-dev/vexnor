import type { DuckDBConnection, DuckDBValue, JS } from "@duckdb/node-api";
import type {
   SqlColumnInfo,
   SqlEnumInfo,
   SqlForeignKeyInfo,
   SqlPrimaryKeyInfo,
   SqlSchema,
   SqlTableInfo,
} from "@vexnor/core/plugin";

export async function findSchema(connection: DuckDBConnection, schemas: string[]): Promise<SqlSchema> {
   if (!schemas.length) {
      throw new TypeError("At least one DuckDB schema is required");
   }

   const placeholders = schemas.map((_, index) => `$${index + 1}`).join(", ");
   const values: DuckDBValue[] = [...schemas];
   const [tableRows, columnRows, primaryKeyRows, foreignKeyRows, enumRows] = await Promise.all([
      readRows(
         connection,
         `select table_schema, table_name, table_type
          from information_schema.tables
          where table_schema in (${placeholders})
          order by table_schema, table_name`,
         values,
      ),
      readRows(
         connection,
         `select table_schema, table_name, column_name, data_type, is_nullable,
                 column_default, numeric_precision_radix, ordinal_position
          from information_schema.columns
          where table_schema in (${placeholders})
          order by table_schema, table_name, ordinal_position`,
         values,
      ),
      readRows(
         connection,
         `select kcu.constraint_name, kcu.table_schema, kcu.table_name,
                 kcu.column_name, kcu.ordinal_position
          from information_schema.table_constraints tc
          join information_schema.key_column_usage kcu
            on tc.constraint_schema = kcu.constraint_schema
           and tc.constraint_name = kcu.constraint_name
          where tc.constraint_type = 'PRIMARY KEY'
            and tc.table_schema in (${placeholders})
          order by kcu.table_schema, kcu.table_name, kcu.ordinal_position`,
         values,
      ),
      readRows(
         connection,
         `select source.constraint_name,
                 source.table_schema,
                 source.table_name,
                 source.column_name,
                 target.table_schema as referenced_table_schema,
                 target.table_name as referenced_table_name,
                 target.column_name as referenced_column_name
          from information_schema.referential_constraints rc
          join information_schema.key_column_usage source
            on rc.constraint_schema = source.constraint_schema
           and rc.constraint_name = source.constraint_name
          join information_schema.key_column_usage target
            on rc.unique_constraint_schema = target.constraint_schema
           and rc.unique_constraint_name = target.constraint_name
           and source.position_in_unique_constraint = target.ordinal_position
          where source.table_schema in (${placeholders})
          order by source.table_schema, source.table_name, source.ordinal_position`,
         values,
      ),
      readRows(
         connection,
         `select schema_name as enum_schema, type_name as enum_name, labels
          from duckdb_types()
          where logical_type = 'ENUM'
            and labels is not null
            and schema_name in (${placeholders})
          order by schema_name, type_name`,
         values,
      ),
   ]);

   const tables = tableRows.map(toTableInfo);
   const tableIndex = new Map(tables.map((table) => [tableKey(table.table_schema, table.table_name), table]));
   const enums = enumRows.map(toEnumInfo);
   const enumNamesByType = new Map(
      enums.map((enumInfo) => [tableKey(enumInfo.enum_schema, enumDataType(enumInfo)), enumInfo.enum_name]),
   );

   for (const row of columnRows) {
      const schema = requiredString(row, "table_schema");
      const tableName = requiredString(row, "table_name");
      const table = tableIndex.get(tableKey(schema, tableName));
      if (!table) continue;
      const udtName = enumNamesByType.get(tableKey(schema, requiredString(row, "data_type")));
      table.columns.push(toColumnInfo(row, table.table_type, udtName));
   }
   for (const row of primaryKeyRows) {
      const primaryKey = toPrimaryKeyInfo(row);
      tableIndex.get(tableKey(primaryKey.table_schema, primaryKey.table_name))?.primary_keys.push(primaryKey);
   }
   for (const row of foreignKeyRows) {
      const foreignKey = toForeignKeyInfo(row);
      const table = tableIndex.get(tableKey(foreignKey.table_schema, foreignKey.table_name));
      if (table) (table.foreign_keys ??= []).push(foreignKey);
   }

   return {
      tables,
      enums,
   };
}

async function readRows(connection: DuckDBConnection, text: string, values: DuckDBValue[]): Promise<Record<string, JS>[]> {
   const reader = await connection.runAndReadAll(text, values);
   return reader.getRowObjectsJS();
}

function toTableInfo(row: Record<string, JS>): SqlTableInfo {
   return {
      table_schema: requiredString(row, "table_schema"),
      table_name: requiredString(row, "table_name"),
      table_type: requiredString(row, "table_type") === "VIEW" ? "view" : "table",
      columns: [],
      primary_keys: [],
   };
}

function toColumnInfo(
   row: Record<string, JS>,
   tableType: SqlTableInfo["table_type"],
   udtName: string | undefined,
): SqlColumnInfo {
   const isNullable = requiredString(row, "is_nullable");
   if (isNullable !== "YES" && isNullable !== "NO") {
      throw new TypeError(`Unexpected DuckDB is_nullable value: ${isNullable}`);
   }
   return {
      column_default: optionalString(row, "column_default"),
      column_name: requiredString(row, "column_name"),
      data_type: requiredString(row, "data_type"),
      ...(udtName ? { udt_name: udtName } : {}),
      is_nullable: isNullable,
      is_updatable: tableType === "table" ? "YES" : "NO",
      numeric_precision_radix: optionalNumber(row, "numeric_precision_radix"),
      ordinal_position: optionalNumber(row, "ordinal_position"),
      table_schema: requiredString(row, "table_schema"),
      table_name: requiredString(row, "table_name"),
   };
}

function toPrimaryKeyInfo(row: Record<string, JS>): SqlPrimaryKeyInfo {
   return {
      constraint_name: requiredString(row, "constraint_name"),
      column_name: requiredString(row, "column_name"),
      ordinal_position: optionalNumber(row, "ordinal_position"),
      table_schema: requiredString(row, "table_schema"),
      table_name: requiredString(row, "table_name"),
   };
}

function toForeignKeyInfo(row: Record<string, JS>): SqlForeignKeyInfo {
   return {
      constraint_name: requiredString(row, "constraint_name"),
      column_name: requiredString(row, "column_name"),
      referenced_table_schema: requiredString(row, "referenced_table_schema"),
      referenced_table_name: requiredString(row, "referenced_table_name"),
      referenced_column_name: requiredString(row, "referenced_column_name"),
      table_schema: requiredString(row, "table_schema"),
      table_name: requiredString(row, "table_name"),
   };
}

function toEnumInfo(row: Record<string, JS>): SqlEnumInfo {
   const labels = row.labels;
   if (!Array.isArray(labels)) {
      throw new TypeError("DuckDB enum labels must be strings");
   }
   const enumValues = labels.map((label) => {
      if (typeof label !== "string") throw new TypeError("DuckDB enum labels must be strings");
      return { enum_label: label };
   });
   return {
      enum_name: requiredString(row, "enum_name"),
      enum_schema: requiredString(row, "enum_schema"),
      enum_values: enumValues,
   };
}

function enumDataType(enumInfo: SqlEnumInfo): string {
   return `ENUM(${enumInfo.enum_values.map(({ enum_label }) => `'${enum_label.replaceAll("'", "''")}'`).join(", ")})`;
}

function requiredString(row: Record<string, JS>, key: string): string {
   const value = row[key];
   if (typeof value !== "string") throw new TypeError(`DuckDB metadata field '${key}' must be a string`);
   return value;
}

function optionalString(row: Record<string, JS>, key: string): string | null {
   const value = row[key];
   if (value === null || value === undefined) return null;
   if (typeof value !== "string") throw new TypeError(`DuckDB metadata field '${key}' must be a string or null`);
   return value;
}

function optionalNumber(row: Record<string, JS>, key: string): number | undefined {
   const value = row[key];
   if (value === null || value === undefined) return undefined;
   if (typeof value === "bigint") return Number(value);
   if (typeof value !== "number") throw new TypeError(`DuckDB metadata field '${key}' must be a number or null`);
   return value;
}

function tableKey(schema: string, table: string): string {
   return `${schema}\u0000${table}`;
}
