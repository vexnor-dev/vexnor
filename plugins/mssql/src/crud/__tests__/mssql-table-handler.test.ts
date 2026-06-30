import { describe, expect, test } from "vitest";
import { newMssqlTableHandler } from "#src/crud/mssql-table-handler.js";
import { Account } from "@vexnor/core/testing";
import "@vexnor/mssql";

describe("newMssqlTableHandler", () => {
   const handler = newMssqlTableHandler(Account);

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
      const query = handler.insertFrom({ FROM: Account.mssql.select({}).source });
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
      const query = handler.upsert({ MERGE_ON: [Account.$accountId] });
      expect(query).toBeDefined();
      expect(query.source).toBeDefined();
   });
});

describe("newMssqlTableHandler — disabled CRUD branches", () => {
   test("handler without insert/update/delete", () => {
      const readOnlyTable = { ...Account, crud: { select: true, insert: false, update: false, delete: false } };
      const handler = newMssqlTableHandler(readOnlyTable as typeof Account);
      expect(handler.select).toBeDefined();
      expect((handler as Record<string, unknown>).upsert).toBeUndefined();
      expect((handler as Record<string, unknown>).insertRows).toBeUndefined();
      expect((handler as Record<string, unknown>).update).toBeUndefined();
      expect((handler as Record<string, unknown>).delete).toBeUndefined();
   });

   test("handler without select", () => {
      const noSelectTable = { ...Account, crud: { select: false, insert: true, update: true, delete: true } };
      const handler = newMssqlTableHandler(noSelectTable as typeof Account);
      expect((handler as Record<string, unknown>).select).toBeUndefined();
      expect((handler as Record<string, unknown>).insertRows).toBeDefined();
   });
});
