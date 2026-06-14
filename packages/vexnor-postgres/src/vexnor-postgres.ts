import {
   ConnectionConfig,
   GetSchemaArgs,
   LibraryOutputFile,
   logger,
   SqlColumnInfo,
   SqlColumnType,
   SqlSchema,
   VexnorConnection,
   VexnorPlugin,
} from "vexnor/plugin";
import { Pool } from "pg";
import { findEnums } from "#/schema/find-enums.js";
import { findTables, findViews } from "#/schema/find-tables.js";
import { getColumnType } from "#/schema/get-column-type.js";
import { PLUGIN_NAME, PostgresQueryHandler } from "#/postgres-query-handler.js";
import { SqlQuery, SqlQueryHandler } from "vexnor";
import "#/postgres-augment.js";

/**
 * Vexnor plugin for postgres.
 * It can handle
 */
export class VexnorPostgres extends VexnorPlugin<{ Config: ConnectionConfig; Connection: Pool }> {
   readonly name = PLUGIN_NAME;
   driver = "postgres";
   dialect = "postgresql";

   getLibrary(): LibraryOutputFile[] {
      return [];
   }

   getColumnType(col: SqlColumnInfo): SqlColumnType {
      return getColumnType(col);
   }

   async getSchema(args: GetSchemaArgs<ConnectionConfig>): Promise<SqlSchema> {
      const { schemas } = args;
      const connection = await this.createConnection({ config: args });

      try {
         const tables = await findTables.postgres.all({
            db: connection.db,
            params: { schemas },
            options: {
               debug: (args) => {
                  console.log(args.text);
               },
            },
         });
         const views = await findViews.postgres.all({
            db: connection.db,
            params: { schemas },
         });
         const enums = await findEnums.postgres.all({
            db: connection.db,
            params: { schemas },
         });
         const allTables = [
            ...tables.map((t) => ({ ...t, table_type: "table" as const, primary_keys: t.primary_keys ?? [] })),
            ...views.map((v) => ({ ...v, table_type: "view" as const, primary_keys: [] })),
         ];
         logger.info(
            {
               postgres: (() => {
                  const pool = connection.db as Pool;
                  const { host, port, user, database, password } = pool.options;
                  return { host, port, database, user, password: password ? "*****" : null };
               })(),
               schemas,
               tables: allTables.map(({ table_name, table_schema, table_type }) => ({
                  table_schema,
                  table_name,
                  table_type,
               })),
               enums: enums.map(({ enum_name, enum_schema }) => ({ enum_schema, enum_name })),
            },
            `Generating mapping code for ${schemas.join(", ")}`,
         );

         return {
            tables: allTables,
            enums,
         };
      } finally {
         await connection.close();
      }
   }

   async createConnection<TContext extends Record<string, unknown>>({
      config,
   }: {
      config: ConnectionConfig;
      context?: TContext;
   }): Promise<VexnorConnection<{ Connection: Pool; Context: TContext }>> {
      const pool = "uri" in config ? new Pool({ connectionString: config.uri }) : new Pool(config);

      return new VexnorConnection(pool, (p) => p.end());
   }

   newQueryHandler<T extends { Row?: unknown; Params?: unknown; Read: object; Write: object }>(
      query: SqlQuery<Pick<T, "Row" | "Params">>,
   ): SqlQueryHandler<Pick<T, "Row" | "Params" | "Read" | "Write"> & { Connection: Pool }> {
      return new PostgresQueryHandler(query) as SqlQueryHandler<
         Pick<T, "Row" | "Params" | "Read" | "Write"> & { Connection: Pool }
      >;
   }
}

export const vexnorPostgres = new VexnorPostgres();
