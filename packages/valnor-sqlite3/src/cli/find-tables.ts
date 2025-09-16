import { sql } from "valnor/core";
import type { SqlTableInfo } from "valnor/plugin";

export const findTables = sql<SqlTableInfo>`
   SELECT 
      name as table_name,
      'main' as table_schema,
      sql as table_sql
   FROM sqlite_master 
   WHERE type = 'table' 
   AND name NOT LIKE 'sqlite_%'
`;
