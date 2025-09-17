import { LibraryOutputFile, SqlColumnInfo, SqlColumnType, SqlEnumInfo, SqlTableInfo } from "./types.js";

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

   abstract getColumnType(col: SqlColumnInfo): SqlColumnType;

   abstract getSchema(args: GetSchemaArgs): Promise<SqlSchema>;

   abstract getLibrary(): LibraryOutputFile[];
}

export type GetSchemaArgs = { schemas: string[] } & (
   | { uri: string }
   | { host: string; port: number; database: string; user: string; password: string }
);

export type SqlSchema = {
   tables: SqlTableInfo[];
   enums: SqlEnumInfo[];
};
