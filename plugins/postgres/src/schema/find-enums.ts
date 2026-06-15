import { param, row, sql, val } from "@vexnor/core";
import { PgEnum, PgNamespace, PgType } from "#/schema/models.js";
import { SqlEnumValue } from "@vexnor/core/plugin";

export const findEnums = sql`
   with "enum_values" as (select ${PgEnum.$oid},
                                          ${PgEnum.$enumtypid},
                                          ${PgEnum.$enumlabel.as("enum_label")},
                                          ${PgEnum.$enumsortorder}
                                   from ${PgEnum})
   SELECT ${row(
      PgType.$typname.as("enum_name"),
      PgNamespace.$nspname.as("enum_schema"),
   )}, ${val`json_agg("enum_values")`.as<{ enum_values: SqlEnumValue[] }>("enum_values")}
   FROM ${PgType}
           join "enum_values" on ${PgType.$oid} = ${PgEnum.as`enum_values`.$enumtypid}
           join ${PgNamespace} on ${PgNamespace.$oid} = ${PgType.$typnamespace}
   where ${PgType.$typcategory} = 'E'
     and ${PgNamespace.$nspname} in (${param<{ schemas: string[] }>("schemas")})
   group by ${PgType.$oid}, ${PgType.$typname}, ${PgType.$typelem}, ${PgNamespace.$nspname}`;
