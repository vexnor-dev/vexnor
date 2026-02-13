import { param, row, sql, val } from "valnor";
import { SqlColumnInfo, SqlPrimaryKeyInfo } from "valnor/plugin";
import { Columns, KeyColumnUsage, TableConstraints } from "./models.js";

export const findTableColumns = sql`
   select ${row(Columns.$table_name, Columns.$table_schema)},
          ${val`json_agg(${Columns} order by ${Columns.$ordinal_position})`.as<{ columns: SqlColumnInfo[] }>("columns")}
   from ${Columns}
   where ${Columns.$table_schema} in (${param<{ schemas: string[] }>("schemas")})
   group by ${Columns.$table_name}, ${Columns.$table_schema}`;

export const findPrimaryKeys = sql`
   select ${row(KeyColumnUsage.$table_name, KeyColumnUsage.$table_schema)},
          ${val`json_agg(${KeyColumnUsage} order by ${KeyColumnUsage.$ordinal_position})`.as<{ primary_keys: SqlPrimaryKeyInfo[] }>("primary_keys")}
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
