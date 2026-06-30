/**
 * Deep merges multiple objects. Later values override earlier ones.
 * - Arrays are replaced, not concatenated.
 * - Plain objects are merged iteratively (stack-based DFS).
 * - Primitives, Dates, RegExps, and class instances are replaced.
 * - undefined values in source skip the key (don't delete from target).
 * - null explicitly sets the value to null.
 *
 * Uses iterative DFS (stack-based) to avoid call stack overflow on deep structures.
 */
export function deepMerge<T extends Record<string, unknown> = Record<string, unknown>>(
   ...sources: Record<string, unknown>[]
): T {
   const result: Record<string, unknown> = {};

   for (const source of sources) {
      if (!source) continue;
      mergeInto(result, source as Record<string, unknown>);
   }

   return result as T;
}

function mergeInto(target: Record<string, unknown>, source: Record<string, unknown>): void {
   const stack: Array<{ target: Record<string, unknown>; source: Record<string, unknown> }> = [
      { target, source },
   ];

   while (stack.length) {
      const frame = stack.pop()!;

      for (const key of Object.keys(frame.source)) {
         if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
         const srcVal = frame.source[key];
         if (srcVal === undefined) continue;

         const tgtVal = frame.target[key];

         if (isPlainObject(srcVal) && isPlainObject(tgtVal)) {
            stack.push({ target: tgtVal, source: srcVal });
         } else if (isPlainObject(srcVal)) {
            const newObj: Record<string, unknown> = {};
            frame.target[key] = newObj;
            stack.push({ target: newObj, source: srcVal });
         } else {
            frame.target[key] = srcVal;
         }
      }
   }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
   if (value === null || typeof value !== "object") return false;
   const proto = Object.getPrototypeOf(value);
   return proto === Object.prototype || proto === null;
}
