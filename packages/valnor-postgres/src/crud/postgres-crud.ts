import { SqlDeleteArgs, SqlInsertFromArgs, SqlInsertRowsResult, SqlSelectArgs, SqlTable, SqlUpdateArgs } from "valnor";
import { postgresSelect, PostgresSelectResult } from "./postgres-select.js";
import { postgresInsertRows } from "./postgres-insert-rows.js";
import { PostgresTableUpdateResult, postgresUpdate } from "./postgres-update.js";
import { PostgresDeleteResult, postgresDelete } from "./postgres-delete.js";
import { postgresInsertFrom, PostgresInsertFromResult } from "#/crud/postgres-insert-from.js";

export const postgresCrud = <
   T extends {
      Select: Record<string, unknown>;
      Insert?: Record<string, unknown>;
      Update?: Record<string, unknown>;
      Delete?: boolean;
   },
>(
   table: SqlTable<T>,
): PostgresCrudCommands<T> => {
   const { select, insert, update, delete: delete$ } = table.crud;
   return {
      select: (select
         ? (args) => postgresSelect(<SqlTable<{ Select: T["Select"] }>>table, args)
         : null) as PostgresCrudCommands<T>["select"],
      insertFrom: (insert
         ? (args) => postgresInsertFrom(<SqlTable<{ Select: T["Select"]; Insert: NonNullable<T["Insert"]> }>>table, args)
         : null) as PostgresCrudCommands<T>["insertFrom"],
      insertRows: (insert
         ? () => postgresInsertRows(<SqlTable<{ Select: T["Select"]; Insert: NonNullable<T["Insert"]> }>>table)
         : null) as PostgresCrudCommands<T>["insertRows"],
      update: (update
         ? (args) => postgresUpdate(<SqlTable<{ Select: T["Select"]; Update: NonNullable<T["Update"]> }>>table, args)
         : null) as PostgresCrudCommands<T>["update"],
      delete: (delete$
         ? (args) => postgresDelete(<SqlTable<{ Select: T["Select"]; Delete: true }>>table, args)
         : null) as PostgresCrudCommands<T>["delete"],
   };
};

export type PostgresCrudCommands<
   T extends {
      Select?: Record<string, unknown>;
      Insert?: Record<string, unknown>;
      Update?: Record<string, unknown>;
      Delete?: boolean;
   },
> = {
   select: T extends { Select: Record<string, unknown> }
      ? <Args extends SqlSelectArgs>(args: Args) => PostgresSelectResult<T & { Select: Record<string, unknown> }, Args>
      : null;
   insertFrom: T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }
      ? <Args extends SqlInsertFromArgs<T & { Select: Record<string, unknown>; Insert: Record<string, unknown> }>>(
           args: Args,
        ) => PostgresInsertFromResult<T, Args>
      : null;
   insertRows: T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }
      ? () => SqlInsertRowsResult<T>
      : null;
   update: T extends { Select: Record<string, unknown>; Update: Record<string, unknown> }
      ? <Args extends SqlUpdateArgs>(
           args: Args,
        ) => PostgresTableUpdateResult<T & { Select: Record<string, unknown>; Update: Record<string, unknown> }, Args>
      : null;
   delete: T extends { Select: Record<string, unknown>; Delete: true }
      ? <Args extends SqlDeleteArgs>(args: Args) => PostgresDeleteResult<T, Args>
      : null;
};
