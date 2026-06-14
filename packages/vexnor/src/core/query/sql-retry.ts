import { SqlRunError } from "#/core/sql-run-error.js";
import type { SqlRetryOptions, SqlRetryArgs } from "#/core/query/sql-query-types.js";

export async function runWithRetry<TResult, TExecution = unknown>(
   retry: SqlRetryOptions<TExecution> | false | undefined,
   execution: TExecution | undefined,
   fn: (attempt: number) => Promise<TResult>,
): Promise<TResult> {
   const maxAttempts = retry ? Math.max(1, Math.trunc(retry.maxAttempts ?? 1)) : 1;

   for (let attempt = 1; ; attempt++) {
      try {
         return await fn(attempt);
      } catch (error) {
         if (!retry || attempt >= maxAttempts) throw error;

         const retryArgs: SqlRetryArgs<TExecution> = { error, attempt, maxAttempts, execution };
         const shouldRetry = retry.shouldRetry
            ? await retry.shouldRetry(retryArgs)
            : error instanceof SqlRunError && error.retryable;
         if (!shouldRetry) throw error;

         const delayMs = typeof retry.delayMs === "function" ? await retry.delayMs(retryArgs) : retry.delayMs ?? 0;
         if (delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
         }
      }
   }
}
