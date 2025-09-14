import { SqlEnumInfo } from "../types/index.js";
import { param, sql } from "../../lib/index.js";
import { EnumValues, PgEnum, PgNamespace, PgType } from "./models.js";

/**
 * Query all enums in the given schema
 * @param schemas: string[]
 */

export const findEnums = sql<SqlEnumInfo, { schemas: string[] }>`
   with ${EnumValues} as (select ${PgEnum.oid},
                                 ${PgEnum.enumtypid},
                                 ${PgEnum.enumlabel.$$fmt("table.column")} enum_label,
                                 ${PgEnum.enumsortorder}
                          from ${PgEnum})
   SELECT ${PgType.typname.$$fmt("table.column")}      enum_name,
          ${PgNamespace.nspname.$$fmt("table.column")} enum_schema,
          json_agg(${EnumValues}) as                 enum_values
   FROM ${PgType}
           join ${EnumValues} on ${PgType.oid} = ${EnumValues.enumtypid}
           join ${PgNamespace} on ${PgNamespace.oid} = ${PgType.typnamespace}
   where ${PgType.typcategory} = 'E'
     and ${PgNamespace.nspname} in (${param("schemas")})
   group by ${PgType.oid}, ${PgType.typname}, ${PgType.typelem}, ${PgNamespace.nspname}
`;
