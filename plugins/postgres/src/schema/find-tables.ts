import { col, param, row, sql } from "@vexnor/core";
import { SqlColumnInfo, SqlPrimaryKeyInfo } from "@vexnor/core/plugin";
import { Columns, KeyColumnUsage, TableConstraints } from "#/schema/models.js";

export const findTableColumns = sql`
   select ${row(Columns.$table_name, Columns.$table_schema)},
          json_agg(${Columns} order by ${Columns.$ordinal_position}) as ${col<{ columns: SqlColumnInfo[] }>("columns")}
   from ${Columns}
   where ${Columns.$table_schema} in (${param<{ schemas: string[] }>("schemas")})
     and ${Columns.$table_name} in (
        select table_name from information_schema.tables
        where table_schema in (${param<{ schemas: string[] }>("schemas")})
          and table_type = 'BASE TABLE'
     )
   group by ${Columns.$table_name}, ${Columns.$table_schema}`;

export const findPrimaryKeys = sql`
   select ${row(KeyColumnUsage.$table_name, KeyColumnUsage.$table_schema)},
          json_agg(${KeyColumnUsage} order by ${KeyColumnUsage.$ordinal_position}) as ${col<{
             primary_keys: SqlPrimaryKeyInfo[];
          }>("primary_keys")}
   from ${KeyColumnUsage}
           join ${TableConstraints} on ${KeyColumnUsage.$constraint_name} = ${TableConstraints.$constraint_name}
      and ${KeyColumnUsage.$table_schema} = ${TableConstraints.$table_schema}
   where ${TableConstraints.$constraint_type} = 'PRIMARY KEY'
     and ${TableConstraints.$table_schema} in (${param<{ schemas: string[] }>("schemas")})
   group by ${KeyColumnUsage.$table_name}, ${KeyColumnUsage.$table_schema}`;

/**
 * Query all tables in the given cli(s)
 * @param client
 */
export const findTables = sql`
   with
      ${findTableColumns},
      ${findPrimaryKeys}
   select ${row(findTableColumns.$$, findPrimaryKeys.$primary_keys)}
   from ${findTableColumns} left join ${findPrimaryKeys}
   on ${findTableColumns.$table_schema} = ${findPrimaryKeys.$table_schema}
      and ${findTableColumns.$table_name} = ${findPrimaryKeys.$table_name}`;

export const findViewColumns = sql`
   select ${row(Columns.$table_name, Columns.$table_schema)},
          json_agg(${Columns} order by ${Columns.$ordinal_position}) as ${col<{ columns: SqlColumnInfo[] }>("columns")}
   from ${Columns}
   where ${Columns.$table_schema} in (${param<{ schemas: string[] }>("schemas")})
     and ${Columns.$table_name} in (
        select table_name from information_schema.views
        where table_schema in (${param<{ schemas: string[] }>("schemas")})
     )
   group by ${Columns.$table_name}, ${Columns.$table_schema}`;

export const findViews = sql`
   select ${row(findViewColumns.$$)}
   from ${findViewColumns}`;
