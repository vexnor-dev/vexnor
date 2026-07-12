// noinspection SqlNoDataSourceInspection,SqlResolve
import {
   SqlTable,
   SqlInsertRowsCommand,
   SqlInsertRowsParams,
   info,
   SqlQueryColumns,
   insert,
   row,
} from "@vexnor/core";
import { sql } from "#src/mssql-sql.js";
import { MssqlQueryHandler } from "#src/mssql-query-handler.js";
import "#src/mssql-augment.js";

export type MssqlInsertRowsCommandResult<T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }> =
   MssqlQueryHandler<{
      Params: SqlInsertRowsParams<T, "rows">;
      Row: T["Select"];
   }> &
      SqlQueryColumns<T["Select"]>;

/**
 * MSSQL-specific insert rows command.
 *
 * Uses explicit `(cols) OUTPUT inserted.* VALUES (...)` instead of the
 * core insert() operator with RETURNING.
 */
export class MssqlInsertRowsCommand<
   T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> },
> extends SqlInsertRowsCommand<T> {
   constructor(table: SqlTable<T>) {
      super(table, info({ driver: "transactsql" }));
   }

   execute(): MssqlInsertRowsCommandResult<T> {
      const { table } = this;

      const query = sql`
         ${info({ driver: "transactsql" })}
         insert into ${table}
         (${insert.cols(table, "rows")})
         output ${row(table.as`inserted`.$$)}
         values
         ${insert.values(table, "rows")}
      `;
      return query.mssql as unknown as MssqlInsertRowsCommandResult<T>;
   }
}
