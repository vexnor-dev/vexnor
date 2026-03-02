import { SqlTable } from "../schema/index.js";
import { SqlTableCrud } from "./sql-table-crud.js";
import { SqlTableCreate } from "./sql-table-create.js";
import { SqlTableUpdate } from "./sql-table-update.js";
import { SqlTableRead } from "./sql-table-read.js";
import { SqlTableDelete } from "./sql-table-delete.js";

export function crud<
   T extends {
      Select: Record<string, unknown>;
      Insert?: Record<string, unknown>;
      Update?: Record<string, unknown>;
      Delete?: boolean;
   },
>(table: SqlTable<T>): SqlTable<T> & SqlTableCrud<T> {
   const read = new SqlTableRead(table);
   const create = table.crud.create
      ? new SqlTableCreate(<SqlTable<{ Select: Record<string, unknown>; Insert: Record<string, unknown> }>>table)
      : null;
   const update = table.crud.update
      ? new SqlTableUpdate(<SqlTable<{ Select: Record<string, unknown>; Update: Record<string, unknown> }>>table)
      : null;
   const delete$ =
      table.crud.delete === true
         ? new SqlTableDelete(<SqlTable<{ Select: Record<string, unknown>; Delete: true }>>table)
         : null;

   Object.assign(table, {
      read: read.read.bind(read),
      create: create?.create.bind(create) ?? null,
      update: update?.update.bind(update) ?? null,
      delete: delete$?.delete.bind(delete$) ?? null,
   });

   return table as SqlTable<T> & SqlTableCrud<T>;
}
