import { SqlTableInfo } from "valnor/plugin";
import { param, sql } from "valnor";

import { Columns, TableConstraints } from "./models.js";

/**
 * Query all tables in the given cli(s)
 * @param client
 */
export const findTables = sql<SqlTableInfo, { schemas: string[] }>`
   with cols as (select ${Columns.$$all}
                 from ${Columns}
                 where ${Columns.table_schema} in (${param("schemas")}))
   select ${Columns`cols`.table_name},
          ${Columns`cols`.table_schema},
          json_agg(${Columns`cols`} order by ${Columns`cols`.ordinal_position}) as table_columns,
          ${TableConstraints.constraint_name}                                   as primary_key
   from cols
           left join ${TableConstraints}
                     on ${Columns`cols`.table_name} = ${TableConstraints.table_name} and ${TableConstraints.constraint_type} = 'PRIMARY KEY'
   group by ${Columns`cols`.table_name}, ${Columns`cols`.table_schema},
            ${TableConstraints.constraint_name}`;
