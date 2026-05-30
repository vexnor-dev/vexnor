import { describe, expect, test, beforeEach } from "vitest";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { SqlQueryHandler, newSqlQueryHandler } from "#/core/query/sql-query-handler.js";
import { SqlQuery, SqlQueryExtended } from "#/core/query/sql-query.js";
import { SqlRunArgs, RemoteClient } from "#/core/query/sql-query-types.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { SqlSelectCharm } from "#/core/query/sql-charm.js";
import { resetIds } from "#/core/sql-base.js";

type MockResult = { rows: unknown[] };

class MockQueryHandler<T extends { Row?: unknown; Params?: unknown }> extends SqlQueryHandler<
   Pick<T, "Row" | "Params"> & { QueryResult: MockResult; Connection: RemoteClient }
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

   async execute(args: SqlRunArgs<{ Connection: RemoteClient; Params: T["Params"] }>): Promise<MockResult> {
      const db = await args.db;
      return db.remoteExecute<MockResult>({ plugin: "test", hash: "", params: {} });
   }
}

function mockHandler<T extends { Row?: unknown; Params?: unknown }>(query: SqlQueryExtended<T>) {
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   return newSqlQueryHandler(new MockQueryHandler<T>(query) as any);
}

const DATE_STR = "2001-05-30T10:40:50.867Z";

const remoteClient = <TRow>(rows: TRow[]): RemoteClient => ({
   remoteExecute<TResult>(): Promise<TResult> {
      return Promise.resolve({ rows }) as unknown as Promise<TResult>;
   },
});

beforeEach(() => resetIds());

describe("SqlQueryHandler all() — remote deserialization", () => {
   test("no schema — returns rows unchanged", async () => {
      const q = sql`select ${row(Account.$accountId, Account.$email)} from ${Account}`;
      const rows = [{ accountId: "1", email: "a@b.com" }];
      const result = await mockHandler(q).all({ db: remoteClient(rows) });
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
      const result = await mockHandler(q).all({ db: remoteClient(rows) });
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
      const rows = [
         {
            accountId: "1",
            createdAt: DATE_STR,
            orders: [{ orderId: "o1", createdAt: DATE_STR }],
         },
      ];
      const result = await mockHandler(q).all({ db: remoteClient(rows) });
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
      const rows = [
         {
            accountId: "1",
            createdAt: DATE_STR,
            lastOrder: { orderId: "o1", createdAt: DATE_STR },
         },
      ];
      const result = await mockHandler(q).all({ db: remoteClient(rows) });
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
      const result = await mockHandler(q).all({ db: remoteClient(rows) });
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

describe("SqlQueryHandler run() — remote deserialization", () => {
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
         createdAt: DATE_STR,
         orders: [{ orderId: "o1", createdAt: DATE_STR }],
      }];
      const result = await mockHandler(q).run({ db: remoteClient(rows) });
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

   test("top-level and nested Date fields — run() deserializes both", async () => {
      const q = sql`select ${row(Account.$accountId, Account.$createdAt)} from ${Account}`;
      const rows = [{ accountId: "1", createdAt: DATE_STR }];
      const result = await mockHandler(q).run({ db: remoteClient(rows) });
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
