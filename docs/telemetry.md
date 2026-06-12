# Telemetry

`vexnor/telemetry` integrates `SqlQueryRegistry` with OpenTelemetry, creating a span for every query execution — success or failure.

## Setup

Install the OpenTelemetry SDK alongside vexnor:

```bash
npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/sdk-trace-node
```

Initialize the SDK **before** your server starts. OpenTelemetry must be bootstrapped before any instrumented code runs:

```typescript
// telemetry.ts — import this first, before server.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';

const sdk = new NodeSDK({
  serviceName: 'my-service',
  traceExporter: new ConsoleSpanExporter(), // swap for OtlpTraceExporter in production
});

sdk.start();

process.on('SIGTERM', () => sdk.shutdown());
process.on('SIGINT', () => sdk.shutdown());
```

Then in your server entry point:

```typescript
import 'vexnor/telemetry';
import { trace } from '@opentelemetry/api';
import { SqlQueryRegistry } from 'vexnor/execution';

const tracer = trace.getTracer('my-service');
const registry = new SqlQueryRegistry();

await registry.register(vexnorPostgres, queries);

registry.registerOpenTelemetry(tracer);
```

If you use `tsx` or a similar loader, pass the telemetry file via `--import` to guarantee it runs first:

```bash
node --import tsx/esm --import ./telemetry.ts ./server.ts
```

---

## Span Shape

Each query execution produces one span:

| Attribute | Value |
|-----------|-------|
| `name` | `db.query <queryName>` |
| `db.system` | Driver name (e.g. `postgres`, `mssql`, `sqlite3`) |
| `db.operation.name` | Query name as registered |
| `db.operation.mode` | Execution mode (`read` or `write`) |
| `vexnor.query.id` | Internal query instance ID |
| `vexnor.query.name` | Query name |
| `vexnor.query.location` | Source file and line where the query was defined (relative to cwd) |
| `vexnor.plugin` | Plugin name (e.g. `vexnor-postgres`) |

### Remote Execution Attributes

When the query originates from a remote client (browser, cross-service), these additional attributes are set:

| Attribute | Value |
|-----------|-------|
| `vexnor.remote.plugin` | Plugin name from the remote request |
| `vexnor.remote.hash` | Query hash from the remote request |
| `vexnor.remote.location` | Source location from the remote request |
| `vexnor.remote.mode` | Execution mode from the remote request |

### Error Attributes

On failure, the span status is set to `ERROR` with the error message, and `span.recordException(error)` is called:

| Attribute | Value |
|-----------|-------|
| `vexnor.error.code` | The `SqlErrorCode` (e.g. `QUERY_EXECUTION_FAILED`) |
| `vexnor.error.name` | Error name |
| `vexnor.query.sql` | The SQL text that failed (if available) |

### Error Codes

Common error codes that appear in spans:

| Code | Meaning |
|------|---------|
| `QUERY_EXECUTION_FAILED` | Driver error, connection failure |
| `QUERY_NOT_AUTHORIZED` | Authorization hook denied execution |
| `QUERY_RATE_LIMITED` | Concurrency or rate limit exceeded |
| `QUERY_TIMEOUT` | Query exceeded configured timeout |
| `QUERY_NOT_FOUND` | Hash not registered in the registry |
| `QUERY_RETRYABLE_FAILURE` | Transient error, may be retried |

---

## Sending to a Collector

Swap `ConsoleSpanExporter` for an OTLP exporter to send traces to Jaeger, Honeycomb, Datadog, or any OpenTelemetry-compatible backend:

```typescript
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const sdk = new NodeSDK({
  serviceName: 'my-service',
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/traces',
  }),
});
```

### gRPC Exporter

```typescript
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';

const sdk = new NodeSDK({
  serviceName: 'my-service',
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4317',
  }),
});
```

---

## Combining with Audit Logging

`registerOpenTelemetry` is built on the `use()` plugin system. You can attach additional `AuditLogPlugin` instances alongside it:

```typescript
import { AuditLogPlugin } from 'vexnor/execution';

registry.registerOpenTelemetry(tracer);

// Also log to pino for structured text output
registry.use(new AuditLogPlugin({
  onLog: ({ name, plugin, durationMs, error }) => {
    if (error) {
      log.error({ name, plugin: plugin.name, durationMs, err: error }, 'query failed');
    } else {
      log.info({ name, plugin: plugin.name, durationMs }, 'query executed');
    }
  },
}));
```

Both receive every event independently — telemetry spans and audit logs are complementary, not exclusive.

---

## Implementation

`registerOpenTelemetry` adds a pipeline plugin via `registry.use()`. The plugin implements `after()` — it receives the query execution result (including timing and errors) and creates a completed span covering the execution duration.

The plugin is implemented in `vexnor/telemetry` and extends `SqlQueryRegistry.prototype` with the `registerOpenTelemetry` method when imported.

---

## Notes

- `vexnor/telemetry` is a Node-only subpath export. Do not import it in browser bundles.
- `@opentelemetry/api` is an optional peer dependency — vexnor will not fail to load if it is not installed.
- `vexnor.query.location` strips the process working directory prefix so paths are relative and portable across environments.
- Spans capture timing from before authorization through completion — the `durationMs` includes auth, check plugins, and query execution.
- Authorization denials and rate limit rejections still produce spans with `ERROR` status.
