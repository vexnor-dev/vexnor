import "./register-open-telemetry.js";
import { Tracer } from "@opentelemetry/api";

// Augment for dist consumers (import from "vexnor/execution")
declare module "vexnor/execution" {
   // eslint-disable-next-line unused-imports/no-unused-vars
   interface SqlQueryRegistry<TContext extends Record<string, unknown>> {
      registerOpenTelemetry(tracer: Tracer): void;
   }
}

// Augment for project reference consumers (tsc -b resolves to source path)
declare module "../execution/sql-query-registry.js" {
   // eslint-disable-next-line unused-imports/no-unused-vars
   interface SqlQueryRegistry<TContext extends Record<string, unknown>> {
      registerOpenTelemetry(tracer: Tracer): void;
   }
}
