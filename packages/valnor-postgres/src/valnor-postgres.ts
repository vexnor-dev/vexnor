import {
   GetSchemaArgs,
   SqlSchema,
   SqlColumnInfo,
   SqlColumnType,
   ValnorPlugin,
   ValnorConnection,
   LibraryOutputFile,
   ConnectionConfig,
   logger,
} from "valnor/plugin";
import { Pool } from "pg";
import { findEnums, findTables, getColumnType } from "./schema/index.js";
import { PostgresQueryHandler } from "./postgres-query-handler.js";
import { AsyncQueryHandler, SqlQuery } from "valnor";

/**
 * Valnor plugin for postgres.
 * It can handle
 */
export class ValnorPostgres extends ValnorPlugin {
   driver = "postgres";

   getLibrary(): LibraryOutputFile[] {
      return [];
   }

   getColumnType(col: SqlColumnInfo): SqlColumnType {
      return getColumnType(col);
   }

   async getSchema(args: GetSchemaArgs): Promise<SqlSchema> {
      const { schemas } = args;
      const connection = await this.createConnection(args);

      try {
         const tables = await findTables.postgres.getAll({
            db: connection.db,
            params: { schemas },
            options: {
               debug: (args) => {
                  console.log(args.text);
               },
            },
         });
         const enums = await findEnums.postgres.getAll({
            db: connection.db,
            params: { schemas },
         });
         logger.info(
            {
               postgres: (() => {
                  const pool = connection.db as Pool;
                  const { host, port, user, database, password } = pool.options;
                  return { host, port, database, user, password: password ? "*****" : null };
               })(),
               schemas,
               tables: tables.map(({ table_name, table_schema }) => ({ table_schema, table_name })),
               enums: enums.map(({ enum_name, enum_schema }) => ({ enum_schema, enum_name })),
            },
            `Generating mapping code for ${schemas.join(", ")}`,
         );

         return {
            tables,
            enums,
         };
      } finally {
         await connection.close();
      }
   }

   async createConnection<Config extends ConnectionConfig>(config: Config): Promise<ValnorConnection<Pool>> {
      const pool = "uri" in config ? new Pool({ connectionString: config.uri }) : new Pool(config);

      return new ValnorConnection(pool, (p) => p.end());
   }

   newQueryHandler<T extends { Row?: unknown; Params?: unknown; QueryResult: object; QueryClient: unknown }>(
      query: SqlQuery<T>,
   ): AsyncQueryHandler<T> {
      return new PostgresQueryHandler(query);
   }
}

export const valnorPostgres = new ValnorPostgres();

// Extend the class type (in scope)
declare module "valnor" {
   interface SqlQuery<T extends { Row?: unknown; Params?: unknown }> {
      readonly postgres: PostgresQueryHandler<T>;
   }
}

Object.defineProperty(SqlQuery.prototype, "postgres", {
   get: function () {
      return valnorPostgres.newQueryHandler(this);
   },
});
