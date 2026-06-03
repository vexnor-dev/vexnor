import { SpanStatusCode, type Tracer } from "@opentelemetry/api";
import { QueryRegistry } from "#/registry/query-registry.js";

QueryRegistry.prototype.registerOpenTelemetry = function (tracer: Tracer): void {
   this.use({
      name: "opentelemetry",
      after({ query, queryName, plugin, durationMs, error, location }) {
         const name = queryName ?? query.label ?? query.id;
         const span = tracer.startSpan(`db.query ${name}`, {
            startTime: Date.now() - durationMs,
         });

         span.setAttributes({
            "db.system": plugin.driver,
            "db.operation.name": name,
            "vexnor.query.id": query.id,
            "vexnor.query.location": location ? location.replace(process.cwd() + "/", "") : "",
            "vexnor.plugin": plugin.name,
         });

         if (error) {
            span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
            if (error instanceof Error) span.recordException(error);
         } else {
            span.setStatus({ code: SpanStatusCode.OK });
         }

         span.end(Date.now());
      },
   });
};
