import { SqlColumnFormat, DefaultFormatter, SqlBuildContext, SqlTableFormat } from "vexnor";

export class Sqlite3Formatter extends DefaultFormatter {
   override getColumnFormat(context: SqlBuildContext): SqlColumnFormat {
      switch (context.keyword) {
         case "insert into":
            return "columnName";
         case "set":
            return "tableName.columnName";
         case "returning":
            return "tableName.columnName AS columnAlias";
         default:
            return super.getColumnFormat(context);
      }
   }

   override getTableFormat(context: SqlBuildContext): SqlTableFormat {
      switch (context.keyword) {
         case "insert into":
         case "update":
            return "schema.tableName";
         default:
            return super.getTableFormat(context);
      }
   }
}
