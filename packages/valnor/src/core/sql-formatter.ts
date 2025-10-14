import { ISqlQueryContext } from "./sql-types.js";

export type SqlTableFormat = "table" | "schema.table" | "schema.table as alias" | "alias";

export type SqlColumnFormat =
   | "table.column"
   | "table.column as alias"
   | "tableName.column"
   | "column"
   | "tableName.alias"
   | "alias"
   | "tableName.column as alias"
   | "tableAlias.column"
   | "tableAlias.column as alias";

// Default formatting rules, moved here to centralize logic.
const SQL_COLUMN_FORMATS: Partial<Record<string, SqlColumnFormat>> = {
   select: "tableAlias.column as alias",
   returning: "tableAlias.column as alias",
   fn: "tableAlias.column",
   where: "tableAlias.column",
   on: "tableAlias.column",
   "insert into": "column",
   values: "column",
   set: "column",
   "group by": "tableAlias.column",
   "order by": "tableAlias.column",
};

const DEFAULT_COLUMN_FORMAT: SqlColumnFormat = "tableAlias.column";

const SQL_TABLE_FORMATS: Partial<Record<string, SqlTableFormat>> = {
   from: "schema.table as alias",
   update: "schema.table as alias",
   "insert into": "schema.table as alias",
   "delete from": "schema.table as alias",
   join: "schema.table as alias",
   fn: "alias",
};

const DEFAULT_TABLE_FORMAT: SqlTableFormat = "schema.table";

export class SqlFormatter {
   constructor() {}

   /**
    * Gets the column format for the given column and query context
    * @param context
    */
   getColumnFormat(context: ISqlQueryContext): SqlColumnFormat {
      if (!context.keyword) {
         return DEFAULT_COLUMN_FORMAT;
      }

      return SQL_COLUMN_FORMATS[context.keyword] ?? DEFAULT_COLUMN_FORMAT;
   }

   /**
    * Gets the table format for the given table and query context
    * @param context
    */
   getTableFormat(context: ISqlQueryContext): SqlTableFormat {
      if (!context.keyword) {
         return DEFAULT_TABLE_FORMAT;
      }
      return SQL_TABLE_FORMATS[context.keyword] ?? DEFAULT_TABLE_FORMAT;
   }
}
