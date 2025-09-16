import { SqlTableInfo } from "valnor/plugin";
import { param, sql } from "valnor/core";

import { Columns, TableConstraints } from "./models.js";

/**
 * Query all tables in the given cli(s)
 * @param client
 */
export const findTables = sql<SqlTableInfo, { schemas: string[] }>`
   select ${Columns.table_name},
          ${Columns.table_schema},
          json_agg(${Columns})                as table_columns,
          ${TableConstraints.constraint_name} as primary_key
   from ${Columns}
           left join ${TableConstraints}
                     on ${Columns.table_name} = ${TableConstraints.table_name} and ${TableConstraints.constraint_type} = 'PRIMARY KEY'
   where ${Columns.table_schema} in (${param("schemas")})
   group by ${Columns.table_name}, ${Columns.table_schema},
            ${TableConstraints.constraint_name}`;
