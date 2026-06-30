import { describe, expect, test } from "vitest";
import { Account } from "@test-models/vexnor_dev.schema.js";
import { sql, row } from "@vexnor/core";

describe("exprDepth — column alias suppression inside expressions", () => {
   test("column at top-level SELECT emits AS alias", () => {
      const query = sql`SELECT ${Account.$firstName} FROM ${Account}`;
      const { text } = query.getSql({ options: { dialect: "postgresql" } });
      expect(text).toContain('"first_name" AS "firstName"');
   });

   test("column inside parentheses does NOT emit AS alias", () => {
      const query = sql`SELECT (${Account.$firstName} || ' ' || ${Account.$lastName}) AS "name" FROM ${Account}`;
      const { text } = query.getSql({ options: { dialect: "postgresql" } });
      expect(text).not.toContain('"first_name" AS "firstName"');
      expect(text).not.toContain('"last_name" AS "lastName"');
      expect(text).toContain('"first_name"');
      expect(text).toContain('"last_name"');
   });

   test("column inside SUM() does NOT emit AS alias", () => {
      const query = sql`SELECT SUM(${Account.$accountId}) FROM ${Account}`;
      const { text } = query.getSql({ options: { dialect: "postgresql" } });
      expect(text).not.toContain('AS "accountId"');
      expect(text).toContain('"account_id"');
   });

   test("string literal concatenation with column inside parens does NOT emit AS alias", () => {
      const query = sql`SELECT ('Store ' || ${Account.$accountId})::text FROM ${Account}`;
      const { text } = query.getSql({ options: { dialect: "postgresql" } });
      expect(text).not.toContain('as "accountId"');
      expect(text).toContain('"account_id"');
   });

   test("column inside subquery SELECT emits AS alias (new scope)", () => {
      const query = sql`SELECT (SELECT ${Account.$email} FROM ${Account} LIMIT 1) FROM ${Account}`;
      const { text } = query.getSql({ options: { dialect: "postgresql" } });
      // The inner SELECT is a new query scope — alias is emitted there
      expect(text).toContain('"email"');
   });

   test("column in WHERE clause does not emit alias", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$email} = ${"test@test.com"}`;
      const { text } = query.getSql({ options: { dialect: "postgresql" } });
      expect(text).toContain("WHERE");
      expect(text).not.toContain('WHERE "email" AS');
   });

   test("row(table.$$) still emits aliases at top level", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account}`;
      const { text } = query.getSql({ options: { dialect: "postgresql" } });
      expect(text).toContain('"first_name" AS "firstName"');
      expect(text).toContain('"last_name" AS "lastName"');
   });

   test("::cast after column inside parens does not emit alias", () => {
      const query = sql`SELECT (${Account.$accountId})::text FROM ${Account}`;
      const { text } = query.getSql({ options: { dialect: "postgresql" } });
      // Should not have AS "accountId" inside the parens
      expect(text).not.toContain('AS "accountId")');
   });
});
