import {
   SqlTable,
   SqlDeleteCommand,
   SqlDeleteArgs,
   ParamsOfArgs,
   info,
   SqlQueryColumns,
   sql,
   raw,
   row,
   ok,
} from "@vexnor/core";
import { PostgresQueryHandler } from "#src/postgres-query-handler.js";
import "#src/postgres-augment.js";

export type PostgresDeleteCommandResult<
   T extends { Select: Record<string, unknown>; Delete: true },
   Args extends SqlDeleteArgs,
> = PostgresQueryHandler<{
   Params: ParamsOfArgs<Args>;
   Row: T["Select"];
}> &
   SqlQueryColumns<T["Select"]>;

/**
 * PostgreSQL-specific delete command.
 *
 * Uses `RETURNING *` (standard SQL) with postgres-specific inline formatting.
 */
export class PostgresDeleteCommand<
   T extends { Select: Record<string, unknown>; Delete: true },
   Args extends SqlDeleteArgs,
> extends SqlDeleteCommand<T, Args> {
   constructor(table: SqlTable<T>, args: Args) {
      super(table, args, info({ driver: "postgres" }));
   }

   execute(): PostgresDeleteCommandResult<T, Args> {
      const { table, args } = this;
      const where = "WHERE" in args ? args.WHERE : undefined;
      if (!where) {
         ok("force" in args && args.force, "WHERE condition or force required");
      }

      const query = sql`
         ${info({ driver: "postgres" })}
         delete from ${table}
         ${where ? sql`where ${where.inline()}`.inline("default") : raw.BLANK}
         returning ${row(table.$$)}
      `;
      return query.postgres as unknown as PostgresDeleteCommandResult<T, Args>;
   }
}
