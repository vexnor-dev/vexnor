import { SqlEnumValue } from "valnor/plugin";
import { param, row, sql, val } from "valnor";
import { PgEnum, PgNamespace, PgType } from "./models.js";

export const findEnums = sql`
   with ${PgEnum`enum_values`} as (select ${PgEnum.$oid},
                                 ${PgEnum.$enumtypid},
                                 ${PgEnum.$enumlabel("enum_label")},
                                 ${PgEnum.$enumsortorder}
                          from ${PgEnum})
   SELECT ${row(
      PgType.$typname("enum_name"),
      PgNamespace.$nspname("enum_schema"),
      val<SqlEnumValue[]>`json_agg(${PgEnum`enum_values`})`.as("enum_values"),
   )}
   FROM ${PgType}
           join ${PgEnum`enum_values`} on ${PgType.$oid} = ${PgEnum`enum_values`.$enumtypid}
           join ${PgNamespace} on ${PgNamespace.$oid} = ${PgType.$typnamespace}
   where ${PgType.$typcategory} = 'E'
     and ${PgNamespace.$nspname} in (${param("schemas").is<string[]>()})
   group by ${PgType.$oid}, ${PgType.$typname}, ${PgType.$typelem}, ${PgNamespace.$nspname}`;
