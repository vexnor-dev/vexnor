import { QuerySettings, QueryDefaults } from "./config-types.js";
import { SqlQueryAny, AsyncQueryHandlerAny, SqlQuery, AsyncQueryHandler } from "../core/index.js";
import { SqlExecError } from "../cli/exec/sql-exec-error.js";

type QueryOrHandler = SqlQueryAny | AsyncQueryHandlerAny;

export function defineQueryConfig<TQueries extends Record<string, QueryOrHandler>>(queries: TQueries) {
   return <
      TConfig extends {
         queries: { [K in keyof TQueries]: Omit<QuerySettings<TQueries[K]>, "query"> };
         defaults?: QueryDefaults;
      },
   >(
      config: TConfig,
   ): { queries: { [K in keyof TQueries]: QuerySettings<TQueries[K]> }; defaults?: QueryDefaults } => {
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
         const query = queries[key]!;
         const settings = config.queries[key]!;
         if (!settings.profile) {
            throw new Error(`Query '${key}' missing profile`);
         }

         if (!settings.params) {
            throw new Error(`Query '${key}' missing params`);
         }

         const params = (() => {
            if (query instanceof SqlQuery) {
               return query.params ?? {};
            }

            if (query instanceof AsyncQueryHandler) {
               return query.query.params ?? {};
            }

            throw new SqlExecError(`Query '${key}' is not a SqlQuery or AsyncQueryHandler`);
         })();
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
