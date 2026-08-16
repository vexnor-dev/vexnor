import { SqlDeleteArgs, SqlInsertFromArgs, SqlSelectArgs, SqlTable, SqlUpdateArgs } from "@vexnor/core";
import { DuckDBDeleteCommand, DuckDBDeleteCommandResult } from "#src/crud/duckdb-delete-command.js";
import { DuckDBInsertFromCommand, DuckDBInsertFromCommandResult } from "#src/crud/duckdb-insert-from-command.js";
import { DuckDBInsertRowsCommand, DuckDBInsertRowsCommandResult } from "#src/crud/duckdb-insert-rows-command.js";
import { DuckDBSelectCommand, DuckDBSelectCommandResult } from "#src/crud/duckdb-select-command.js";
import { DuckDBUpdateCommand, DuckDBUpdateCommandResult } from "#src/crud/duckdb-update-command.js";
import { DuckDBUpsertCommand, DuckDBUpsertCommandArgs, DuckDBUpsertCommandResult } from "#src/crud/duckdb-upsert-command.js";

type SelectInsertTable<T> = Extract<T, { Select: Record<string, unknown>; Insert: Record<string, unknown> }>;
type SelectUpdateTable<T> = Extract<T, { Select: Record<string, unknown>; Update: Record<string, unknown> }>;
type SelectDeleteTable<T> = Extract<T, { Select: Record<string, unknown>; Delete: true }>;

export type DuckDBTableHandler<
   T extends {
      Select: Record<string, unknown>;
      Insert?: Record<string, unknown>;
      Update?: Record<string, unknown>;
      Delete?: boolean;
   },
> = (T extends { Select: Record<string, unknown> }
   ? {
        select: <Args extends SqlSelectArgs<T & { Select: Record<string, unknown> }>>(
           args: Args,
        ) => DuckDBSelectCommandResult<T & { Select: Record<string, unknown> }, Args>;
     }
   : unknown) &
   (T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> }
      ? {
           insertRows: () => DuckDBInsertRowsCommandResult<SelectInsertTable<T>>;
           insertFrom: <Args extends SqlInsertFromArgs<SelectInsertTable<T>>>(
              args: Args,
           ) => DuckDBInsertFromCommandResult<SelectInsertTable<T>, Args>;
           upsert: (args: DuckDBUpsertCommandArgs) => DuckDBUpsertCommandResult<SelectInsertTable<T>>;
        }
      : unknown) &
   (T extends { Select: Record<string, unknown>; Update: Record<string, unknown> }
      ? { update: <Args extends SqlUpdateArgs>(args: Args) => DuckDBUpdateCommandResult<SelectUpdateTable<T>, Args> }
      : unknown) &
   (T extends { Select: Record<string, unknown>; Delete: true }
      ? { delete: <Args extends SqlDeleteArgs>(args: Args) => DuckDBDeleteCommandResult<SelectDeleteTable<T>, Args> }
      : unknown);

export function newDuckDBTableHandler<
   T extends {
      Select: Record<string, unknown>;
      Insert?: Record<string, unknown>;
      Update?: Record<string, unknown>;
      Delete?: boolean;
   },
>(table: SqlTable<T>): DuckDBTableHandler<T> {
   const handler: Record<string, unknown> = {};
   if (table.crud.select) {
      handler.select = <Args extends SqlSelectArgs<T & { Select: Record<string, unknown> }>>(args: Args) =>
         new DuckDBSelectCommand(table as SqlTable<T & { Select: Record<string, unknown> }>, args).execute();
   }
   if (table.crud.insert) {
      const insertTable = table as SqlTable<T & { Select: Record<string, unknown>; Insert: Record<string, unknown> }>;
      handler.insertRows = () => new DuckDBInsertRowsCommand(insertTable).execute();
      handler.insertFrom = <Args extends SqlInsertFromArgs<T & { Select: Record<string, unknown>; Insert: Record<string, unknown> }>>(
         args: Args,
      ) => new DuckDBInsertFromCommand(insertTable, args).execute();
      handler.upsert = (args: DuckDBUpsertCommandArgs) => new DuckDBUpsertCommand(insertTable, args).execute();
   }
   if (table.crud.update) {
      handler.update = <Args extends SqlUpdateArgs>(args: Args) =>
         new DuckDBUpdateCommand(
            table as SqlTable<T & { Select: Record<string, unknown>; Update: Record<string, unknown> }>,
            args,
         ).execute();
   }
   if (table.crud.delete) {
      handler.delete = <Args extends SqlDeleteArgs>(args: Args) =>
         new DuckDBDeleteCommand(table as SqlTable<T & { Select: Record<string, unknown>; Delete: true }>, args).execute();
   }
   return handler as DuckDBTableHandler<T>;
}
