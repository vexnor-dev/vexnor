/**
 * Resolves a dot-path against a params object.
 * "orderBy" → params.orderBy
 * "account.orderBy" → params.account.orderBy
 */
export function resolvePath(params: Record<string, unknown>, path: string): unknown {
   const segments = path.split(".");
   let current: unknown = params;
   for (const seg of segments) {
      if (current == null || typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[seg];
   }
   return current;
}
