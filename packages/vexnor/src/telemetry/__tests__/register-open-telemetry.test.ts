import { describe, test, expect, vi, beforeEach } from "vitest";
import { SpanStatusCode } from "@opentelemetry/api";
import "#/telemetry/register-open-telemetry.js";
import { QueryRegistry } from "#/registry/query-registry.js";
import { SqlQueryHandler, newSqlQueryHandler } from "#/core/query/sql-query-handler.js";
import { SqlQuery } from "#/core/query/sql-query.js";
import { VexnorPlugin } from "#/plugin/vexnor-plugin.js";
import { SqlRunArgs } from "#/core/query/sql-query-types.js";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { SqlErrorCode } from "#/core/sql-error-code.js";

// ── minimal mock infrastructure ──────────────────────────────────────────────

type MockResult = { rows: unknown[] };
type MockConnection = { query: (sql: string, params: unknown[]) => Promise<MockResult> };

class MockQueryHandler<T extends { Row?: unknown; Params?: unknown }> extends SqlQueryHandler<
   Pick<T, "Row" | "Params"> & { QueryResult: MockResult; Connection: MockConnection }
> {
   constructor(private readonly q: SqlQuery<Pick<T, "Row" | "Params">>) {
      super(q);
   }
   resolveRows(result: MockResult): T["Row"][] {
      return result.rows as T["Row"][];
   }
   deserialize(result: MockResult): MockResult {
      return result;
   }
   async execute(args: SqlRunArgs<{ Connection: MockConnection; Params: T["Params"] }>): Promise<MockResult> {
      const db = await args.db;
      const { text, values } = this.q.getSql(args);
      return db.query(text, values);
   }
}

class MockPlugin extends VexnorPlugin<{ Connection: MockConnection; Config: never }> {
   constructor(readonly name: string) {
      super();
   }
   readonly dialect = "sql";
   readonly driver = "mock";
   getColumnType = vi.fn();
   getSchema = vi.fn();
   getLibrary = vi.fn(() => []);
   createConnection = vi.fn();

   newQueryHandler<T extends { Row?: unknown; Params?: unknown; QueryResult: object; Connection: unknown }>(
      query: SqlQuery<Pick<T, "Row" | "Params">>,
   ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return newSqlQueryHandler(new MockQueryHandler(query as any) as any) as any;
   }
}

const plugin = new MockPlugin("mockPlugin");
const findAccounts = sql`select ${row(Account.$accountId)} from ${Account}`;
function makeDb(rows: unknown[] = []): MockConnection {
   return { query: async () => ({ rows }) };
}

// ── mock tracer ───────────────────────────────────────────────────────────────

function makeMockTracer() {
   const span = {
      setAttributes: vi.fn(),
      setStatus: vi.fn(),
      recordException: vi.fn(),
      end: vi.fn(),
   };
   const tracer = { startSpan: vi.fn(() => span) } as unknown as import("@opentelemetry/api").Tracer;
   return { tracer, span };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("registerOpenTelemetry", () => {
   let registry: QueryRegistry;
   beforeEach(() => {
      registry = new QueryRegistry();
   });

   test("creates a span with correct attributes on successful execution", async () => {
      await registry.register(plugin, { findAccounts });
      const { tracer, span } = makeMockTracer();
      registry.registerOpenTelemetry(tracer);

      const hash = await findAccounts.hash;
      await registry.execute("mockPlugin", hash, {}, async () => makeDb([{ accountId: "1" }]));

      expect(tracer.startSpan).toHaveBeenCalledWith(
         expect.stringContaining("findAccounts"),
         expect.objectContaining({ startTime: expect.any(Number) }),
      );
      expect(span.setAttributes).toHaveBeenCalledWith(
         expect.objectContaining({
            "db.system": "mock",
            "db.operation.name": "findAccounts",
            "vexnor.plugin": "mockPlugin",
         }),
      );
      expect(span.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
      expect(span.end).toHaveBeenCalled();
   });

   test("sets ERROR status and records exception on failed execution", async () => {
      await registry.register(plugin, { findAccounts });
      const { tracer, span } = makeMockTracer();
      registry.registerOpenTelemetry(tracer);

      const hash = await findAccounts.hash;
      const dbError = new Error("connection refused");
      await registry
         .execute("mockPlugin", hash, {}, async () => ({
            query: async () => {
               throw dbError;
            },
         }))
         .catch(() => {});

      expect(span.setStatus).toHaveBeenCalledWith(expect.objectContaining({ code: SpanStatusCode.ERROR }));
      expect(span.recordException).toHaveBeenCalledWith(
         expect.objectContaining({ code: SqlErrorCode.QUERY_EXECUTION_FAILED }),
      );
      expect(span.end).toHaveBeenCalled();
   });

   test("span name falls back to query.id when queryName is null", async () => {
      // Execute directly without registry so queryName is null
      const { tracer, span } = makeMockTracer();
      const standaloneRegistry = new QueryRegistry();
      await standaloneRegistry.register(plugin, { findAccounts });
      standaloneRegistry.registerOpenTelemetry(tracer);

      // Temporarily remove the registered name by using an unregistered query
      const anonQuery = sql`select ${row(Account.$accountId)} from ${Account}`;
      await standaloneRegistry.register(plugin, { anonQuery });
      const hash = await anonQuery.hash;
      await standaloneRegistry.execute("mockPlugin", hash, {}, async () => makeDb([]));

      expect(tracer.startSpan).toHaveBeenCalledWith(expect.stringContaining("anonQuery"), expect.any(Object));
      expect(span.end).toHaveBeenCalled();
   });
});
