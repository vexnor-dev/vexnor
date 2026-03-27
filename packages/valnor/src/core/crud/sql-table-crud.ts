import { InferTable$RowBySelect } from "#/core/types/infer-types.js";
import { newSqlTableProxy, SqlTable, SqlTableExtended } from "#/core/schema/sql-table.js";
import { SqlCrudCommands } from "#/core/crud/sql-crud-commands.js";
import { strictEqual } from "#/lib/assert.js";
import { sqlSelect, SqlSelectArgs } from "#/core/crud/sql-select.js";
import { sqlInsertRows } from "#/core/crud/sql-insert-rows.js";
import { sqlUpdate, SqlUpdateArgs } from "#/core/crud/sql-update.js";
import { sqlDelete, SqlDeleteArgs } from "#/core/crud/sql-delete.js";
import { sqlInsertFrom, SqlInsertFromArgs } from "#/core/crud/sql-insert-from.js";

export type SqlTableCrudExtended<
   T extends {
      Select: Record<string, unknown>;
      Insert?: Record<string, unknown>;
      Update?: Record<string, unknown>;
      Delete?: boolean;
   },
> = SqlTableCrud<T> &
   InferTable$RowBySelect<T["Select"]> & {
      (strings: TemplateStringsArray): SqlTableExtended<T>;
   };

export type SqlTableCrudCrudProvider<T extends { Select: Record<string, unknown> }> = (
   table: SqlTable<T>,
) => SqlCrudCommands<T>;

export class SqlTableCrud<
   T extends {
      Select: Record<string, unknown>;
      Insert?: Record<string, unknown>;
      Update?: Record<string, unknown>;
      Delete?: boolean;
   },
> extends SqlTable<T> {
   readonly driver: string;

   readonly select: SqlCrudCommands<T>["select"];
   readonly insertFrom: SqlCrudCommands<T>["insertFrom"];
   readonly insertRows: SqlCrudCommands<T>["insertRows"];
   readonly update: SqlCrudCommands<T>["update"];
   readonly delete: SqlCrudCommands<T>["delete"];

   constructor(table: SqlTable<T>, provider: SqlTableCrudCrudProvider<T>) {
      super(table);

      const commands = provider(table);
      strictEqual(
         table.crud.select,
         Boolean(commands.select),
         `crud 'select' mismatch; flag=${table.crud.select} / command=${commands.select}`,
      );
      strictEqual(
         table.crud.insert,
         Boolean(commands.insertRows),
         `crud 'insert' mismatch; flag=${table.crud.insert} / command=${commands.insertRows}`,
      );
      strictEqual(
         table.crud.insert,
         Boolean(commands.insertFrom),
         `crud 'insert' mismatch; flag=${table.crud.insert} / command=${commands.insertFrom}`,
      );
      strictEqual(
         table.crud.update,
         Boolean(commands.update),
         `crud 'update' mismatch; flag=${table.crud.update} / command=${commands.update}`,
      );
      strictEqual(
         table.crud.delete,
         Boolean(commands.delete),
         `crud 'delete' mismatch; flag=${table.crud.delete} / command=${commands.delete}`,
      );

      this.select = commands.select;
      this.insertFrom = commands.insertFrom;
      this.insertRows = commands.insertRows;
      this.update = commands.update;
      this.delete = commands.delete;
      this.driver = commands.driver;
   }
}

/**
 * Creates a `SqlTableCrud` instance by combining a `SqlTable` with a crud provider.
 *
 * Used in generated files to attach database-specific CRUD commands to a table.
 * The result exposes `.select()`, `.insertRows()`, `.insertFrom()`, `.update()`,
 * and `.delete()` directly on the table object.
 *
 * @param table - The table to attach CRUD commands to.
 * @param provider - A function that returns the database-specific `SqlCrudCommands` for the table.
 */
export function newSqlTableCrud<
   T extends {
      Select: Record<string, unknown>;
      Insert?: Record<string, unknown>;
      Update?: Record<string, unknown>;
      Delete?: boolean;
   },
>(table: SqlTable<T>, provider: SqlTableCrudCrudProvider<T>): SqlTableCrudExtended<T> {
   const crud = new SqlTableCrud<T>(table, provider);
   return newSqlTableProxy(crud);
}

/** Default (database-agnostic) crud provider. Used when no plugin-specific provider is needed. */
export const sqlCrud = <
   T extends {
      Select: Record<string, unknown>;
      Insert?: Record<string, unknown>;
      Update?: Record<string, unknown>;
      Delete?: boolean;
   },
>(
   table: SqlTable<T>,
): SqlCrudCommands<T> => {
   const { select, insert, update, delete: delete$ } = table.crud;
   return {
      driver: "default",
      select: (select
         ? (args: SqlSelectArgs) =>
              sqlSelect(<SqlTable<{ Select: T["Select"]; Insert: NonNullable<T["Insert"]> }>>table, args)
         : null) as SqlCrudCommands<T>["select"],
      insertRows: (insert
         ? () => sqlInsertRows(<SqlTable<{ Select: T["Select"]; Insert: NonNullable<T["Insert"]> }>>table)
         : null) as SqlCrudCommands<T>["insertRows"],
      insertFrom: (insert
         ? (args: SqlInsertFromArgs<{ Select: T["Select"]; Insert: NonNullable<T["Insert"]> }>) =>
              sqlInsertFrom(<SqlTable<{ Select: T["Select"]; Insert: NonNullable<T["Insert"]> }>>table, args)
         : null) as SqlCrudCommands<T>["insertFrom"],
      update: (update
         ? (args: SqlUpdateArgs) =>
              sqlUpdate(<SqlTable<{ Select: T["Select"]; Update: NonNullable<T["Update"]> }>>table, args)
         : null) as SqlCrudCommands<T>["update"],
      delete: (delete$
         ? (args: SqlDeleteArgs) => sqlDelete(<SqlTable<{ Select: T["Select"]; Delete: true }>>table, args)
         : null) as SqlCrudCommands<T>["delete"],
   };
};
