import "./register-open-telemetry.js";
import { Tracer } from "@opentelemetry/api";

declare module "vexnor/registry" {
   // eslint-disable-next-line unused-imports/no-unused-vars
   interface QueryRegistry<TContext extends Record<string, unknown>> {
      /**
       * Wires this registry to OpenTelemetry.
       *
       * Each query execution produces one span with standard `db.*` semantic
       * convention attributes plus vexnor-specific attributes.
       *
       * Import `vexnor/open-telemetry` once at your entry point to enable this method.
       * Requires `@opentelemetry/api` as a peer dependency.
       *
       * @example
       * ```TypeScript
       * import "vexnor/open-telemetry";
       * import { trace } from "@opentelemetry/api";
       *
       * registry.registerOpenTelemetry(trace.getTracer("my-app"));
       * ```
       */
      registerOpenTelemetry(tracer: Tracer): void;
   }
}
