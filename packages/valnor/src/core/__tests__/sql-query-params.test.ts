import { describe, expect, test } from "vitest";
import { sql } from "../sql.js";
import { param } from "../query/index.js";
import { Account } from "./models/valnor_test.schema.js";
import { row } from "../query/index.js";
import { info } from "../charms/index.js";

describe("SqlQuery.params", () => {
   test("extracts params from query", () => {
      const query = sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$email} = ${param("email")}
           and ${Account.$accountId} = ${param("accountId")}
      `;

      expect(query.params).toEqual({
         email: { name: "email" },
         accountId: { name: "accountId" },
      });
      expect(Object.keys(query.params)).toHaveLength(2);
   });

   test("returns empty object when no params", () => {
      const query = sql`
         select ${row(Account.$$)}
         from ${Account}
      `;

      expect(query.params).toEqual({});
      expect(Object.keys(query.params)).toHaveLength(0);
   });

   test("handles duplicate params", () => {
      const query = sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$email} = ${param("email")}
            or ${Account.$email} = ${param("email")}
      `;

      expect(query.params).toEqual({
         email: { name: "email" },
      });
      expect(Object.keys(query.params)).toHaveLength(1);
   });

   test("extracts params from subqueries", () => {
      const subquery = sql`
         ${info({ label: "Subquery" })}
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$email} = ${param("email")}
      `;

      const query = sql`
         select ${row(subquery.$$)}
         from ${subquery}
         where ${subquery.$accountId} = ${param("accountId")}
      `;

      expect(query.params).toEqual({
         email: { name: "email" },
         accountId: { name: "accountId" },
      });
      expect(subquery.params).toEqual({
         email: { name: "email" },
      });
   });

   test("handles params in arrays", () => {
      const query = sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$accountId} in (${[param("id1"), param("id2"), param("id3")]})
      `;

      expect(query.params).toEqual({
         id1: { name: "id1" },
         id2: { name: "id2" },
         id3: { name: "id3" },
      });
      expect(Object.keys(query.params)).toHaveLength(3);
   });

   test("includes params from subqueries with arrays", () => {
      const subquery = sql`
         ${info({ label: "Subquery" })}
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$accountId} in (${[param("id1"), param("id2")]})
      `;

      const query = sql`
         select ${row(subquery.$$)}
         from ${subquery}
         where ${subquery.$email} = ${param("email")}
      `;

      expect(query.params).toEqual({
         id1: { name: "id1" },
         id2: { name: "id2" },
         email: { name: "email" },
      });
      expect(Object.keys(query.params)).toHaveLength(3);
   });
});
