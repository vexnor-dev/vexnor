import { describe, test, expect } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { insert } from "#/core/operators/sql-insert-x.js";
import { set } from "#/core/operators/sql-set.js";
import { upsert } from "#/core/operators/sql-upsert.js";
import { Account } from "@test-models/vexnor_dev.schema.js";

describe("Empty params — mutation operators must throw", () => {
   describe("insert()", () => {
      test("rows: [] throws", () => {
         const query = sql`INSERT INTO ${Account} ${insert(Account)} RETURNING ${row(Account.$$)}`;
         expect(() => query.getSql({ params: { rows: [] } })).toThrow();
      });

      test("rows: null throws", () => {
         const query = sql`INSERT INTO ${Account} ${insert(Account)} RETURNING ${row(Account.$$)}`;
         expect(() => query.getSql({ params: { rows: null as never } })).toThrow();
      });
   });

   describe("set()", () => {
      test("set: {} throws", () => {
         const query = sql`UPDATE ${Account} ${set(Account)} WHERE 1=1`;
         expect(() => query.getSql({ params: { set: {} } })).toThrow();
      });

      test("set: null throws", () => {
         const query = sql`UPDATE ${Account} ${set(Account)} WHERE 1=1`;
         expect(() => query.getSql({ params: { set: null as never } })).toThrow();
      });
   });

   describe("upsert()", () => {
      test("rows: [] throws", () => {
         const query = sql`INSERT INTO ${Account} ${upsert(Account, ["accountId"])} RETURNING ${row(Account.$$)}`;
         expect(() => query.getSql({ params: { rows: [] } })).toThrow();
      });

      test("rows: null throws", () => {
         const query = sql`INSERT INTO ${Account} ${upsert(Account, ["accountId"])} RETURNING ${row(Account.$$)}`;
         expect(() => query.getSql({ params: { rows: null as never } })).toThrow();
      });
   });
});

describe("insert.cols/values — paramName defaults", () => {
   test("insert.cols() uses 'rows' as default paramName", () => {
      const query = sql`INSERT INTO ${Account} (${insert.cols(Account)}) VALUES ${insert.values(Account)} RETURNING ${row(Account.$$)}`;
      const { text } = query.getSql({
         params: { rows: [{ email: "a@b.com", firstName: "A", lastName: "B" }] },
      });
      expect(text).toContain('"email"');
   });
});
