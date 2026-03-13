import { SqlDeleteArgs, SqlInsertFromArgs, SqlSelectArgs, SqlTable, SqlUpdateArgs } from "valnor";
import { sqlite3Select, Sqlite3SelectResult } from "./sqlite3-select.js";
import { sqlite3InsertRows, Sqlite3InsertRowsResult } from "./sqlite3-insert-rows.js";
import { sqlite3InsertFrom, Sqlite3InsertFromResult } from "./sqlite3-insert-from.js";
import { sqlite3Update, Sqlite3TableUpdateResult } from "./sqlite3-update.js";
import { sqlite3Delete, Sqlite3DeleteResult } from "./sqlite3-delete.js";

export const sqlite3Crud = <
   T extends {
      Select: Record<string, unknown>;
      Insert?: Record<string, unknown>;
      Update?: Record<string, unknown>;
      Delete?: boolean;
   },
>(
   table: SqlTable<T>,
): Sqlite3CrudCommands<T> => {
   const { select, insert, update, delete: delete$ } = table.crud;
   return {
      select: (select
         ? (args) => sqlite3Select(<SqlTable<{ Select: T["Select"] }>>table, args)
         : null) as Sqlite3CrudCommands<T>["select"],
      insertFrom: (insert
         ? (args) => sqlite3InsertFrom(<SqlTable<{ Select: T["Select"]; Insert: NonNullable<T["Insert"]> }>>table, args)
         : null) as Sqlite3CrudCommands<T>["insertFrom"],
      insertRows: (insert
         ? () => sqlite3InsertRows(<SqlTable<{ Select: T["Select"]; Insert: NonNullable<T["Insert"]> }>>table)
         : null) as Sqlite3CrudCommands<T>["insertRows"],
      update: (update
         ? (args) => sqlite3Update(<SqlTable<{ Select: T["Select"]; Update: NonNullable<T["Update"]> }>>table, args)
         : null) as Sqlite3CrudCommands<T>["update"],
      delete: (delete$
         ? (args) => sqlite3Delete(<SqlTable<{ Select: T["Select"]; Delete: true }>>table, args)
         : null) as Sqlite3CrudCommands<T>["delete"],
   };
};

export type Sqlite3CrudCommands<
   T extends {
      Select?: Record<string, unknown>;
      Insert?: Record<string, unknown>;
      Update?: Record<string, unknown>;
      Delete?: boolean;
   },
> = {
   select: T extends { Select: Record<string, unknown> }
      ? <Args extends SqlSelectArgs>(args: Args) => Sqlite3SelectResult<T & { Select: Record<string, unknown> }, Args>
      : null;
   insertFrom: T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }
      ? <Args extends SqlInsertFromArgs<T & { Select: Record<string, unknown>; Insert: Record<string, unknown> }>>(
           args: Args,
        ) => Sqlite3InsertFromResult<T & { Select: Record<string, unknown>; Insert: Record<string, unknown> }, Args>
      : null;
   insertRows: T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }
      ? () => Sqlite3InsertRowsResult<T & { Select: Record<string, unknown>; Insert: Record<string, unknown> }>
      : null;
   update: T extends { Select: Record<string, unknown>; Update: Record<string, unknown> }
      ? <Args extends SqlUpdateArgs>(
           args: Args,
        ) => Sqlite3TableUpdateResult<T & { Select: Record<string, unknown>; Update: Record<string, unknown> }, Args>
      : null;
   delete: T extends { Select: Record<string, unknown>; Delete: true }
      ? <Args extends SqlDeleteArgs>(args: Args) => Sqlite3DeleteResult<T, Args>
      : null;
};
