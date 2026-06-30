declare const CONTEXT_VALUE_SYMBOL: unique symbol;

/**
 * A branded sentinel type assignable to any param type.
 * Used to mark a runtime param value that will be injected server-side
 * by the QueryRegistry from the trusted context object.
 *
 * The remote client strips any param set to `runtimeValue` before sending
 * the request — it will never reach the server as a caller-supplied value.
 */
export type ContextValue = { readonly [CONTEXT_VALUE_SYMBOL]: true };

/**
 * Sentinel value for runtime-injected params.
 *
 * Use this when calling a query that uses `ctx()` params from the client.
 * The value satisfies the TypeScript type requirement but is stripped by the
 * remote client before the request is sent — the real value is injected
 * server-side from the registry context.
 *
 * On direct server-side execution without the registry, passing `runtimeValue`
 * will produce `null` — always use the real value for direct execution.
 *
 * @example
 * // Client — runtimeValue is stripped before sending, userId injected server-side
 * await myOrders.postgres.all({
 *   db: remoteClient,
 *   params: { userId: runtimeValue },
 * });
 *
 * // Server direct execution — pass the real value
 * await myOrders.postgres.all({
 *   db: pool,
 *   params: { userId: session.userId },
 * });
 */
export const contextValue: ContextValue = Symbol("runtimeValue") as unknown as ContextValue;

export function isContextValue(value: unknown): boolean {
   return value === contextValue;
}
