import { LibraryOutputFile, SqlColumnInfo, SqlColumnType, SqlEnumInfo, SqlTableInfo } from "./valnor-schema-types.js";
import { ValnorConnection } from "./valnor-connection.js";
import { AsyncQueryHandler, SqlDatabase, SqlQuery } from "../core/index.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ValnorPluginAny = ValnorPlugin<any>;

/**
 * Valnor plugin for handling core execution to different DB engines
 */
export abstract class ValnorPlugin<T extends { Connection: unknown; Config: unknown }>
   implements SqlDatabase<T["Connection"]>
{
   abstract readonly driver: string;

   /**
    * Gets the column type
    * @param col
    */
   abstract getColumnType(col: SqlColumnInfo): SqlColumnType;

   /**
    * Gets the schema for the given database
    * @param args
    */
   abstract getSchema(args: GetSchemaArgs<T["Config"]>): Promise<SqlSchema>;

   /**
    * Gets the library for the given database.
    * Such library consists of custom code that gets injected in the target package via code generation.
    */
   abstract getLibrary(): LibraryOutputFile[];

   /**
    * Creates a database connection from connection config
    * @param config
    */
   abstract createConnection(config: T["Config"]): Promise<ValnorConnection<T["Connection"]>>;

   abstract newQueryHandler<T extends { Row?: unknown; Params?: unknown; QueryResult: object; QueryClient: unknown }>(
      query: SqlQuery<{ Params: T["Params"]; Row: T["Row"] }>,
   ): AsyncQueryHandler<T>;
}

export type GetSchemaArgs<T> = { schemas: string[] } & T;

export type SqlSchema = {
   tables: SqlTableInfo[];
   enums: SqlEnumInfo[];
};
