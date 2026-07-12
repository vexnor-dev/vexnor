// noinspection SqlNoDataSourceInspection,SqlResolve
import {
   SqlTable,
   upsert,
   row,
   info,
   SqlTableColumnAny,
   SqlInsertRowsParams,
   SqlQueryColumns,
} from "@vexnor/core";
import { sql } from "#src/postgres-sql.js";
import { PostgresQueryHandler } from "#src/postgres-query-handler.js";
import "#src/postgres-augment.js";

export type PostgresUpsertCommandArgs = {
   CONFLICT_ON: SqlTableColumnAny[];
};

export type PostgresUpsertCommandResult<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }> =
   PostgresQueryHandler<{
      Params: SqlInsertRowsParams<T, "rows">;
      Row: T["Select"];
   }> &
      SqlQueryColumns<T["Select"]>;

/**
 * PostgreSQL-specific upsert command using INSERT ... ON CONFLICT DO UPDATE.
 */
export class PostgresUpsertCommand<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
> {
   protected readonly table: SqlTable<T>;
   protected readonly conflictKeys: string[];

   constructor(table: SqlTable<T>, args: PostgresUpsertCommandArgs) {
      this.table = table;
      this.conflictKeys = args.CONFLICT_ON.map((col) => col.key);
   }

   execute(): PostgresUpsertCommandResult<T> {
      const { table, conflictKeys } = this;

      const query = sql`
         ${info({ driver: "postgres" })}
         insert into ${table}
            ${upsert(table, conflictKeys)}
         returning ${row(table.$$)}
      `;
      return query as unknown as PostgresUpsertCommandResult<T>;
   }
}
