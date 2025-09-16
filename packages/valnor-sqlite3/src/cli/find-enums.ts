import { sql } from "valnor/core";
import type { SqlEnumInfo } from "valnor/plugin";

// SQLite doesn't have native enums, return empty result
export const findEnums = sql<SqlEnumInfo>`
   SELECT 
      '' as enum_name,
      'main' as enum_schema,
      '[]' as enum_values
   WHERE 0 = 1
`;
