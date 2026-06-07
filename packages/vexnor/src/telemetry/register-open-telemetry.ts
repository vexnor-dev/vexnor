import { SpanStatusCode, type Tracer } from "@opentelemetry/api";
import { SqlQueryRegistry } from "#/execution/sql-query-registry.js";
import { SqlRunError } from "#/core/sql-run-error.js";

SqlQueryRegistry.prototype.registerOpenTelemetry = function (tracer: Tracer): void {
   this.use({
      name: "opentelemetry",
      after({ query, name, input, plugin, durationMs, error }) {
         const span = tracer.startSpan(`db.query ${name}`, {
            startTime: Date.now() - durationMs,
         });

         span.setAttributes({
            "db.system": plugin.driver,
            "db.operation.name": name ?? query.label ?? query.id,
            "vexnor.query.id": query.id,
            "vexnor.query.location": query?.location ? query.location.replace(process.cwd() + "/", "") : "",
            "vexnor.plugin": plugin.name,
            "vexnor.input.plugin": input.plugin,
            "vexnor.input.hash": input.hash,
            "vexnor.input.location": input.location ?? "",
            "vexnor.input.mode": input.mode,
         });

         switch (true) {
            case error instanceof SqlRunError:
               span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
               span.recordException(error);
               span.setAttributes({
                  "vexnor.error.code": error.code,
                  "vexnor.error.name": error.name,
                  "vexnor.query.sql": error.sql ?? "",
               });
               break;
            case error instanceof Error:
               span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
               span.recordException(error);
               break;
            default:
               span.setStatus({ code: SpanStatusCode.OK });
         }

         span.end(Date.now());
      },
   });
};
