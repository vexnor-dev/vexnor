import {
   LibraryOutputFile,
   SqlColumnInfo,
   SqlColumnType,
   SqlEnumInfo,
   SqlTableInfo,
} from "#src/plugin/vexnor-schema-types.js";
import { VexnorConnection } from "#src/plugin/vexnor-connection.js";
import { SqlQueryHandler } from "#src/core/query/sql-query-handler.js";
import { SqlQuery, type SqlQueryAny } from "#src/core/query/sql-query.js";
import { sqlSelect } from "#src/core/crud/sql-select.js";
import type { SqlTableAny } from "#src/core/schema/sql-table.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type VexnorPluginAny = VexnorPlugin<any>;

export abstract class VexnorPlugin<T extends { Connection: unknown; Config: unknown }> {
   abstract readonly name: string;

   readonly version: string = "unknown";

   abstract dialect: string;

   abstract readonly driver: string;

   abstract getColumnType(col: SqlColumnInfo): SqlColumnType;

   abstract getSchema(args: GetSchemaArgs<T["Config"]>): Promise<SqlSchema>;

   abstract getLibrary(): LibraryOutputFile[];

   abstract createConnection<TContext extends Record<string, unknown> = Record<string, unknown>>(args: {
      config: T["Config"];
   }): Promise<VexnorConnection<{ Connection: T["Connection"]; Context: TContext }>>;

   newSelectQuery(
      table: SqlTableAny,
      joinMap?: Record<string, SqlTableAny>,
   ): SqlQueryAny {
      return sqlSelect(table, {}, null, joinMap);
   }

   abstract newQueryHandler<Args extends { Row?: unknown; Params?: unknown; Read: object; Write: object }>(
      query: SqlQuery<Pick<Args, "Row" | "Params">>,
   ): SqlQueryHandler<Pick<Args, "Row" | "Params" | "Read" | "Write"> & Pick<T, "Connection">>;
}

export type GetSchemaArgs<T> = { schemas: string[] } & T;

export type SqlSchema = {
   tables: SqlTableInfo[];
   enums: SqlEnumInfo[];
};
