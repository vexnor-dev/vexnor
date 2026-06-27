import { describe, expect, test } from "vitest";
import { newPostgresTableHandler } from "#src/crud/postgres-table-handler.js";
import { Account } from "@vexnor/core/testing";

describe("newPostgresTableHandler", () => {
   const handler = newPostgresTableHandler(Account);

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
      const query = handler.insertFrom({ FROM: Account.postgres.select({}).source });
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
      const query = handler.upsert({ CONFLICT_ON: [Account.$accountId] });
      expect(query).toBeDefined();
      expect(query.source).toBeDefined();
   });
});

describe("newPostgresTableHandler — disabled CRUD branches", () => {
   test("handler without insert/update/delete has no upsert/insertRows/update/delete", () => {
      const readOnlyTable = { ...Account, crud: { select: true, insert: false, update: false, delete: false } };
      const handler = newPostgresTableHandler(readOnlyTable as typeof Account);
      expect(handler.select).toBeDefined();
      expect((handler as Record<string, unknown>).upsert).toBeUndefined();
      expect((handler as Record<string, unknown>).insertRows).toBeUndefined();
      expect((handler as Record<string, unknown>).update).toBeUndefined();
      expect((handler as Record<string, unknown>).delete).toBeUndefined();
   });

   test("handler without select has no select method", () => {
      const noSelectTable = { ...Account, crud: { select: false, insert: true, update: true, delete: true } };
      const handler = newPostgresTableHandler(noSelectTable as typeof Account);
      expect((handler as Record<string, unknown>).select).toBeUndefined();
      expect((handler as Record<string, unknown>).insertRows).toBeDefined();
   });
});
