import { describe, expect, test, beforeEach } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { col } from "#/core/query/sql-select-column.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { Order } from "@test-models/vexnor_dev.order-table.js";
import { resetIds } from "#/core/sql-base.js";
import { SqlSelectCharm } from "#/core/query/sql-charm.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";

beforeEach(() => resetIds());

describe("SqlQuery.jsonSchema", () => {
   test("returns empty schema when no Date or charm columns selected", () => {
      const q = sql`select ${row(Account.$accountId, Account.$email)} from ${Account}`;
      expect(q.jsonSchema).toMatchInlineSnapshot(`{}`);
   });

   test("includes Date columns from SqlTableColumn", () => {
      const q = sql`select ${row(Account.$accountId, Account.$createdAt, Account.$modifiedAt)} from ${Account}`;
      expect(q.jsonSchema).toMatchInlineSnapshot(`
        {
          "createdAt": "Date",
          "modifiedAt": "Date",
        }
      `);
   });

   test("includes only Date columns, skips string/number columns", () => {
      const q = sql`select ${row(Account.$email, Account.$firstName, Account.$createdAt)} from ${Account}`;
      expect(q.jsonSchema).toMatchInlineSnapshot(`
        {
          "createdAt": "Date",
        }
      `);
   });

   test("includes Date columns from multiple tables", () => {
      const q = sql`
         select ${row(Account.$accountId, Account.$createdAt, Order.$orderId, Order.$createdAt.as("orderCreatedAt"))}
         from ${Account}
         join ${Order} on ${Order.$accountId} = ${Account.$accountId}
      `;
      expect(q.jsonSchema).toMatchInlineSnapshot(`
        {
          "createdAt": "Date",
          "orderCreatedAt": "Date",
        }
      `);
   });

   test("returns empty schema when no row selected", () => {
      const q = sql`select count(*) as ${col<{ total: number }>("total")} from ${Account}`;
      expect(q.jsonSchema).toMatchInlineSnapshot(`{}`);
   });

   test("includes Date columns via SqlQueryColumn wrapping SqlTableColumn", () => {
      const inner = sql`select ${row(Account.$accountId, Account.$createdAt)} from ${Account}`;
      const q = sql`select ${row(inner.$$)} from ${inner}`;
      expect(q.jsonSchema).toMatchInlineSnapshot(`
        {
          "createdAt": "Date",
        }
      `);
   });

   test("includes Date columns via nested SqlQueryColumn chain", () => {
      const inner = sql`select ${row(Account.$createdAt)} from ${Account}`;
      const mid = sql`select ${row(inner.$$)} from ${inner}`;
      const q = sql`select ${row(mid.$$)} from ${mid}`;
      expect(q.jsonSchema).toMatchInlineSnapshot(`
        {
          "createdAt": "Date",
        }
      `);
   });

   test("includes SqlSelectCharm jsonSchema", () => {
      const charm = new SqlSelectCharm({
         key: "lastOrder",
         params: null,
         jsonSchema: { lastOrder: { createdAt: "Date" } },
         write(_context: SqlBuildContext) {},
      });
      const q = sql`select ${row(Account.$accountId)}, ${charm} from ${Account}`;
      expect(q.jsonSchema).toMatchInlineSnapshot(`
        {
          "lastOrder": {
            "createdAt": "Date",
          },
        }
      `);
   });

   test("merges SqlTableColumn and SqlSelectCharm schemas", () => {
      const charm = new SqlSelectCharm({
         key: "orders",
         params: null,
         jsonSchema: { orders: [{ createdAt: "Date" }] },
         write(_context: SqlBuildContext) {},
      });
      const q = sql`select ${row(Account.$accountId, Account.$createdAt)}, ${charm} from ${Account}`;
      expect(q.jsonSchema).toMatchInlineSnapshot(`
        {
          "createdAt": "Date",
          "orders": [
            {
              "createdAt": "Date",
            },
          ],
        }
      `);
   });

   test("SqlSelectCharm schema bubbles up through SqlQueryColumn in parent query", () => {
      const charm = new SqlSelectCharm({
         key: "orders",
         params: null,
         jsonSchema: { orders: [{ createdAt: "Date" }] },
         write(_context: SqlBuildContext) {},
      });
      const inner = sql`select ${row(Account.$accountId, Account.$createdAt)}, ${charm} from ${Account}`;
      const q = sql`select ${row(inner.$$)} from ${inner}`;
      expect(q.jsonSchema).toMatchInlineSnapshot(`
        {
          "createdAt": "Date",
          "orders": [
            {
              "createdAt": "Date",
            },
          ],
        }
      `);
   });
});

describe("SqlTableColumn.jsonSchema", () => {
   test("returns columnType keyed by column key", () => {
      expect(Account.$createdAt.jsonSchema).toMatchInlineSnapshot(`
        {
          "createdAt": "Date",
        }
      `);
   });

   test("returns empty when no columnType", () => {
      expect(Account.$email.jsonSchema).toMatchInlineSnapshot(`{}`);
   });

   test("uses aliased key when column is aliased", () => {
      expect(Account.$createdAt.as("accountCreatedAt").jsonSchema).toMatchInlineSnapshot(`
        {
          "accountCreatedAt": "Date",
        }
      `);
   });
});

describe("SqlQueryColumn.jsonSchema", () => {
   test("delegates to SqlTableColumn target", () => {
      const q = sql`select ${row(Account.$createdAt)} from ${Account}`;
      expect(q.row.$createdAt.jsonSchema).toMatchInlineSnapshot(`
        {
          "createdAt": "Date",
        }
      `);
   });

   test("returns empty when target has no columnType", () => {
      const q = sql`select ${row(Account.$email)} from ${Account}`;
      expect(q.row.$email.jsonSchema).toMatchInlineSnapshot(`{}`);
   });

   test("remaps key when aliased", () => {
      const q = sql`select ${row(Account.$createdAt.as("ts"))} from ${Account}`;
      expect(q.row.$ts.jsonSchema).toMatchInlineSnapshot(`
        {
          "ts": "Date",
        }
      `);
   });

   test("traverses nested SqlQueryColumn chain", () => {
      const inner = sql`select ${row(Account.$createdAt)} from ${Account}`;
      const q = sql`select ${row(inner.$$)} from ${inner}`;
      expect(q.row.$createdAt.jsonSchema).toMatchInlineSnapshot(`
        {
          "createdAt": "Date",
        }
      `);
   });
});

describe("SqlSelectCharm.jsonSchema", () => {
   test("returns stored jsonSchema", () => {
      const charm = new SqlSelectCharm({
         key: "lastOrder",
         params: null,
         jsonSchema: { lastOrder: { createdAt: "Date" } },
         write(_context: SqlBuildContext) {},
      });
      expect(charm.jsonSchema).toMatchInlineSnapshot(`
        {
          "lastOrder": {
            "createdAt": "Date",
          },
        }
      `);
   });

   test("returns empty when no jsonSchema provided", () => {
      const charm = new SqlSelectCharm({
         key: "orders",
         params: null,
         write(_context: SqlBuildContext) {},
      });
      expect(charm.jsonSchema).toMatchInlineSnapshot(`{}`);
   });
});
