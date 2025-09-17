import {
   GetSchemaArgs,
   logger,
   SqlSchema,
   SqlColumnInfo,
   SqlColumnType,
   ValnorPlugin,
   x,
   LibraryOutputFile,
} from "valnor/plugin";
import { Pool, type QueryResult } from "pg";
import { findEnums, findTables, getColumnType } from "./cli/index.js";
import { PgQueryHandler } from "./core/index.js";
import { RowOut, SqlQuery } from "valnor/core";

/**
 * Valnor plugin for postgres.
 * It can handle
 */
export class ValnorPostgres extends ValnorPlugin {
   getLibrary(): LibraryOutputFile[] {
      return [];
   }

   getColumnType(col: SqlColumnInfo): SqlColumnType {
      return getColumnType(col);
   }

   driver = "pg";

   async getSchema(args: GetSchemaArgs): Promise<SqlSchema> {
      const { schemas } = args;
      const pool = x(() => {
         if ("uri" in args) {
            return new Pool({
               connectionString: args.uri,
            });
         }

         const { host, port, database, user, password } = args;
         if (host && database && user) {
            return new Pool({
               host,
               port,
               user,
               password,
               database,
            });
         }

         throw new Error(`Invalid database connection parameters: host, database and user are required`);
      });
      const tables = await findTables.pg.getAll(pool, { schemas });
      const enums = await findEnums.pg.getAll(pool, { schemas });
      logger.info(
         {
            postgres: x(() => {
               const { host, port, user, database, password } = pool.options;
               return { host, port, database, user, password: password ? "*****" : null };
            }),
            schemas,
            tables: tables.map(({ table_name, table_schema }) => ({ table_schema, table_name })),
            enums: enums.map(({ enum_name, enum_schema }) => ({ enum_schema, enum_name })),
         },
         `Generating mapping code for ${schemas.join(", ")}`,
      );
      await pool.end();

      return {
         tables,
         enums,
      };
   }
}

// Extend the class type (in scope)
declare module "valnor/core" {
   interface SqlQuery<T extends { Row: RowOut; Params: Record<string, unknown> | undefined }> {
      readonly pg: PgQueryHandler<T & { QueryResult: QueryResult }>;
   }
}

Object.defineProperty(SqlQuery.prototype, "pg", {
   get: function () {
      return new PgQueryHandler(this);
   },
});
