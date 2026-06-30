import type { SqlQueryPipelinePlugin, SqlPipelineEndArgs } from "./sql-query-pipeline-plugin.js";

export type AuditLogArgs<TContext extends Record<string, unknown> = Record<string, unknown>> =
   SqlPipelineEndArgs<TContext>;

export type AuditLogPluginOptions<TContext extends Record<string, unknown> = Record<string, unknown>> = {
   /**
    * Name identifying this plugin instance.
    * Defaults to `"AuditLogPlugin"`.
    */
   name?: string;

   /**
    * Opt-in projection of context into the audit log.
    * When set, `AuditLogArgs.context` contains the resolver's return value.
    * When absent, `context` is `null` and raw context is never logged.
    */
   contextLogResolver?(context: TContext): Record<string, unknown>;

   /** Called after every query execution with the trimmed audit log args. */
   onLog: (args: AuditLogArgs<TContext>) => void;
};

/**
 * Built-in audit log plugin. Attach via `pipeline.use(new AuditLogPlugin({ onLog: ... }))`.
 *
 * Fires in the `end()` phase — after every pipeline execution (success, failure, or rejection).
 * Trims context via `contextLogResolver` before passing to `onLog`. Raw context is never forwarded.
 */
export class AuditLogPlugin<
   TContext extends Record<string, unknown> = Record<string, unknown>,
> implements SqlQueryPipelinePlugin<TContext> {
   readonly name: string;

   constructor(public readonly options: AuditLogPluginOptions<TContext>) {
      this.name = options.name ?? "AuditLogPlugin";
   }

   end(args: SqlPipelineEndArgs<TContext>): void {
      const context = this.options.contextLogResolver?.(args.context) ?? null;
      const log = { ...args, context: context as TContext };
      this.options.onLog(log);
   }
}
