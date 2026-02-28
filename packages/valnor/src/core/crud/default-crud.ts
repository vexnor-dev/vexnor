import { DefaultTableRead } from "./default-table-read.js";
import { SqlTable } from "../schema/index.js";
import { SqlTableCrud } from "./sql-table-crud.js";
import { DefaultTableCreate } from "./default-table-create.js";
import { DefaultTableUpdate } from "./default-table-update.js";
import { DefaultTableDelete } from "./default-table-delete.js";

// Extend the class type (in scope)
// declare module "valnor" {
//    interface SqlTable<
//       T extends {
//          Select: Record<string, unknown>;
//          Insert?: Record<string, unknown>;
//          Update?: Record<string, unknown>;
//          Delete?: boolean;
//       },
//    > {
//       readonly find: SqlTableCrud<T>["find"];
//       readonly create: SqlTableCrud<T> extends { create: true } ? SqlTableCrud<T>["create"] : null;
//       readonly update: SqlTableCrud<T> extends { update: true } ? SqlTableCrud<T>["update"] : null;
//       readonly delete: SqlTableCrud<T> extends { delete: true } ? SqlTableCrud<T>["delete"] : null;
//    }
// }

export function crud<
   T extends {
      Select: Record<string, unknown>;
      Insert?: Record<string, unknown>;
      Update?: Record<string, unknown>;
      Delete?: boolean;
   },
>(table: SqlTable<T>): SqlTable<T> & SqlTableCrud<T> {
   const read = new DefaultTableRead(table);
   const create = table.crud.create
      ? new DefaultTableCreate(<SqlTable<{ Select: Record<string, unknown>; Insert: Record<string, unknown> }>>table)
      : null;
   const update = table.crud.update
      ? new DefaultTableUpdate(<SqlTable<{ Select: Record<string, unknown>; Update: Record<string, unknown> }>>table)
      : null;
   const delete$ = table.crud.delete === true ? new DefaultTableDelete(table) : null;

   Object.assign(table, {
      read: read.read.bind(read),
      create: create?.create.bind(create) ?? null,
      update: update?.update.bind(update) ?? null,
      delete: delete$?.delete.bind(delete$) ?? null,
   });

   return table as SqlTable<T> & SqlTableCrud<T>;
}
//
// Object.defineProperty(SqlTable.prototype, "find", {
//    get: function () {
//       return new DefaultTableFind(this);
//    },
// });
//
// Object.defineProperty(SqlTable.prototype, "create", {
//    get: function () {
//       return this.crud.create ? new DefaultTableCreate(this) : null;
//    },
// });
//
// Object.defineProperty(SqlTable.prototype, "update", {
//    get: function () {
//       return this.crud.update ? new DefaultTableUpdate(this) : null;
//    },
// });
//
// Object.defineProperty(SqlTable.prototype, "delete", {
//    get: function () {
//       return this.crud.delete === true ? new DefaultTableDelete(this) : null;
//    },
// });
