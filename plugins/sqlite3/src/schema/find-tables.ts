import { col, param, row, sql, val } from "@vexnor/core";
import { PragmaForeignKeyList, PragmaTableInfo, SqliteMaster } from "#/schema/models.js";

export const findTables = sql`
   SELECT 
      ${row(SqliteMaster.$name.as("table_name"))},
      'main' as ${col<{ table_schema: string }>("table_schema")},
      '[]' as ${col<{ table_columns: string[] }>("table_columns")},
      NULL as ${col<{ primary_key: string }>("primary_key")}
   FROM ${SqliteMaster}
   WHERE ${SqliteMaster.$type} = 'table' 
   AND ${SqliteMaster.$name} NOT LIKE 'sqlite_%'
`;

export const findViews = sql`
   SELECT 
      ${row(SqliteMaster.$name.as("table_name"))},
      'main' as ${col<{ table_schema: string }>("table_schema")}
   FROM ${SqliteMaster}
   WHERE ${SqliteMaster.$type} = 'view'
   AND ${SqliteMaster.$name} NOT LIKE 'sqlite_%'
`;

export const findTableColumns = sql`
   SELECT ${row(PragmaTableInfo.$name.as("column_name"), PragmaTableInfo.$dflt_value.as("column_default"), PragmaTableInfo.$type.as("udt_name"))},
          ${val`CASE WHEN "notnull" = 0 THEN 'YES' ELSE 'NO' END`.as<{ is_nullable: "YES" | "NO" }>("is_nullable")},
          ${val`'YES'`.as<{ is_updatable: "YES" | "NO" }>("is_updatable")}
   FROM pragma_table_info(${param<{ tableName: string }>("tableName")}) as ${PragmaTableInfo.render("tableAlias")}
`;

export const findPrimaryKeys = sql`
   SELECT ${row(PragmaTableInfo.$name.as("column_name"), PragmaTableInfo.$name.as("constraint_name"), PragmaTableInfo.$cid.as("ordinal_position"))}
   FROM pragma_table_info(${param<{ tableName: string }>("tableName")}) as ${PragmaTableInfo.render("tableAlias")}
   WHERE pk = 1
`;

export const findForeignKeys = sql`
   SELECT ${row(
      PragmaForeignKeyList.$id,
      PragmaForeignKeyList.$seq,
      PragmaForeignKeyList.$table.as("referenced_table_name"),
      PragmaForeignKeyList.$from.as("column_name"),
      PragmaForeignKeyList.$to.as("referenced_column_name"),
   )}
   FROM pragma_foreign_key_list(${param<{ tableName: string }>("tableName")}) as ${PragmaForeignKeyList.render("tableAlias")}
`;