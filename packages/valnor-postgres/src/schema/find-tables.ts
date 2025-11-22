import { param, row, sql, val } from "valnor";
import { SqlColumnInfo } from "valnor/plugin";
import { Columns, KeyColumnUsage, TableConstraints } from "./models.js";

const TableColumns = sql`
   select ${row(Columns.$$)}
   from ${Columns}
   where ${Columns.$table_schema} in (${param("schemas").is<string[]>()})`;

const PrimaryKeys = sql`
   select ${row(KeyColumnUsage.$table_name, KeyColumnUsage.$table_schema)},
          ${val<string[]>`json_agg(${KeyColumnUsage.$column_name} order by ${KeyColumnUsage.$ordinal_position})`.as(`primary_keys`)}
   from ${KeyColumnUsage}
           join ${TableConstraints} on ${KeyColumnUsage.$constraint_name} = ${TableConstraints.$constraint_name}
      and ${KeyColumnUsage.$table_schema} = ${TableConstraints.$table_schema}
   where ${TableConstraints.$constraint_type} = 'PRIMARY KEY'
   group by ${KeyColumnUsage.$table_name}, ${KeyColumnUsage.$table_schema}
`;

/**
 * Query all tables in the given cli(s)
 * @param client
 */
export const findTables = sql`
   with ${TableColumns},
        ${PrimaryKeys}
   select ${row(TableColumns.$table_name, TableColumns.$table_schema)},
          ${val<string[]>`coalesce(${PrimaryKeys.$primary_keys}, '[]'::json)`.as(`primary_keys`)},
          ${val<SqlColumnInfo[]>`json_agg(${TableColumns} order by ${TableColumns.$ordinal_position})`.as(`table_columns`)}
   from ${TableColumns}
   left join ${PrimaryKeys} on ${TableColumns.$table_name} = ${PrimaryKeys.$table_name}
                     and ${TableColumns.$table_schema} = ${PrimaryKeys.$table_schema}
   group by ${Columns.as`cols`.$table_name}, ${Columns.as`cols`.$table_schema}, ${PrimaryKeys.$primary_keys}`;
