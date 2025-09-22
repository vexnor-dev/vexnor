import { sql, param } from "valnor";
import type { SqlTableInfo, SqlColumnInfo } from "valnor/plugin";
import { SqliteMaster } from "./models.js";

export const findTables = sql<SqlTableInfo>`
   SELECT 
      ${SqliteMaster.name} as table_name,
      'main' as table_schema,
      '[]' as table_columns,
      NULL as primary_key
   FROM ${SqliteMaster}
   WHERE ${SqliteMaster.type} = 'table' 
   AND ${SqliteMaster.name} NOT LIKE 'sqlite_%'
`;

export const findTableColumns = sql<SqlColumnInfo, { tableName: string }>`
   SELECT 
      name as column_name,
      CASE WHEN "notnull" = 0 THEN 'YES' ELSE 'NO' END as is_nullable,
      dflt_value as column_default,
      'YES' as is_updatable,
      type as udt_name
   FROM pragma_table_info(${param("tableName")})
`;

export const findPrimaryKey = sql<{ name: string }, { tableName: string }>`
   SELECT name
   FROM pragma_table_info(${param("tableName")})
   WHERE pk = 1
   LIMIT 1
`;
