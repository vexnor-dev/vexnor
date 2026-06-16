import { col, param, row, sql } from "@vexnor/core";
import { SqlColumnInfo, SqlForeignKeyInfo, SqlPrimaryKeyInfo } from "@vexnor/core/plugin";
import { Columns, ConstraintColumnUsage, KeyColumnUsage, ReferentialConstraints, TableConstraints } from "#/schema/models.js";

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

export const findForeignKeys = sql`
   select ${row(KeyColumnUsage.$table_name, KeyColumnUsage.$table_schema)},
          json_agg(json_build_object(
             'constraint_name', ${KeyColumnUsage.$constraint_name},
             'column_name', ${KeyColumnUsage.$column_name},
             'table_schema', ${KeyColumnUsage.$table_schema},
             'table_name', ${KeyColumnUsage.$table_name},
             'referenced_table_schema', ${ConstraintColumnUsage.$table_schema},
             'referenced_table_name', ${ConstraintColumnUsage.$table_name},
             'referenced_column_name', ${ConstraintColumnUsage.$column_name}
          ) order by ${KeyColumnUsage.$ordinal_position}) as ${col<{ foreign_keys: SqlForeignKeyInfo[] }>("foreign_keys")}
   from ${KeyColumnUsage}
           join ${TableConstraints} on ${KeyColumnUsage.$constraint_name} = ${TableConstraints.$constraint_name}
      and ${KeyColumnUsage.$table_schema} = ${TableConstraints.$table_schema}
           join ${ReferentialConstraints} on ${TableConstraints.$constraint_name} = ${ReferentialConstraints.$constraint_name}
      and ${TableConstraints.$table_schema} = ${ReferentialConstraints.$constraint_schema}
           join ${ConstraintColumnUsage} on ${ReferentialConstraints.$unique_constraint_name} = ${ConstraintColumnUsage.$constraint_name}
      and ${ReferentialConstraints.$unique_constraint_schema} = ${ConstraintColumnUsage.$constraint_schema}
   where ${TableConstraints.$constraint_type} = 'FOREIGN KEY'
     and ${TableConstraints.$table_schema} in (${param<{ schemas: string[] }>("schemas")})
   group by ${KeyColumnUsage.$table_name}, ${KeyColumnUsage.$table_schema}`;

/**
 * Query all tables in the given cli(s)
 * @param client
 */
export const findTables = sql`
   with
      ${findTableColumns},
      ${findPrimaryKeys},
      ${findForeignKeys}
   select ${row(findTableColumns.$$, findPrimaryKeys.$primary_keys, findForeignKeys.$foreign_keys)}
   from ${findTableColumns} left join ${findPrimaryKeys}
   on ${findTableColumns.$table_schema} = ${findPrimaryKeys.$table_schema}
      and ${findTableColumns.$table_name} = ${findPrimaryKeys.$table_name}
   left join ${findForeignKeys}
   on ${findTableColumns.$table_schema} = ${findForeignKeys.$table_schema}
      and ${findTableColumns.$table_name} = ${findForeignKeys.$table_name}`;

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
