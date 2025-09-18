import { SqlColumn, SqlColumnFormat } from "./sql-column.js";
import { SqlQueryContext } from "./sql-query-context.js";
import { SqlTable, SqlTableAny, SqlTableFormat } from "./sql-table.js";

export class SqlFormatProvider {
   constructor() {}

   /**
    * Gets the column format for the given column and query context
    * @param column
    * @param context
    */
   getColumnFormat(column: SqlColumn, context: SqlQueryContext): SqlColumnFormat {
      return SqlColumn.getFormat(column, context);
   }

   /**
    * Gets the table format for the given table and query context
    * @param table
    * @param context
    */
   getTableFormat(table: SqlTableAny, context: SqlQueryContext): SqlTableFormat {
      return SqlTable.getFormat(table, context);
   }
}
