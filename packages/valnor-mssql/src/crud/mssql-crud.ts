import { SqlDeleteArgs, SqlInsertFromArgs, SqlSelectArgs, SqlTable, SqlUpdateArgs } from "valnor";
import { mssqlSelect, MssqlSelectResult } from "./mssql-select.js";
import { mssqlInsertRows, MssqlInsertRowsResult } from "./mssql-insert-rows.js";
import { MssqlTableUpdateResult, mssqlUpdate } from "./mssql-update.js";
import { MssqlDeleteResult, mssqlDelete } from "./mssql-delete.js";
import { mssqlInsertFrom, MssqlInsertFromResult } from "#/crud/mssql-insert-from.js";

export const mssqlCrud = <
   T extends {
      Select: Record<string, unknown>;
      Insert?: Record<string, unknown>;
      Update?: Record<string, unknown>;
      Delete?: boolean;
   },
>(
   table: SqlTable<T>,
): MssqlCrudCommands<T> => {
   const { select, insert, update, delete: delete$ } = table.crud;
   return {
      select: (select
         ? (args) => mssqlSelect(<SqlTable<{ Select: T["Select"] }>>table, args)
         : null) as MssqlCrudCommands<T>["select"],
      insertFrom: (insert
         ? (args) => mssqlInsertFrom(<SqlTable<{ Select: T["Select"]; Insert: NonNullable<T["Insert"]> }>>table, args)
         : null) as MssqlCrudCommands<T>["insertFrom"],
      insertRows: (insert
         ? () => mssqlInsertRows(<SqlTable<{ Select: T["Select"]; Insert: NonNullable<T["Insert"]> }>>table)
         : null) as MssqlCrudCommands<T>["insertRows"],
      update: (update
         ? (args) => mssqlUpdate(<SqlTable<{ Select: T["Select"]; Update: NonNullable<T["Update"]> }>>table, args)
         : null) as MssqlCrudCommands<T>["update"],
      delete: (delete$
         ? (args) => mssqlDelete(<SqlTable<{ Select: T["Select"]; Delete: true }>>table, args)
         : null) as MssqlCrudCommands<T>["delete"],
   };
};

export type MssqlCrudCommands<
   T extends {
      Select?: Record<string, unknown>;
      Insert?: Record<string, unknown>;
      Update?: Record<string, unknown>;
      Delete?: boolean;
   },
> = {
   select: T extends { Select: Record<string, unknown> }
      ? <Args extends SqlSelectArgs>(args: Args) => MssqlSelectResult<T & { Select: Record<string, unknown> }, Args>
      : null;
   insertFrom: T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }
      ? <Args extends SqlInsertFromArgs<T & { Select: Record<string, unknown>; Insert: Record<string, unknown> }>>(
           args: Args,
        ) => MssqlInsertFromResult<T, Args>
      : null;
   insertRows: T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }
      ? () => MssqlInsertRowsResult<T & { Select: Record<string, unknown>; Insert: Record<string, unknown> }>
      : null;
   update: T extends { Select: Record<string, unknown>; Update: Record<string, unknown> }
      ? <Args extends SqlUpdateArgs>(
           args: Args,
        ) => MssqlTableUpdateResult<T & { Select: Record<string, unknown>; Update: Record<string, unknown> }, Args>
      : null;
   delete: T extends { Select: Record<string, unknown>; Delete: true }
      ? <Args extends SqlDeleteArgs>(args: Args) => MssqlDeleteResult<T, Args>
      : null;
};
