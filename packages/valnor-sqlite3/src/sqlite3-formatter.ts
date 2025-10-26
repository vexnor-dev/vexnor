import { SqlColumnFormat, DefaultFormatter, SqlQueryContext, SqlTableFormat } from "valnor";

export class Sqlite3Formatter extends DefaultFormatter {
   override getColumnFormat(context: SqlQueryContext): SqlColumnFormat {
      switch (context.keyword) {
         case "insert into":
            return "columnName";
         case "set":
            return "tableName.columnName";
         case "returning":
            return "tableName.columnName as columnAlias";
         default:
            return super.getColumnFormat(context);
      }
   }

   override getTableFormat(context: SqlQueryContext): SqlTableFormat {
      switch (context.keyword) {
         case "insert into":
         case "update":
            return "schema.tableName";
         default:
            return super.getTableFormat(context);
      }
   }
}
