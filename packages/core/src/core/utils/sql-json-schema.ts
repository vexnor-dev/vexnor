export type SqlJsonType = "Date";

export interface SqlJsonSchema {
   [key: string]: SqlJsonType | SqlJsonSchema | [SqlJsonSchema];
}

type StackFrame = {
   obj: Record<string, unknown>;
   schema: SqlJsonSchema;
};

/**
 * Deserializes a query result row (or array of rows) using a `SqlJsonSchema`,
 * converting typed fields (e.g. `"Date"`) back to their runtime values.
 *
 * Uses an iterative DFS to avoid stack overflow on deeply nested structures.
 */
export function deserialize<T>(data: T, schema: SqlJsonSchema): T {
   if (!data || typeof data !== "object") return data;

   if (Array.isArray(data)) {
      return data.map((item) => deserialize(item, schema)) as T;
   }

   const root = structuredClone(data) as Record<string, unknown>;
   const stack: StackFrame[] = [{ obj: root, schema }];

   while (stack.length) {
      const { obj, schema: currentSchema } = stack.pop()!;

      for (const key of Object.keys(obj)) {
         const rule = currentSchema[key];
         if (!rule) continue;

         const value = obj[key];

         if (rule === "Date") {
            if (value != null && !(value instanceof Date)) {
               obj[key] = new Date(value as string);
            }
            continue;
         }

         if (Array.isArray(rule)) {
            const parsed = typeof value === "string" ? JSON.parse(value) : value;
            if (Array.isArray(parsed)) {
               obj[key] = parsed;
               for (const item of parsed) {
                  if (item && typeof item === "object" && !Array.isArray(item)) {
                     stack.push({ obj: item as Record<string, unknown>, schema: rule[0]! });
                  }
               }
            }
            continue;
         }

         if (typeof value === "string") {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
               obj[key] = parsed;
               stack.push({ obj: parsed as Record<string, unknown>, schema: rule });
            }
            continue;
         }

         if (value && typeof value === "object" && !Array.isArray(value)) {
            stack.push({ obj: value as Record<string, unknown>, schema: rule });
         }
      }
   }

   return root as T;
}
