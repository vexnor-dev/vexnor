import type { SqlQueryExecutionPlugin, AfterArgs } from "./sql-query-execution-plugin.js";

export type AuditLogArgs<TContext extends Record<string, unknown> = Record<string, unknown>> = AfterArgs<TContext>;

export type AuditLogPluginOptions<TContext extends Record<string, unknown> = Record<string, unknown>> = {
   /**
    * Name identifying this plugin instance.
    * Defaults to `"AuditLogPlugin"`.
    */
   name?: string;

   /**
    * Opt-in projection of context into the audit log.
    * When set, `AuditLogArgs.contextLog` contains the resolver's return value.
    * When absent, `contextLog` is `null` and raw context is never logged.
    */
   contextLogResolver?(context: TContext): Record<string, unknown>;

   /** Called after every query execution with the trimmed audit log args. */
   onLog: (args: AuditLogArgs<TContext>) => void;
};

/**
 * Built-in audit log plugin. Attach via `registry.use(new AuditLogPlugin({ onLog: ... }))`.
 *
 * Receives full execution context after every query — success or failure — and trims it
 * via `contextLogResolver` before passing it to `onLog`. Raw context is never forwarded.
 */
export class AuditLogPlugin<
   TContext extends Record<string, unknown> = Record<string, unknown>,
> implements SqlQueryExecutionPlugin<TContext> {
   readonly name: string;

   constructor(public readonly options: AuditLogPluginOptions<TContext>) {
      this.name = options.name ?? "AuditLogPlugin";
   }

   after(args: AfterArgs<TContext>): void {
      const context = this.options.contextLogResolver?.(args.context) ?? null;
      const log = { ...args, context: context as TContext };
      this.options.onLog(log);
   }
}
