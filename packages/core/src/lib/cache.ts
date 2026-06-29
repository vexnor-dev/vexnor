import { ok } from "#src/lib/assert.js";
import { resetIds, Sql } from "#src/core/sql-base.js";

export class Cache {
   private map = new Map<string, Sql>();

   get<Value extends Sql>(keys: string[], callback: () => Value): Value {
      ok(keys?.length, `Cache keys are required.`);
      const key = keys.join("\0");
      if (this.map.has(key)) return this.map.get(key)! as Value;
      const value = callback();
      this.map.set(key, value);
      return value;
   }

   reset() {
      this.map.clear();
   }
}

export const CACHE = new Cache();

export function resetCache() {
   CACHE.reset();
}

const resetHooks: (() => void)[] = [];

export function registerResetHook(fn: () => void) {
   resetHooks.push(fn);
}

export function resetAll() {
   resetIds();
   resetCache();
   resetHooks.forEach((fn) => fn());
}
