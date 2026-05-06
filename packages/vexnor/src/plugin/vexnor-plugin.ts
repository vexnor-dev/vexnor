import {
   LibraryOutputFile,
   SqlColumnInfo,
   SqlColumnType,
   SqlEnumInfo,
   SqlTableInfo,
} from "#/plugin/vexnor-schema-types.js";
import { VexnorConnection } from "#/plugin/vexnor-connection.js";
import { SqlQueryHandler } from "#/core/query/sql-query-handler.js";
import { SqlQuery } from "#/core/query/sql-query.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type VexnorPluginAny = VexnorPlugin<any>;

export abstract class VexnorPlugin<T extends { Connection: unknown; Config: unknown }> {
   abstract dialect: string;

   abstract readonly driver: string;

   abstract getColumnType(col: SqlColumnInfo): SqlColumnType;

   abstract getSchema(args: GetSchemaArgs<T["Config"]>): Promise<SqlSchema>;

   abstract getLibrary(): LibraryOutputFile[];

   abstract createConnection(config: T["Config"]): Promise<VexnorConnection<T["Connection"]>>;

   abstract newQueryHandler<T extends { Row?: unknown; Params?: unknown; QueryResult: object; Connection: unknown }>(
      query: SqlQuery<{ Params: T["Params"]; Row: T["Row"] }>,
   ): SqlQueryHandler<T>;
}

export type GetSchemaArgs<T> = { schemas: string[] } & T;

export type SqlSchema = {
   tables: SqlTableInfo[];
   enums: SqlEnumInfo[];
};
