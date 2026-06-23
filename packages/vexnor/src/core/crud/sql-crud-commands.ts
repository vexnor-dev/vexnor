import { SqlInsertRowsResult } from "#/core/crud/sql-insert-rows.js";
import { SqlSelectArgs, SqlSelectResult } from "#/core/crud/sql-select.js";
import { SqlUpdateArgs, SqlTableUpdateResult } from "#/core/crud/sql-update.js";
import { SqlDeleteArgs, SqlDeleteResult } from "#/core/crud/sql-delete.js";
import { SqlInsertFromArgs, SqlInsertFromResult } from "#/core/crud/sql-insert-from.js";

export type SqlCrudCommands<
   T extends {
      Select?: Record<string, unknown>;
      Insert?: Record<string, unknown>;
      Update?: Record<string, unknown>;
      Delete?: boolean;
   },
> = {
   driver: string;
   select: T extends { Select: Record<string, unknown> }
      ? <Args extends SqlSelectArgs<T & { Select: Record<string, unknown> }>>(args: Args) => SqlSelectResult<T & { Select: Record<string, unknown> }, Args>
      : null;
   insertFrom: T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }
      ? <Args extends SqlInsertFromArgs<T & { Select: Record<string, unknown>; Insert: Record<string, unknown> }>>(
           args: Args,
        ) => SqlInsertFromResult<T, Args>
      : null;
   insertRows: T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }
      ? () => SqlInsertRowsResult<T, "rows">
      : null;
   update: T extends { Select: Record<string, unknown>; Update: Record<string, unknown> }
      ? <Args extends SqlUpdateArgs>(
           args: Args,
        ) => SqlTableUpdateResult<T & { Select: Record<string, unknown>; Update: Record<string, unknown> }, Args>
      : null;
   delete: T extends { Select: Record<string, unknown>; Delete: true }
      ? <Args extends SqlDeleteArgs>(args: Args) => SqlDeleteResult<T, Args>
      : null;
};
