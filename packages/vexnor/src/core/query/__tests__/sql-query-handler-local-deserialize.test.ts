import { describe, expect, test, beforeEach } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { SqlQueryHandler, newSqlQueryHandler } from "#/core/query/sql-query-handler.js";
import { SqlQuery, SqlQueryExtended } from "#/core/query/sql-query.js";
import { SqlRunArgs } from "#/core/query/sql-query-types.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { SqlSelectCharm } from "#/core/query/sql-charm.js";
import { resetIds } from "#/core/sql-base.js";

type MockResult = { rows: unknown[] };
type MockConnection = { query: () => Promise<MockResult> };

class MockQueryHandler<T extends { Row?: unknown; Params?: unknown }> extends SqlQueryHandler<
   Pick<T, "Row" | "Params"> & { QueryResult: MockResult; Connection: MockConnection }
> {
   constructor(query: SqlQuery<Pick<T, "Row" | "Params">>) {
      super(query);
   }

   resolveRows(result: MockResult): T["Row"][] {
      return result.rows as T["Row"][];
   }

   deserialize(result: MockResult, remote: boolean): MockResult {
      return { ...result, rows: this.deserializeRows(result.rows as T["Row"][], remote) };
   }

   async execute(args: SqlRunArgs<{ Connection: MockConnection; Params: T["Params"] }>): Promise<MockResult> {
      const _db = await args.db;
      return _db.query();
   }
}

function mockHandler<T extends { Row?: unknown; Params?: unknown }>(query: SqlQueryExtended<T>) {
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   return newSqlQueryHandler(new MockQueryHandler<T>(query) as any);
}

const DATE_STR = "2001-05-30T10:40:50.867Z";

beforeEach(() => resetIds());

describe("SqlQueryHandler all() — server-side deserialization", () => {
   test("no schema — returns rows unchanged", async () => {
      const q = sql`select ${row(Account.$accountId, Account.$email)} from ${Account}`;
      const rows = [{ accountId: "1", email: "a@b.com" }];
      const result = await mockHandler(q).all({ db: { query: async () => ({ rows }) } });
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "accountId": "1",
            "email": "a@b.com",
          },
        ]
      `);
   });

   test("only top-level Date fields — rows returned unchanged (driver already returns Date)", async () => {
      const q = sql`select ${row(Account.$accountId, Account.$createdAt)} from ${Account}`;
      const rows = [{ accountId: "1", createdAt: new Date(DATE_STR) }];
      const result = await mockHandler(q).all({ db: { query: async () => ({ rows }) } });
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "accountId": "1",
            "createdAt": 2001-05-30T10:40:50.867Z,
          },
        ]
      `);
   });

   test("nested array charm — deserializes Date strings inside array items, leaves top-level Date unchanged", async () => {
      const charm = new SqlSelectCharm({
         key: "orders",
         params: null,
         jsonSchema: { orders: [{ createdAt: "Date" }] },
         write() {},
      });
      const q = sql`select ${row(Account.$accountId, Account.$createdAt)}, ${charm} from ${Account}`;
      const rows = [
         {
            accountId: "1",
            createdAt: new Date(DATE_STR),
            orders: [{ orderId: "o1", createdAt: DATE_STR }],
         },
      ];
      const result = await mockHandler(q).all({ db: { query: async () => ({ rows }) } });
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

   test("nested object charm — deserializes Date strings inside object", async () => {
      const charm = new SqlSelectCharm({
         key: "lastOrder",
         params: null,
         jsonSchema: { lastOrder: { createdAt: "Date" } },
         write() {},
      });
      const q = sql`select ${row(Account.$accountId)}, ${charm} from ${Account}`;
      const rows = [{ accountId: "1", lastOrder: { orderId: "o1", createdAt: DATE_STR } }];
      const result = await mockHandler(q).all({ db: { query: async () => ({ rows }) } });
      expect(result).toMatchInlineSnapshot(`
        [
          {
            "accountId": "1",
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
      const result = await mockHandler(q).all({ db: { query: async () => ({ rows }) } });
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

describe("SqlQueryHandler run() — server-side deserialization", () => {
   test("nested array charm — run() returns deserialized result", async () => {
      const charm = new SqlSelectCharm({
         key: "orders",
         params: null,
         jsonSchema: { orders: [{ createdAt: "Date" }] },
         write() {},
      });
      const q = sql`select ${row(Account.$accountId, Account.$createdAt)}, ${charm} from ${Account}`;
      const rows = [{
         accountId: "1",
         createdAt: new Date(DATE_STR),
         orders: [{ orderId: "o1", createdAt: DATE_STR }],
      }];
      const result = await mockHandler(q).run({ db: { query: async () => ({ rows }) } });
      expect(result).toMatchInlineSnapshot(`
        {
          "rows": [
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
          ],
        }
      `);
   });

   test("only top-level Date fields — run() returns result unchanged", async () => {
      const q = sql`select ${row(Account.$accountId, Account.$createdAt)} from ${Account}`;
      const rows = [{ accountId: "1", createdAt: new Date(DATE_STR) }];
      const result = await mockHandler(q).run({ db: { query: async () => ({ rows }) } });
      expect(result).toMatchInlineSnapshot(`
        {
          "rows": [
            {
              "accountId": "1",
              "createdAt": 2001-05-30T10:40:50.867Z,
            },
          ],
        }
      `);
   });
});
