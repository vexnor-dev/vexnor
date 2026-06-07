import {
   LibraryOutputFile,
   logger,
   SqlColumnInfo,
   SqlColumnType,
   SqlSchema,
   SqlTableInfo,
   VexnorConnection,
   VexnorPlugin,
} from "vexnor/plugin";
import BetterSqlite3 from "better-sqlite3";
import { findPrimaryKeys, findTableColumns, findTables, findViews } from "#/schema/find-tables.js";
import { getColumnType } from "#/schema/get-column-type.js";
import { SqlQuery, SqlQueryHandler } from "vexnor";
import { BetterSqlite3QueryHandler } from "#/better-sqlite3-query-handler.js";
import pkg from "../package.json" with { type: "json" };
import "#/sqlite3-augment.js";

export const PLUGIN_NAME = pkg.name;

export type Sqlite3ConnectionConfig = { uri: string };

export class VexnorSqlite3 extends VexnorPlugin<{
   Config: Sqlite3ConnectionConfig;
   Connection: BetterSqlite3.Database;
}> {
   readonly name = PLUGIN_NAME;
   driver = "better-sqlite3";
   dialect = "sqlite";

   newQueryHandler<Args extends { Row?: unknown; Params?: unknown; Read: object; Write: object }>(
      query: SqlQuery<Pick<Args, "Row" | "Params">>,
   ): SqlQueryHandler<Pick<Args, "Row" | "Params" | "Read" | "Write"> & { Connection: BetterSqlite3.Database }> {
      return new BetterSqlite3QueryHandler(query) as SqlQueryHandler<
         Pick<Args, "Row" | "Params" | "Read" | "Write"> & { Connection: BetterSqlite3.Database }
      >;
   }

   getLibrary(): LibraryOutputFile[] {
      return [];
   }

   getColumnType(col: SqlColumnInfo): SqlColumnType {
      return getColumnType(col);
   }

   async getSchema(args: Sqlite3ConnectionConfig & { schemas: string[] }): Promise<SqlSchema> {
      const { schemas } = args;

      let db: BetterSqlite3.Database;
      if ("uri" in args) {
         logger.info({ URI: args.uri }, "Opening Sqlite3 database connection");
         db = new BetterSqlite3(args.uri);
      } else {
         throw new Error("SQLite requires database file path in uri parameter");
      }

      const runArgs: Parameters<typeof findTables.sqlite.all>[0] = {
         db,
         options: { dialect: "sqlite" },
      };

      const tables = await findTables.sqlite.all({ ...runArgs });
      const views = await findViews.sqlite.all({ ...runArgs });

      // Populate columns and primary keys for each table
      const newTables: SqlTableInfo[] = [];
      for (const table of tables) {
         const columns = await findTableColumns.sqlite.all({ ...runArgs, params: { tableName: table.table_name } });
         const primaryKeys = await findPrimaryKeys.sqlite.all({
            ...runArgs,
            params: { tableName: table.table_name },
         });

         newTables.push({
            table_type: "table",
            primary_keys: primaryKeys.map((z) => ({
               ...z,
               table_schema: table.table_schema,
               table_name: table.table_name,
            })),
            ...table,
            columns: columns.map((z) => ({ ...z, table_name: table.table_name, table_schema: table.table_schema })),
         });
      }

      for (const view of views) {
         const columns = await findTableColumns.sqlite.all({ ...runArgs, params: { tableName: view.table_name } });
         newTables.push({
            table_type: "view",
            table_name: view.table_name,
            table_schema: view.table_schema,
            primary_keys: [],
            columns: columns.map((z) => ({ ...z, table_name: view.table_name, table_schema: view.table_schema })),
         });
      }

      logger.info(
         {
            sqlite: { database: "uri" in args ? args.uri : "unknown" },
            schemas,
            tables: tables.map(({ table_name, table_schema }) => ({ table_schema, table_name })),
            enums: [],
         },
         `Generating mapping code for SQLite database`,
      );

      db.close();

      return {
         tables: newTables,
         enums: [],
      };
   }

   async createConnection<TContext extends Record<string, unknown>>({
      config,
   }: {
      config: Sqlite3ConnectionConfig;
      context?: TContext;
   }): Promise<VexnorConnection<{ Connection: BetterSqlite3.Database; Context: TContext }>> {
      const db = new BetterSqlite3(config.uri);
      return new VexnorConnection(db, (db) => {
         Promise.resolve(() => {
            db.close();
         });
      });
   }
}
