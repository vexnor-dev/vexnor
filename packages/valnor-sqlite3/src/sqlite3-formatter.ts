import { SqlColumnFormat, SqlFormatter, SqlQueryContext, SqlTableFormat } from "valnor";

export class Sqlite3Formatter extends SqlFormatter {
   override getColumnFormat(context: SqlQueryContext): SqlColumnFormat {
      switch (context.keyword) {
         case "insert into":
            return "column";
         case "set":
            return "tableName.column";
         case "returning":
            return "tableName.column as alias";
         default:
            return super.getColumnFormat(context);
      }
   }

   override getTableFormat(context: SqlQueryContext): SqlTableFormat {
      switch (context.keyword) {
         case "insert into":
         case "update":
            return "schema.table";
         default:
            return super.getTableFormat(context);
      }
   }
}
