import { describe, expect, test } from "vitest";
import { sql, row, SqlSelectCharm, type RemoteClient } from "@vexnor/core";
import { Account } from "@vexnor/core/testing";
import "@vexnor/sqlite3";
import "#src/sqlite3-augment.js";

const DATE_STR = "2001-05-30T10:40:50.867Z";

const remoteClient = <TRow>(rows: TRow[]): RemoteClient => ({
   remoteExecute<TResult>(): Promise<TResult> {
      return Promise.resolve({ rows }) as unknown as Promise<TResult>;
   },
});

describe("BetterSqlite3QueryHandler all() — remote deserialization", () => {
   test("no schema — returns rows unchanged", async () => {
      const q = sql`select ${row(Account.$accountId, Account.$email)} from ${Account}`;
      const rows = [{ accountId: "1", email: "a@b.com" }];
      const result = await q.sqlite.all({ db: remoteClient(rows) });
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "accountId": "1",
            "email": "a@b.com",
          },
        ]
      `);
   });

   test("deserializes top-level Date fields from JSON strings", async () => {
      const q = sql`select ${row(Account.$accountId, Account.$createdAt)} from ${Account}`;
      const rows = [{ accountId: "1", createdAt: DATE_STR }];
      const result = await q.sqlite.all({ db: remoteClient(rows) });
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "accountId": "1",
            "createdAt": 2001-05-30T10:40:50.867Z,
          },
        ]
      `);
   });

   test("deserializes nested array charm Date fields", async () => {
      const charm = new SqlSelectCharm({
         key: "orders",
         params: null,
         jsonSchema: { orders: [{ createdAt: "Date" }] },
         write() {},
      });
      const q = sql`select ${row(Account.$accountId, Account.$createdAt)}, ${charm} from ${Account}`;
      const rows = [{ accountId: "1", createdAt: DATE_STR, orders: [{ orderId: "o1", createdAt: DATE_STR }] }];
      const result = await q.sqlite.all({ db: remoteClient(rows) });
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "accountId": "1",
            "createdAt": 2001-05-30T10:40:50.867Z,
            "orders": [
              {
                "createdAt": 2001-05-30T10:40:50.867Z,
                "orderId": "o1",
              },
            ],
          },
        ]
      `);
   });

   test("deserializes nested object charm Date fields", async () => {
      const charm = new SqlSelectCharm({
         key: "lastOrder",
         params: null,
         jsonSchema: { lastOrder: { createdAt: "Date" } },
         write() {},
      });
      const q = sql`select ${row(Account.$accountId, Account.$createdAt)}, ${charm} from ${Account}`;
      const rows = [{ accountId: "1", createdAt: DATE_STR, lastOrder: { orderId: "o1", createdAt: DATE_STR } }];
      const result = await q.sqlite.all({ db: remoteClient(rows) });
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "accountId": "1",
            "createdAt": 2001-05-30T10:40:50.867Z,
            "lastOrder": {
              "createdAt": 2001-05-30T10:40:50.867Z,
              "orderId": "o1",
            },
          },
        ]
      `);
   });

   test("null nested value — leaves it as null", async () => {
      const charm = new SqlSelectCharm({
         key: "lastOrder",
         params: null,
         jsonSchema: { lastOrder: { createdAt: "Date" } },
         write() {},
      });
      const q = sql`select ${row(Account.$accountId)}, ${charm} from ${Account}`;
      const rows = [{ accountId: "1", lastOrder: null }];
      const result = await q.sqlite.all({ db: remoteClient(rows) });
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "accountId": "1",
            "lastOrder": null,
          },
        ]
      `);
   });
});
