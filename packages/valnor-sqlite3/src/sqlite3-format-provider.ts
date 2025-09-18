import { SqlColumn, SqlColumnFormat, SqlFormatProvider, SqlQueryContext, SqlTableAny, SqlTableFormat } from "valnor";

export class Sqlite3FormatProvider extends SqlFormatProvider {
   override getColumnFormat(column: SqlColumn, context: SqlQueryContext): SqlColumnFormat {
      switch (context.keyword) {
         case "insert into":
            return "column";
         case "set":
            return "tableName.column";
         case "returning":
            return "tableName.column as alias";
         default:
            return super.getColumnFormat(column, context);
      }
   }

   override getTableFormat(table: SqlTableAny, context: SqlQueryContext): SqlTableFormat {
      switch (context.keyword) {
         case "insert into":
         case "update":
            return "schema.table";
         default:
            return super.getTableFormat(table, context);
      }
   }
}
