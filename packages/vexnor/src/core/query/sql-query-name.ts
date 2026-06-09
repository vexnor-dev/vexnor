import { isQuery, SqlQueryBaseAny, toQuery } from "#/core/query/sql-query.js";

const cache = new Map<string, Promise<Map<string, string>>>();

function loadNames(url: string): Promise<Map<string, string>> {
   if (!cache.has(url)) {
      cache.set(
         url,
         import(/* @vite-ignore */ /* webpackIgnore: true */ url)
            .then((module) => {
               const names = new Map<string, string>();
               for (const [name, value] of Object.entries(module)) {
                  if (isQuery(value)) names.set(value.source.id, name);
               }
               return names;
            })
            .catch(() => new Map()),
      );
   }
   return cache.get(url)!;
}

export async function getQueryName(value: SqlQueryBaseAny): Promise<string | null> {
   const query = toQuery(value);

   if (!query) return null;
   if (!query.locationUrl) return null;
   const names = await loadNames(query.locationUrl);
   return names.get(query.id) ?? null;
}
