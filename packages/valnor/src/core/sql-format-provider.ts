import { SqlColumnFormat } from "./sql-column.js";
import { SqlQueryContext } from "./sql-query-context.js";
import { SqlTableFormat } from "./sql-table.js";

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

export class SqlFormatProvider {
   constructor() {}

   /**
    * Gets the column format for the given column and query context
    * @param context
    */
   getColumnFormat(context: SqlQueryContext): SqlColumnFormat {
      const formattingKeyword = context.keyword;
      if (!formattingKeyword) {
         return DEFAULT_COLUMN_FORMAT;
      }
      return SQL_COLUMN_FORMATS[formattingKeyword] ?? DEFAULT_COLUMN_FORMAT;
   }

   /**
    * Gets the table format for the given table and query context
    * @param context
    */
   getTableFormat(context: SqlQueryContext): SqlTableFormat {
      const formattingKeyword = context.keyword;
      if (!formattingKeyword) {
         return DEFAULT_TABLE_FORMAT;
      }
      return SQL_TABLE_FORMATS[formattingKeyword] ?? DEFAULT_TABLE_FORMAT;
   }
}
