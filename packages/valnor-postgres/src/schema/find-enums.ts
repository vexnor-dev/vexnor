import { SqlEnumInfo } from "valnor/plugin";
import { param, sql } from "valnor";
import { EnumValues, PgEnum, PgNamespace, PgType } from "./models.js";

/**
 * Query all enums in the given cli
 * @param schemas: string[]
 */

export const findEnums = sql<SqlEnumInfo, { schemas: string[] }>`
   with ${EnumValues} as (select ${PgEnum.oid},
                                 ${PgEnum.enumtypid},
                                 ${PgEnum.enumlabel`enum_label`},
                                 ${PgEnum.enumsortorder}
                          from ${PgEnum})
   SELECT ${PgType.typname`enum_name`},
          ${PgNamespace.nspname`enum_schema`},
          json_agg(${EnumValues}) as enum_values
   FROM ${PgType}
           join ${EnumValues} on ${PgType.oid} = ${EnumValues.enumtypid}
           join ${PgNamespace} on ${PgNamespace.oid} = ${PgType.typnamespace}
   where ${PgType.typcategory} = 'E'
     and ${PgNamespace.nspname} in (${param("schemas")})
   group by ${PgType.oid}, ${PgType.typname}, ${PgType.typelem}, ${PgNamespace.nspname}
`;
