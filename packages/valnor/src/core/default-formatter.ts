import { IBuildQueryContext } from "./sql-types.js";

export type SqlTableFormat = "tableName" | "schema.tableName" | "schema.tableName as tableAlias" | "tableAlias";

const SQL_TABLE_FORMATS: Partial<Record<string, SqlTableFormat>> = {
   with: "tableAlias",
   select: "tableAlias",
   from: "schema.tableName as tableAlias",
   update: "schema.tableName",
   "insert into": "schema.tableName",
   "delete from": "schema.tableName",
   join: "schema.tableName as tableAlias",
   fn: "tableAlias",
};

const DEFAULT_TABLE_FORMAT: SqlTableFormat = "schema.tableName";

export type SqlColumnFormat =
   | "columnName"
   | "columnAlias"
   | "tableName.columnName"
   | "tableName.columnAlias"
   | "tableName.columnName as columnAlias"
   | "tableAlias.columnName"
   | "tableAlias.columnName as columnAlias";

// Default formatting rules, moved here to centralize logic.
const SQL_COLUMN_FORMATS: Partial<Record<string, SqlColumnFormat>> = {
   select: "tableAlias.columnName as columnAlias",
   returning: "tableName.columnName as columnAlias",
   output: "tableAlias.columnName as columnAlias",
   fn: "tableAlias.columnName",
   where: "tableAlias.columnName",
   on: "tableAlias.columnName",
   "insert into": "columnName",
   values: "columnName",
   set: "columnName",
   "group by": "tableAlias.columnName",
   "order by": "tableAlias.columnName",
};

const DEFAULT_COLUMN_FORMAT: SqlColumnFormat = "tableAlias.columnName";

export class DefaultFormatter {
   constructor() {}

   /**
    * Gets the column format for the given column and query context
    * @param context
    */
   getColumnFormat(context: IBuildQueryContext): SqlColumnFormat {
      if (!context.keyword) {
         return DEFAULT_COLUMN_FORMAT;
      }

      return SQL_COLUMN_FORMATS[context.keyword] ?? DEFAULT_COLUMN_FORMAT;
   }

   /**
    * Gets the table format for the given table and query context
    * @param context
    */
   getTableFormat(context: IBuildQueryContext): SqlTableFormat {
      if (!context.keyword) {
         return DEFAULT_TABLE_FORMAT;
      }
      return SQL_TABLE_FORMATS[context.keyword] ?? DEFAULT_TABLE_FORMAT;
   }
}
