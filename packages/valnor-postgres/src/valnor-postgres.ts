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
import { findEnums } from "#/schema/find-enums.js";
import { findTables, findViews } from "#/schema/find-tables.js";
import { getColumnType } from "#/schema/get-column-type.js";
import { PostgresQueryHandler } from "#/postgres-query-handler.js";
import { SqlQueryHandler, SqlQuery, newSqlQueryHandler, SqlTable } from "valnor";
import { newPostgresTableHandler, PostgresTableHandler } from "#/crud/postgres-table-handler.js";

/**
 * Valnor plugin for postgres.
 * It can handle
 */
export class ValnorPostgres extends ValnorPlugin<{ Config: ConnectionConfig; Connection: Pool }> {
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
      const connection = await this.createConnection(args);

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
               tables: allTables.map(({ table_name, table_schema, table_type }) => ({ table_schema, table_name, table_type })),
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

   async createConnection(config: ConnectionConfig): Promise<ValnorConnection<Pool>> {
      const pool = "uri" in config ? new Pool({ connectionString: config.uri }) : new Pool(config);

      return new ValnorConnection(pool, (p) => p.end());
   }

   newQueryHandler<T extends { Row?: unknown; Params?: unknown; QueryResult: object; Connection: unknown }>(
      query: SqlQuery<{ Row: T["Row"]; Params: T["Params"] }>,
   ): SqlQueryHandler<T> {
      return new PostgresQueryHandler(query);
   }
}

export const valnorPostgres = new ValnorPostgres();

// Extend the class type (in scope)
declare module "valnor" {
   interface SqlQuery<T extends { Row?: unknown; Params?: unknown }> {
      readonly postgres: PostgresQueryHandler<T>;
   }
   interface SqlTable<
      T extends {
         Select: Record<string, unknown>;
         Insert?: Record<string, unknown>;
         Update?: Record<string, unknown>;
         Delete?: boolean;
      },
   > {
      readonly postgres: PostgresTableHandler<T>;
   }
}

Object.defineProperty(SqlQuery.prototype, "postgres", {
   get: function () {
      const handler = new PostgresQueryHandler(this);
      return newSqlQueryHandler(handler);
   },
});

Object.defineProperty(SqlTable.prototype, "postgres", {
   get: function () {
      return newPostgresTableHandler(this);
   },
});
