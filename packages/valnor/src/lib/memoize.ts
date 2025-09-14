// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunc = (...args: any[]) => any;

export function memoize<F extends AnyFunc>(fn: F): F {
   const cache = new Map<string, ReturnType<F>>();

   return function (...args: Parameters<F>): ReturnType<F> {
      const key = JSON.stringify(args);
      if (cache.has(key)) {
         return cache.get(key)!;
      }
      const result = fn(...args);
      cache.set(key, result);
      return result;
   } as F;
}
