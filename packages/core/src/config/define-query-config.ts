import { QuerySettings, QueryDefaults } from "#src/config/config-types.js";
import { SqlQueryBaseAny } from "#src/core/query/sql-query.js";

export type QueryConfigResult<TQueries extends Record<string, SqlQueryBaseAny>> = <
   TConfig extends {
      queries: { [K in keyof TQueries]: Omit<QuerySettings<TQueries[K]>, "query"> };
      defaults?: QueryDefaults;
   },
>(
   config: TConfig,
) => { queries: { [K in keyof TQueries]: QuerySettings<TQueries[K]> }; defaults?: QueryDefaults };

export function defineQueryConfig<TQueries extends Record<string, SqlQueryBaseAny>>(
   queries: TQueries,
): QueryConfigResult<TQueries> {
   return (config) => {
      if (!config.queries || Object.keys(config.queries).length === 0) {
         throw new Error("Query config must have at least one query");
      }

      const queriesKeys = Object.keys(queries).sort();
      const configKeys = Object.keys(config.queries).sort();

      if (queriesKeys.join(",") !== configKeys.join(",")) {
         throw new Error(
            `Config queries mismatch. Expected: [${queriesKeys.join(", ")}], got: [${configKeys.join(", ")}]`,
         );
      }

      let result: Partial<{ [K in keyof TQueries]: QuerySettings<TQueries[K]> }> = {};

      for (const key of Object.keys(config.queries)) {
         const item = queries[key]!;
         const query = item.source;
         const settings = config.queries[key]!;
         if (!settings.profile) {
            throw new Error(`Query '${key}' missing profile`);
         }

         if (query.params && Object.keys(query.params).length && !settings.params) {
            throw new Error(`Query '${key}' missing params`);
         }

         const params = query.params ?? {};
         const queryParamKeys = Object.keys(params).sort();
         const configParamKeys = settings.params ? Object.keys(settings.params).sort() : [];

         if (queryParamKeys.join(",") !== configParamKeys.join(",")) {
            throw new Error(
               `Query '${key}' params mismatch. Expected: [${queryParamKeys.join(", ")}], got: [${configParamKeys.join(", ")}]`,
            );
         }

         result = {
            ...result,
            [key]: {
               ...settings,
               query: queries[key],
            },
         };
      }

      return {
         queries: result as { [K in keyof TQueries]: QuerySettings<TQueries[K]> },
         defaults: config.defaults,
      };
   };
}
