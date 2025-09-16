import { SqlColumnInfo, SqlColumnType, SqlEnumInfo, SqlTableInfo } from "./types.js";

/**
 * Valnor plugin for handling query execution to different DB engines
 */
export abstract class ValnorPlugin {
   /**
    * register the current plugin with Valnor
    */
   register(): void {
      //noop
   }

   abstract readonly driver: string;
   abstract getColumnType(col: SqlColumnInfo): SqlColumnType;
   abstract getSchema(args: GetSchemaArgs): Promise<Schema>;
}

export type GetSchemaArgs = { schemas: string[] } & (
   | { uri: string }
   | { host: string; port: number; database: string; user: string; password: string }
);

export type Schema = {
   tables: SqlTableInfo[];
   enums: SqlEnumInfo[];
};
