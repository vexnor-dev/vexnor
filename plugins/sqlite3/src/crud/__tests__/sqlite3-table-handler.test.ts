import { describe, expect, test } from "vitest";
import { newSqlite3TableHandler } from "#/crud/sqlite3-table-handler.js";
import { Account } from "@vexnor/core/testing";
import "@vexnor/sqlite3";
import { param, sql } from "@vexnor/core";

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
         SET: sql`${Account.$firstName} = ${param<{ firstName: string }>("firstName")}`,
      });
      expect(query).toBeDefined();
      expect(query.source).toBeDefined();
   });
});
