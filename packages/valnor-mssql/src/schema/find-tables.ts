import { col, param, row, sql } from "valnor";
import { Columns, KeyColumnUsage, TableConstraints, Tables } from "./models.js";

const TableColumns = sql`
   SELECT ${row(Columns.$column_name, Columns.$column_default, Columns.$is_nullable, Columns.$udt_name, Columns.$domain_name, Columns.$numeric_precision_radix)},
          CASE
             WHEN COLUMNPROPERTY(OBJECT_ID(${Columns.$table_schema} + '.' + ${Columns.$table_name}), ${Columns.$column_name}, 'IsComputed') = 1
                THEN 'NO'
             ELSE 'YES' END as "is_updatable"
   FROM ${Columns}
   WHERE ${Columns.$table_schema} = ${Tables.out.$table_schema}
     AND ${Columns.$table_name} = ${Tables.out.$table_name}
   ORDER BY ${Columns.$ordinal_position}
`;

export const findPrimaryKeys = sql`
   SELECT DISTINCT ${row(TableConstraints.$table_schema, TableConstraints.$table_name, KeyColumnUsage.$column_name.as(`primary_key`))}
   FROM ${TableConstraints}
           JOIN ${KeyColumnUsage} ON ${TableConstraints.$constraint_name} = ${KeyColumnUsage.$constraint_name}
      AND ${TableConstraints.$table_schema} = ${KeyColumnUsage.$table_schema}
      AND ${TableConstraints.$table_name} = ${KeyColumnUsage.$table_name}
   WHERE ${TableConstraints.$table_schema} IN (${param<{ schemas: string[] }>("schemas")})
     AND ${TableConstraints.$constraint_type} = 'PRIMARY KEY'`;

/**
 * Query all tables in the given schemas
 */
export const findTables = sql`
   SELECT ${row(Tables.$table_name, Tables.$table_schema, findPrimaryKeys.$primary_key)},
          "table_columns_result"."table_columns" as ${col<{ table_columns: string }>("table_columns")}
   FROM ${Tables}
           OUTER APPLY (SELECT coalesce((${TableColumns.render({ format: "sql" })} for json path, include_null_values), '[]')
                                  AS "table_columns") AS "table_columns_result"
           JOIN ${findPrimaryKeys} ON ${Tables.$table_schema} = ${findPrimaryKeys.row.$table_schema} AND
                                      ${Tables.$table_name} = ${findPrimaryKeys.row.$table_name}
   WHERE ${Tables.$table_schema} IN (${param<{ schemas: string[] }>("schemas")})
     AND ${Tables.$table_type} = 'BASE TABLE'
   ORDER BY ${Tables.$table_schema}, ${Tables.$table_name}`;
