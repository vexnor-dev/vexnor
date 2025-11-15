import { LibraryOutputFile, SqlColumnInfo, SqlColumnType, SqlEnumInfo, SqlTableInfo } from "./valnor-schema-types.js";
import { ValnorConnection } from "./valnor-connection.js";
import { ConnectionConfig } from "./connection-config.js";

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
    * Creates a database connection from connection config
    * @param config
    */
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   abstract createConnection<Config extends ConnectionConfig>(config: Config): Promise<ValnorConnection<any>>;
}

export type GetSchemaArgs = { schemas: string[] } & ConnectionConfig;

export type SqlSchema = {
   tables: SqlTableInfo[];
   enums: SqlEnumInfo[];
};
