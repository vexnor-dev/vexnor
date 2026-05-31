import "./register-open-telemetry.js";
import { Tracer } from "@opentelemetry/api";

// Augment for dist consumers (import from "vexnor/registry")
declare module "vexnor/registry" {
   // eslint-disable-next-line unused-imports/no-unused-vars
   interface QueryRegistry<TContext extends Record<string, unknown>> {
      registerOpenTelemetry(tracer: Tracer): void;
   }
}

// Augment for project reference consumers (tsc -b resolves to source path)
declare module "../registry/query-registry.js" {
   // eslint-disable-next-line unused-imports/no-unused-vars
   interface QueryRegistry<TContext extends Record<string, unknown>> {
      registerOpenTelemetry(tracer: Tracer): void;
   }
}
