import {
   LibraryOutputFile,
   SqlColumnInfo,
   SqlColumnType,
   SqlEnumInfo,
   SqlTableInfo,
} from "#src/plugin/vexnor-schema-types.js";
import { VexnorConnection } from "#src/plugin/vexnor-connection.js";
import { SqlQueryHandler } from "#src/core/query/sql-query-handler.js";
import { SqlQuery } from "#src/core/query/sql-query.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type VexnorPluginAny = VexnorPlugin<any>;

export abstract class VexnorPlugin<T extends { Connection: unknown; Config: unknown }> {
   abstract readonly name: string;

   abstract dialect: string;

   abstract readonly driver: string;

   abstract getColumnType(col: SqlColumnInfo): SqlColumnType;

   abstract getSchema(args: GetSchemaArgs<T["Config"]>): Promise<SqlSchema>;

   abstract getLibrary(): LibraryOutputFile[];

   abstract createConnection<TContext extends Record<string, unknown> = Record<string, unknown>>(args: {
      config: T["Config"];
   }): Promise<VexnorConnection<{ Connection: T["Connection"]; Context: TContext }>>;

   abstract newQueryHandler<Args extends { Row?: unknown; Params?: unknown; Read: object; Write: object }>(
      query: SqlQuery<Pick<Args, "Row" | "Params">>,
   ): SqlQueryHandler<Pick<Args, "Row" | "Params" | "Read" | "Write"> & Pick<T, "Connection">>;
}

export type GetSchemaArgs<T> = { schemas: string[] } & T;

export type SqlSchema = {
   tables: SqlTableInfo[];
   enums: SqlEnumInfo[];
};
