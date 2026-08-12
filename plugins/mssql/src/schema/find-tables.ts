import { col, param, row, sql, val } from "@vexnor/core";
import { Columns, KeyColumnUsage, ReferentialConstraints, TableConstraints, Tables } from "#src/schema/models.js";

const ReferencedKeyColumnUsage = KeyColumnUsage.as`referenced_key_column_usage`;

const TableColumns = sql`
   SELECT ${row(Columns.$column_name, Columns.$column_default, Columns.$is_nullable, Columns.$udt_name, Columns.$data_type, Columns.$domain_name, Columns.$numeric_precision_radix, Columns.$ordinal_position)},
          ${val`CASE
             WHEN COLUMNPROPERTY(OBJECT_ID(${Columns.$table_schema} + '.' + ${Columns.$table_name}), ${Columns.$column_name}, 'IsComputed') = 1
                THEN 'NO'
             ELSE 'YES' END`.as<{ is_updatable: "YES" | "NO" }>("is_updatable")},
          ${val`CASE
             WHEN COLUMNPROPERTY(OBJECT_ID(${Columns.$table_schema} + '.' + ${Columns.$table_name}), ${Columns.$column_name}, 'IsComputed') = 1
                THEN 'ALWAYS'
             ELSE 'NEVER' END`.as<{ is_generated: "ALWAYS" | "NEVER" }>("is_generated")}
   FROM ${Columns}
   WHERE ${Columns.$table_schema} = ${Tables.out.$table_schema}
     AND ${Columns.$table_name} = ${Tables.out.$table_name}
   ORDER BY ${Columns.$ordinal_position}
`;

export const findPrimaryKeys = sql`
   SELECT ${row(TableConstraints.$table_schema, TableConstraints.$table_name, KeyColumnUsage.$constraint_name, KeyColumnUsage.$column_name, KeyColumnUsage.$ordinal_position)}
   FROM ${TableConstraints}
           JOIN ${KeyColumnUsage} ON ${TableConstraints.$constraint_name} = ${KeyColumnUsage.$constraint_name}
      AND ${TableConstraints.$table_schema} = ${KeyColumnUsage.$table_schema}
      AND ${TableConstraints.$table_name} = ${KeyColumnUsage.$table_name}
   WHERE ${TableConstraints.$table_schema} IN (${param<{ schemas: string[] }>("schemas")})
     AND ${TableConstraints.$constraint_type} = 'PRIMARY KEY'
   ORDER BY ${TableConstraints.$table_schema}, ${TableConstraints.$table_name}, ${KeyColumnUsage.$constraint_name}, ${KeyColumnUsage.$ordinal_position}`;

export const findForeignKeys = sql`
   SELECT ${row(
      KeyColumnUsage.$table_schema,
      KeyColumnUsage.$table_name,
      KeyColumnUsage.$column_name,
      KeyColumnUsage.$constraint_name,
      KeyColumnUsage.$ordinal_position,
      ReferencedKeyColumnUsage.$table_schema.as("referenced_table_schema"),
      ReferencedKeyColumnUsage.$table_name.as("referenced_table_name"),
      ReferencedKeyColumnUsage.$column_name.as("referenced_column_name"),
   )}
   FROM ${KeyColumnUsage}
           JOIN ${TableConstraints} ON ${KeyColumnUsage.$constraint_name} = ${TableConstraints.$constraint_name}
      AND ${KeyColumnUsage.$table_schema} = ${TableConstraints.$table_schema}
           JOIN ${ReferentialConstraints} ON ${TableConstraints.$constraint_name} = ${ReferentialConstraints.$constraint_name}
      AND ${TableConstraints.$table_schema} = ${ReferentialConstraints.$constraint_schema}
           JOIN ${ReferencedKeyColumnUsage} ON ${ReferentialConstraints.$unique_constraint_name} = ${ReferencedKeyColumnUsage.$constraint_name}
      AND ${ReferentialConstraints.$unique_constraint_schema} = ${ReferencedKeyColumnUsage.$table_schema}
      AND ${KeyColumnUsage.$ordinal_position} = ${ReferencedKeyColumnUsage.$ordinal_position}
   WHERE ${TableConstraints.$constraint_type} = 'FOREIGN KEY'
     AND ${TableConstraints.$table_schema} IN (${param<{ schemas: string[] }>("schemas")})
   ORDER BY ${KeyColumnUsage.$table_schema}, ${KeyColumnUsage.$table_name}, ${KeyColumnUsage.$constraint_name}, ${KeyColumnUsage.$ordinal_position}`;

/**
 * Query all tables in the given schemas
 */
export const findTables = sql`
   SELECT ${row(Tables.$table_name, Tables.$table_schema)},
          "table_columns_result"."table_columns" as ${col<{ table_columns: string }>("table_columns")}
   FROM ${Tables}
           OUTER APPLY (SELECT coalesce((${TableColumns.render("default")} for json path, include_null_values), '[]')
                                  AS "table_columns") AS "table_columns_result"
   WHERE ${Tables.$table_schema} IN (${param<{ schemas: string[] }>("schemas")})
     AND ${Tables.$table_type} = 'BASE TABLE'
   ORDER BY ${Tables.$table_schema}, ${Tables.$table_name}`;

/**
 * Query all views in the given schemas
 */
export const findViews = sql`
   SELECT ${row(Tables.$table_name, Tables.$table_schema)},
          "table_columns_result"."table_columns" as ${col<{ table_columns: string }>("table_columns")}
   FROM ${Tables}
           OUTER APPLY (SELECT coalesce((${TableColumns.render("default")} for json path, include_null_values), '[]')
                                  AS "table_columns") AS "table_columns_result"
   WHERE ${Tables.$table_schema} IN (${param<{ schemas: string[] }>("schemas")})
     AND ${Tables.$table_type} = 'VIEW'
   ORDER BY ${Tables.$table_schema}, ${Tables.$table_name}`;
