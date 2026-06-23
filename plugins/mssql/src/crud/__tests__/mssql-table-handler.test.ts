import { describe, expect, test } from "vitest";
import { newMssqlTableHandler } from "#/crud/mssql-table-handler.js";
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
