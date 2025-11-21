import { param, row, sql, val } from "valnor";

import { Columns, KeyColumnUsage, TableConstraints } from "./models.js";

const TableColumns = sql`
   select ${row(Columns.$$)}
   from ${Columns}
   where ${Columns.$table_schema} in (${param("schemas").is<string[]>()})`;

const PrimaryKeys = sql`
   select ${row(KeyColumnUsage.$table_name, KeyColumnUsage.$table_schema)},
          ${val`json_agg(${KeyColumnUsage.$column_name} order by ${KeyColumnUsage.$ordinal_position})`.as(`primary_key`)}
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
   select ${row(TableColumns.$table_name, TableColumns.$table_schema)}, ${PrimaryKeys.$primary_key},
          ${val`json_agg(${TableColumns} order by ${TableColumns.$ordinal_position})`.as(`table_columns`)}
   from ${TableColumns}
   left join ${PrimaryKeys} on ${TableColumns.$table_name} = ${PrimaryKeys.$table_name}
                     and ${TableColumns.$table_schema} = ${PrimaryKeys.$table_schema}
   group by ${Columns`cols`.$table_name}, ${Columns`cols`.$table_schema}, ${PrimaryKeys.$pk_columns}`;
