# Telemetry

`vexnor/telemetry` integrates `QueryRegistry` with OpenTelemetry, creating a span for every query execution — success or failure.

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
import { QueryRegistry } from 'vexnor/registry';

const tracer = trace.getTracer('my-service');
const registry = new QueryRegistry();

await registry.register(vexnorPostgres, queries);

registry.registerOpenTelemetry(tracer);
```

If you use `tsx` or a similar loader, pass the telemetry file via `--import` to guarantee it runs first:

```bash
node --import tsx/esm --import ./telemetry.ts ./server.ts
```

## Span Shape

Each query execution produces one span:

| Field | Value |
|-------|-------|
| `name` | `db.query <queryName>` |
| `db.system` | Driver name (e.g. `postgres`, `mssql`, `sqlite3`) |
| `db.operation.name` | Query name as registered |
| `vexnor.query.id` | Internal query instance id |
| `vexnor.query.location` | Source file and line where the query was defined (relative to cwd) |
| `vexnor.plugin` | Plugin name (e.g. `vexnor-postgres`) |
| `status` | `OK` on success, `ERROR` on failure |

On failure, the span status is set to `ERROR` with the error message, and `span.recordException(error)` is called.

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

## Combining with Audit Logging

`registerOpenTelemetry` is built on top of `registerAuditLog` — it registers an audit log listener internally. You can register additional listeners alongside it:

```typescript
registry.registerOpenTelemetry(tracer);

// Also log to pino for structured text output
registry.registerAuditLog((event) => {
  const { queryName, plugin, durationMs, error } = event.args;
  if (error) {
    log.error({ queryName, plugin: plugin.name, durationMs, err: error }, 'query failed');
  } else {
    log.info({ queryName, plugin: plugin.name, durationMs }, 'query executed');
  }
});
```

Both listeners receive every event independently.

## Notes

- `vexnor/telemetry` is a Node-only subpath export. Do not import it in browser bundles.
- `@opentelemetry/api` is an optional peer dependency — vexnor will not fail to load if it is not installed.
- `vexnor.query.location` strips the process working directory prefix so paths are relative and portable across environments.
