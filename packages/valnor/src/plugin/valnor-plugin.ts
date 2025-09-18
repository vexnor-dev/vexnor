import { LibraryOutputFile, SqlColumnInfo, SqlColumnType, SqlEnumInfo, SqlTableInfo } from "./types.js";
import { SqlColumn, SqlColumnFormat, SqlQueryContext, SqlTable, SqlTableAny, SqlTableFormat } from "../core/index.js";

/**
 * Valnor plugin for handling core execution to different DB engines
 */
export abstract class ValnorPlugin {
   abstract readonly driver: string;

   /**
    * register the current plugin with Valnor
    */
   register(): void {
      //noop
   }

   /**
    * Gets the column type
    * @param col
    */
   abstract getColumnType(col: SqlColumnInfo): SqlColumnType;

   /**
    * Gets the schema for the given database
    * @param args
    */
   abstract getSchema(args: GetSchemaArgs): Promise<SqlSchema>;

   /**
    * Gets the library for the given database.
    * Such library consists of custom code that gets injected in the target package via code generation.
    */
   abstract getLibrary(): LibraryOutputFile[];

   /**
    * Gets the column format for the given column and query context
    * @param args
    */
   getColumnFormat(column: SqlColumn, context: SqlQueryContext): SqlColumnFormat {
      return SqlColumn.getFormat(column, context);
   }

   /**
    * Gets the table format for the given table and query context
    * @param args
    */
   getTableFormat(table: SqlTableAny, context: SqlQueryContext): SqlTableFormat {
      return SqlTable.getFormat(table, context);
   }
}

export type GetColumnFormatArgs = {
   keywords: string[];
   column: SqlColumnInfo;
};

export type GetSchemaArgs = { schemas: string[] } & (
   | { uri: string }
   | { host: string; port: number; database: string; user: string; password: string }
);

export type SqlSchema = {
   tables: SqlTableInfo[];
   enums: SqlEnumInfo[];
};
