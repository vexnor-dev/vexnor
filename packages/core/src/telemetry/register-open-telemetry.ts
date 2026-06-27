import { SpanStatusCode, type Tracer } from "@opentelemetry/api";
import { SqlQueryRegistry } from "#src/execution/sql-query-registry.js";
import { SqlRunError } from "#src/core/sql-run-error.js";

SqlQueryRegistry.prototype.registerOpenTelemetry = function (tracer: Tracer): void {
   this.use({
      name: "opentelemetry",
      end({ query, plugin, remote, name, durationMs, error, mode }) {
         const span = tracer.startSpan(`db.query ${name}`, {
            startTime: Date.now() - durationMs,
         });

         span.setAttributes({
            "db.system": plugin.driver,
            "db.operation.name": name,
            "db.operation.mode": mode,
            "vexnor.query.id": query.id,
            "vexnor.query.name": name,
            "vexnor.query.location": query?.location ?? "-",
            "vexnor.plugin": plugin.name,
         });

         if (remote) {
            span.setAttributes({
               "vexnor.remote.plugin": remote.plugin,
               "vexnor.remote.hash": remote.hash,
               "vexnor.remote.location": remote.location ?? "-",
               "vexnor.remote.mode": remote.mode,
            });
         }

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
