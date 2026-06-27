import { describe, expect, test } from "vitest";
import { newSqlite3TableHandler } from "#src/crud/sqlite3-table-handler.js";
import { Account } from "@vexnor/core/testing";
import "@vexnor/sqlite3";

describe("newSqlite3TableHandler", () => {
   const handler = newSqlite3TableHandler(Account);

   test("select() — builds query object", () => {
      const query = handler.select({});
      expect(query).toBeDefined();
      expect(query.source).toBeDefined();
   });

   test("insertRows() — builds query object", () => {
      const query = handler.insertRows();
      expect(query).toBeDefined();
      expect(query.source).toBeDefined();
   });

   test("insertFrom() — builds query object", () => {
      const query = handler.insertFrom({ FROM: Account.sqlite.select({}).source });
      expect(query).toBeDefined();
      expect(query.source).toBeDefined();
   });

   test("update() — builds query object", () => {
      const query = handler.update({});
      expect(query).toBeDefined();
      expect(query.source).toBeDefined();
   });

   test("delete() — builds query object", () => {
      const query = handler.delete({ force: true });
      expect(query).toBeDefined();
      expect(query.source).toBeDefined();
   });

   test("upsert() — builds query object", () => {
      const query = handler.upsert({
         CONFLICT_ON: [Account.$accountId],
      });
      expect(query).toBeDefined();
      expect(query.source).toBeDefined();
   });
});

describe("newSqlite3TableHandler — disabled CRUD branches", () => {
   test("handler without insert/update/delete", () => {
      const readOnlyTable = { ...Account, crud: { select: true, insert: false, update: false, delete: false } };
      const handler = newSqlite3TableHandler(readOnlyTable as typeof Account);
      expect(handler.select).toBeDefined();
      expect((handler as Record<string, unknown>).upsert).toBeUndefined();
      expect((handler as Record<string, unknown>).insertRows).toBeUndefined();
      expect((handler as Record<string, unknown>).update).toBeUndefined();
      expect((handler as Record<string, unknown>).delete).toBeUndefined();
   });

   test("handler without select", () => {
      const noSelectTable = { ...Account, crud: { select: false, insert: true, update: true, delete: true } };
      const handler = newSqlite3TableHandler(noSelectTable as typeof Account);
      expect((handler as Record<string, unknown>).select).toBeUndefined();
      expect((handler as Record<string, unknown>).insertRows).toBeDefined();
   });
});
