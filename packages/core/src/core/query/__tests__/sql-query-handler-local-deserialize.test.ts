import { describe, expect, test } from "vitest";
import { sql } from "#src/core/sql.js";
import { row } from "#src/core/query/sql-select-row.js";
import { newSqlQueryHandler, SqlQueryHandler } from "#src/core/query/sql-query-handler.js";
import { SqlQuery, SqlQueryExtended } from "#src/core/query/sql-query.js";
import { SqlRunArgs } from "#src/core/query/sql-query-types.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { SqlSelectCharm } from "#src/core/query/sql-charm.js";

type MockResult = { rows: unknown[] };
type MockConnection = { query: () => Promise<MockResult> };

class MockQueryHandler<T extends { Row?: unknown; Params?: unknown }> extends SqlQueryHandler<
   Pick<T, "Row" | "Params"> & { Read: MockResult; Write: MockResult; Connection: MockConnection }
> {
   constructor(query: SqlQuery<Pick<T, "Row" | "Params">>) {
      super(query, { pluginName: "mock" });
   }

   resolveRows(result: MockResult): T["Row"][] {
      return result.rows as T["Row"][];
   }

   deserialize<TResult = MockResult>(result: TResult, remote: boolean): TResult {
      return { ...result, rows: this.deserializeRows((result as MockResult).rows as T["Row"][], remote) };
   }

   async execute<TResult = MockResult>(
      args: SqlRunArgs<{ Connection: MockConnection; Params: T["Params"] }>,
   ): Promise<TResult> {
      const _db = await args.db;
      return (await _db.query()) as TResult;
   }
}

function mockHandler<T extends { Row?: unknown; Params?: unknown }>(query: SqlQueryExtended<T>) {
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   return newSqlQueryHandler(new MockQueryHandler<T>(query) as any);
}

const DATE_STR = "2001-05-30T10:40:50.867Z";

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
      const rows = [
         {
            accountId: "1",
            createdAt: new Date(DATE_STR),
            orders: [{ orderId: "o1", createdAt: DATE_STR }],
         },
      ];
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
