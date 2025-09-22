import { SqlColumnInfo, SqlTableInfo } from "valnor/plugin";
import { param, sql } from "valnor";
import { Columns, TableConstraints, Tables } from "./models.js";
import { jsonAgg } from "../json-agg-mssql.js";

const tableColumnsQuery = sql<SqlColumnInfo>`
    SELECT
        ${Columns.column_name},
        ${Columns.data_type},
        ${Columns.is_nullable},
        ${Columns.column_default},
        ${Columns.character_maximum_length},
        ${Columns.numeric_precision},
        ${Columns.numeric_scale}
    FROM ${Columns}
    WHERE ${Columns.table_schema} = ${Tables.table_schema}
      AND ${Columns.table_name} = ${Tables.table_name}
`;

/**
 * Query all tables in the given schemas
 */
export const findTables = sql<SqlTableInfo, { schemas: string[] }>`
   SELECT
      ${Tables.table_name},
      ${Tables.table_schema},
      ${jsonAgg(tableColumnsQuery)} as table_columns,
      ${TableConstraints.constraint_name} as primary_key
   FROM ${Tables}
   ${jsonAgg(tableColumnsQuery)}
   LEFT JOIN ${TableConstraints}
      ON ${Tables.table_schema} = ${TableConstraints.table_schema}
     AND ${Tables.table_name} = ${TableConstraints.table_name}
     AND ${TableConstraints.constraint_type} = 'PRIMARY KEY'
   WHERE ${Tables.table_schema} IN (${param("schemas")})
     AND ${Tables.table_type} = 'BASE TABLE'`;
