import { describe, expect, test } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { param } from "#/core/query/sql-param.js";
import { col } from "#/core/query/sql-select-column.js";
import { raw } from "#/core/query/sql-raw.js";
import { val } from "#/core/query/sql-select-value.js";
import { DEFAULT } from "#/core/query/sql-default.js";
import { info } from "#/core/charms/sql-query-info.js";
import { SqlSelectCharm } from "#/core/query/sql-charm.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { Order } from "@test-models/vexnor_dev.order-table.js";

describe("hashId", () => {
   describe("SqlTableColumn", () => {
      test("includes schema.table.columnName", () => {
         expect(Account.$accountId.hashId).toMatchInlineSnapshot(`"SqlTableColumn#(account.account_id as accountId)"`);
      });

      test("aliased column has different hashId", () => {
         expect(Account.$email.as("userEmail").hashId).not.toBe(Account.$email.hashId);
      });

      test("different columns produce different hashIds", () => {
         expect(Account.$accountId.hashId).not.toBe(Account.$email.hashId);
      });

      test("same column always produces same hashId", () => {
         expect(Account.$accountId.hashId).toBe(Account.$accountId.hashId);
      });
   });

   describe("SqlTable", () => {
      test("includes schema.tableName", () => {
         expect(Account.hashId).toMatchInlineSnapshot(`"SqlTable#(main.account)"`);
      });

      test("different tables produce different hashIds", () => {
         expect(Account.hashId).not.toBe(Order.hashId);
      });
   });

   describe("SqlParam", () => {
      test("includes param name", () => {
         const p = param<{ email: string }>("email");
         expect(p.hashId).toMatchInlineSnapshot(`"SqlParam#(email)"`);
      });

      test("different param names produce different hashIds", () => {
         const p1 = param<{ email: string }>("email");
         const p2 = param<{ name: string }>("name");
         expect(p1.hashId).not.toBe(p2.hashId);
      });
   });

   describe("SqlSelectRow", () => {
      test("includes joined column hashIds", () => {
         const r = row(Account.$accountId, Account.$email);
         expect(r.hashId).toMatchInlineSnapshot(`"SqlSelectRow#(SqlTableColumn#(account.account_id as accountId),SqlTableColumn#(account.email))"`);
      });

      test("different column selections produce different hashIds", () => {
         const r1 = row(Account.$accountId);
         const r2 = row(Account.$email);
         expect(r1.hashId).not.toBe(r2.hashId);
      });

      test("same columns always produce same hashId", () => {
         const r1 = row(Account.$accountId, Account.$email);
         const r2 = row(Account.$accountId, Account.$email);
         expect(r1.hashId).toBe(r2.hashId);
      });
   });

   describe("SqlTableAll ($$)", () => {
      test("includes all column hashIds", () => {
         expect(Account.$$.hashId).toMatchInlineSnapshot(`"SqlTableAll#(SqlTableColumn#(account.account_id as accountId),SqlTableColumn#(account.status),SqlTableColumn#(account.email),SqlTableColumn#(account.first_name as firstName),SqlTableColumn#(account.last_name as lastName),SqlTableColumn#(account.notes),SqlTableColumn#(account.created_at as createdAt),SqlTableColumn#(account.modified_at as modifiedAt),SqlTableColumn#(account.parent_id as parentId))"`);
      });

      test("different tables produce different hashIds", () => {
         expect(Account.$$.hashId).not.toBe(Order.$$.hashId);
      });
   });

   describe("SqlSelectAll (query.$$)", () => {
      test("wraps inner query hashId with SqlSelectAll#()", () => {
         const q = sql`select ${row(Account.$accountId)} from ${Account}`;
         expect(q.$$.hashId).toMatchInlineSnapshot(`"SqlSelectAll#(SqlQuery#(["select "," from ",""]|SqlSelectRow#(SqlTableColumn#(account.account_id as accountId))|SqlTable#(main.account)))"`);
      });
   });

   describe("SqlSelectColumn (col)", () => {
      test("includes key", () => {
         const c = col<{ total: number }>("total");
         expect(c.hashId).toMatchInlineSnapshot(`"SqlSelectColumn#(total)"`);
      });
   });

   describe("SqlRaw (raw)", () => {
      test("includes raw value", () => {
         expect(raw("1=1").hashId).toMatchInlineSnapshot(`"SqlRaw#(SqlRaw(1=1))"`);
      });
   });

   describe("SqlSelectValue (val)", () => {
      test("includes expression and key", () => {
         const v = val`count(*)`.as<{ total: number }>("total");
         expect(v.hashId).toMatchInlineSnapshot(`"SqlSelectValue#(count(*) ... as total)"`);
      });
   });

   describe("SqlQuery", () => {
      test("same query produces same hashId", () => {
         const q1 = sql`select ${row(Account.$$)} from ${Account}`;
         const q2 = sql`select ${row(Account.$$)} from ${Account}`;
         expect(q1.hashId).toBe(q2.hashId);
      });

      test("different interpolated values produce different hashIds", () => {
         const q1 = sql`select ${row(Account.$accountId)} from ${Account}`;
         const q2 = sql`select ${row(Account.$email)} from ${Account}`;
         expect(q1.hashId).not.toBe(q2.hashId);
      });

      test("different tables produce different hashIds", () => {
         const q1 = sql`select * from ${Account}`;
         const q2 = sql`select * from ${Order}`;
         expect(q1.hashId).not.toBe(q2.hashId);
      });

      test("different template strings produce different hashIds", () => {
         const q1 = sql`select ${Account.$accountId} from ${Account}`;
         const q2 = sql`select ${Account.$accountId} from ${Account} where 1=1`;
         expect(q1.hashId).not.toBe(q2.hashId);
      });
   });

   describe("SqlQueryColumn", () => {
      test("wraps target hashId with SqlQueryColumn#()", () => {
         const q = sql`select ${row(Account.$accountId, Account.$email)} from ${Account}`;
         expect(q.row.$accountId.hashId).toMatchInlineSnapshot(`"SqlQueryColumn#(SqlTableColumn#(account.account_id as accountId))"`);
         expect(q.row.$email.hashId).toMatchInlineSnapshot(`"SqlQueryColumn#(SqlTableColumn#(account.email))"`);
      });
   });

   describe("SqlQueryRef (query.out)", () => {
      test("wraps inner query hashId with SqlQueryRef#()", () => {
         const q = sql`select ${row(Account.$accountId)} from ${Account}`;
         expect(q.out.hashId).toMatchInlineSnapshot(`"SqlQueryRef#(SqlQuery#(["select "," from ",""]|SqlSelectRow#(SqlTableColumn#(account.account_id as accountId))|SqlTable#(main.account)))"`);
      });
   });

   describe("SqlDefault (DEFAULT)", () => {
      test("includes DEFAULT", () => {
         expect(DEFAULT.hashId).toMatchInlineSnapshot(`"SqlDefault#(DEFAULT)"`);
      });
   });

   describe("SqlQueryInfo (info())", () => {
      test("includes key=value pairs", () => {
         expect(info({ label: "MyQuery" }).hashId).toMatchInlineSnapshot(`"SqlQueryInfo#(label=MyQuery)"`);
      });
   });

   describe("SqlSelectCharm", () => {
      test("includes key when no jsonSchema", () => {
         const charm = new SqlSelectCharm({ key: "orders", write: () => {}, params: null });
         expect(charm.hashId).toMatchInlineSnapshot(`"SqlSelectCharm#(orders:{}|)"`);
      });

      test("includes jsonSchema when present", () => {
         const charm = new SqlSelectCharm({
            key: "orders",
            write: () => {},
            params: null,
            jsonSchema: { createdAt: "Date" },
         });
         expect(charm.hashId).not.toBe(new SqlSelectCharm({ key: "orders", write: () => {}, params: null }).hashId);
      });
   });
});
