import { SqlColumnInfo, SqlTableInfo } from "valnor/plugin";
import { param, sql } from "valnor";
import { Columns, KeyColumnUsage, TableConstraints, Tables } from "./models.js";
import { jsonAgg } from "../json-agg-mssql.js";

const TableColumns = sql<SqlColumnInfo>`
   SELECT ${Columns.column_name},
          ${Columns.column_default},
          ${Columns.is_nullable},
          ${Columns.udt_name},
          ${Columns.domain_name},
          ${Columns.numeric_precision_radix},
          CASE
             WHEN COLUMNPROPERTY(OBJECT_ID(${Columns.table_schema} + '.' + ${Columns.table_name}), ${Columns.column_name}, 'IsComputed') = 1
                THEN 'NO'
             ELSE 'YES' END as ${Columns.is_updatable}
   FROM ${Columns}
   WHERE ${Columns.table_schema} = ${Tables.table_schema}
     AND ${Columns.table_name} = ${Tables.table_name}
   ORDER BY ${Columns.ordinal_position}
`;

export const TablePrimaryKey = sql<
   {
      table_schema: string;
      table_name: string;
      primary_key: string;
   },
   { schemas: string[] }
>`
   SELECT DISTINCT ${TableConstraints.table_schema},
                   ${TableConstraints.table_name},
                   ${KeyColumnUsage.column_name} as "primary_key"
   FROM ${TableConstraints}
           JOIN ${KeyColumnUsage} ON ${TableConstraints.constraint_name} = ${KeyColumnUsage.constraint_name}
      AND ${TableConstraints.table_schema} = ${KeyColumnUsage.table_schema}
      AND ${TableConstraints.table_name} = ${KeyColumnUsage.table_name}
   WHERE ${TableConstraints.table_schema} IN (${param("schemas")})
     AND ${TableConstraints.constraint_type} = 'PRIMARY KEY'`;

/**
 * Query all tables in the given schemas
 */
export const findTables = sql<SqlTableInfo, { schemas: string[] }>`
   SELECT ${Tables.table_name},
          ${Tables.table_schema},
          ${TablePrimaryKey.ROW.primary_key},
          ${jsonAgg(TableColumns).select} as "table_columns"
   FROM ${Tables}
           JOIN ${TablePrimaryKey} ON ${Tables.table_schema} = ${TablePrimaryKey.ROW.table_schema} AND
                                      ${Tables.table_name} = ${TablePrimaryKey.ROW.table_name}
                                         ${jsonAgg(TableColumns).body}
   WHERE ${Tables.table_schema} IN (${param("schemas")})
     AND ${Tables.table_type} = 'BASE TABLE'
   ORDER BY ${Tables.table_schema}, ${Tables.table_name}`;
