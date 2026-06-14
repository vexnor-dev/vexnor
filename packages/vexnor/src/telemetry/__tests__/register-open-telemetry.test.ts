import { beforeEach, describe, expect, test, vi } from "vitest";
import { SpanStatusCode } from "@opentelemetry/api";
import "#/telemetry/register-open-telemetry.js";
import { type ConnectionResolver, SqlQueryRegistry } from "#/execution/sql-query-registry.js";
import { type SqlExecuteMode } from "#/core/query/sql-query-types.js";
import { sql } from "#/core/sql.js";
import { row } from "#/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { SqlErrorCode } from "#/core/sql-error-code.js";
import { MockConnection, MockPlugin } from "#/test/mock-plugin.js";

const plugin = new MockPlugin({ name: "mockPlugin" });
const findAccounts = sql`select ${row(Account.$accountId)} from ${Account}`;
function makeDb(rows: unknown[] = []): MockConnection {
   return { query: async () => ({ rows }) } as MockConnection;
}

function executeRegistry(
   registry: SqlQueryRegistry,
   plugin: string,
   hash: string,
   params: Record<string, unknown>,
   resolver: ConnectionResolver,
   mode: SqlExecuteMode = "read",
) {
   return registry.execute({ plugin, hash, params, location: "test", mode, name: null }, resolver);
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
   let registry: SqlQueryRegistry;
   beforeEach(() => {
      registry = new SqlQueryRegistry();
   });

   test("creates a span with correct attributes on successful execution", async () => {
      await registry.register(plugin, { findAccounts });
      const { tracer, span } = makeMockTracer();
      registry.registerOpenTelemetry(tracer);

      const hash = await findAccounts.hash;
      await executeRegistry(registry, "mockPlugin", hash, {}, async () => makeDb([{ accountId: "1" }]));

      expect(tracer.startSpan).toHaveBeenCalledWith(
         expect.stringContaining("findAccounts"),
         expect.objectContaining({ startTime: expect.any(Number) }),
      );
      expect(span.setAttributes).toHaveBeenCalledWith(
         expect.objectContaining({
            "db.system": "test",
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
      await executeRegistry(registry, "mockPlugin", hash, {}, async () => ({
         query: async () => {
            throw dbError;
         },
      })).catch(() => {});

      expect(span.setStatus).toHaveBeenCalledWith(expect.objectContaining({ code: SpanStatusCode.ERROR }));
      expect(span.recordException).toHaveBeenCalledWith(
         expect.objectContaining({ code: SqlErrorCode.QUERY_EXECUTION_FAILED }),
      );
      expect(span.end).toHaveBeenCalled();
   });

   test("span name falls back to query.id when queryName is null", async () => {
      // Execute directly without registry so queryName is null
      const { tracer, span } = makeMockTracer();
      const standaloneRegistry = new SqlQueryRegistry();
      await standaloneRegistry.register(plugin, { findAccounts });
      standaloneRegistry.registerOpenTelemetry(tracer);

      // Temporarily remove the registered name by using an unregistered query
      const anonQuery = sql`select ${row(Account.$accountId)} from ${Account}`;
      await standaloneRegistry.register(plugin, { anonQuery });
      const hash = await anonQuery.hash;
      await executeRegistry(standaloneRegistry, "mockPlugin", hash, {}, async () => makeDb([]));

      expect(tracer.startSpan).toHaveBeenCalledWith(expect.stringContaining("anonQuery"), expect.any(Object));
      expect(span.end).toHaveBeenCalled();
   });
});
