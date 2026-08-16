import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import { SqlQuery, SqlQueryHandler } from "@vexnor/core";
import {
   GetSchemaArgs,
   LibraryOutputFile,
   logger,
   SqlColumnInfo,
   SqlColumnType,
   SqlSchema,
   VexnorConnection,
   VexnorPlugin,
} from "@vexnor/core/plugin";
import { DuckDBConnectionConfig, resolveDuckDBConnectionConfig } from "#src/duckdb-connection-config.js";
import { DuckDBQueryHandler, PLUGIN_NAME } from "#src/duckdb-query-handler.js";
import { findSchema } from "#src/schema/find-schema.js";
import { getColumnType } from "#src/schema/get-column-type.js";
import "#src/duckdb-augment.js";

type CachedDuckDBInstance = {
   connections: number;
   instance: DuckDBInstance;
};

const instanceCache = new Map<string, Promise<CachedDuckDBInstance>>();

export class VexnorDuckDB extends VexnorPlugin<{ Config: DuckDBConnectionConfig; Connection: DuckDBConnection }> {
   readonly name = PLUGIN_NAME;
   readonly driver = "duckdb";
   dialect = "duckdb";

   getLibrary(): LibraryOutputFile[] {
      return [];
   }

   getColumnType(column: SqlColumnInfo): SqlColumnType {
      return getColumnType(column);
   }

   async getSchema(args: GetSchemaArgs<DuckDBConnectionConfig>): Promise<SqlSchema> {
      const { schemas, ...config } = args;
      const connection = await this.createConnection({ config });
      try {
         const schema = await findSchema(connection.db, schemas);
         logger.info(
            {
               duckdb: describeConfig(config),
               schemas,
               tables: schema.tables.map(({ table_schema, table_name, table_type }) => ({
                  table_schema,
                  table_name,
                  table_type,
               })),
               enums: schema.enums.map(({ enum_schema, enum_name }) => ({ enum_schema, enum_name })),
            },
            `Generating DuckDB mapping code for ${schemas.join(", ")}`,
         );
         return schema;
      } finally {
         await connection.close();
      }
   }

   async createConnection<TContext extends Record<string, unknown>>({
      config,
   }: {
      config: DuckDBConnectionConfig;
      context?: TContext;
   }): Promise<VexnorConnection<{ Connection: DuckDBConnection; Context: TContext }>> {
      const resolved = resolveDuckDBConnectionConfig(config);
      const acquired = await acquireInstance(resolved);
      let connection: DuckDBConnection;
      try {
         connection = await acquired.instance.connect();
      } catch (error) {
         acquired.release();
         throw error;
      }
      let closed = false;

      return new VexnorConnection(connection, () => {
         if (closed) return;
         closed = true;
         try {
            connection.closeSync();
         } finally {
            acquired.release();
         }
      });
   }

   newQueryHandler<T extends { Row?: unknown; Params?: unknown; Read: object; Write: object }>(
      query: SqlQuery<Pick<T, "Row" | "Params">>,
   ): SqlQueryHandler<Pick<T, "Row" | "Params" | "Read" | "Write"> & { Connection: DuckDBConnection }> {
      return new DuckDBQueryHandler(query) as SqlQueryHandler<
         Pick<T, "Row" | "Params" | "Read" | "Write"> & { Connection: DuckDBConnection }
      >;
   }
}

async function acquireInstance(resolved: ReturnType<typeof resolveDuckDBConnectionConfig>): Promise<{
   instance: DuckDBInstance;
   release: () => void;
}> {
   if (!resolved.cache) {
      const instance = await DuckDBInstance.create(resolved.path);
      return { instance, release: () => instance.closeSync() };
   }

   let pending = instanceCache.get(resolved.path);
   if (!pending) {
      pending = DuckDBInstance.fromCache(resolved.path).then((instance) => ({ connections: 0, instance }));
      instanceCache.set(resolved.path, pending);
   }

   let cached: CachedDuckDBInstance;
   try {
      cached = await pending;
   } catch (error) {
      instanceCache.delete(resolved.path);
      throw error;
   }
   cached.connections++;

   return {
      instance: cached.instance,
      release: () => {
         cached.connections--;
         if (cached.connections === 0) {
            instanceCache.delete(resolved.path);
            cached.instance.closeSync();
         }
      },
   };
}

function describeConfig(config: DuckDBConnectionConfig): Record<string, string> {
   if ("uri" in config) return { mode: config.uri === ":memory:" ? "memory" : config.uri.startsWith("md:") ? "motherduck" : "file" };
   if (config.mode === "file") return { mode: config.mode, path: config.path };
   if (config.mode === "motherduck") return { mode: config.mode, database: config.database, token: "*****" };
   return { mode: config.mode };
}

export const vexnorDuckDB = new VexnorDuckDB();
