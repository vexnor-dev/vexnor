import { SqlQueryHandlerAny } from "#/core/query/sql-query-handler.js";
import { SqlQueryBaseAny } from "#/core/query/sql-query.js";
import { ParamsOf } from "#/core/sql-base.js";
import { ConnectionConfig, VexnorPluginAny } from "#/plugin/plugin.js";
import { ContextValue } from "#/core/query/context-value.js";

export interface VexnorConfig {
   profiles: Record<string, ProfileConfig>;
   defaultProfile?: string;
   exec?: ExecConfig;
}

export interface ProfileConfig {
   connection: ConnectionConfig;
   generate?: GenerateConfig;
}

export interface GenerateConfig {
   plugin?: string;
   schema: string[];
   outDir: string;
   pascalCaseTables?: boolean;
   camelCaseColumns?: boolean;
   schemas?: Record<string, unknown>;
}

export interface ExecConfig {
   format?: "table" | "json" | "csv";
   limit?: number;
   confirmMutations?: boolean;
   confirmDestructive?: boolean;
   dryRun?: boolean;
}

export interface QueryConfig<T extends Record<string, SqlQueryBaseAny>> {
   queries: {
      [K in keyof T as string]: QuerySettings<T[K]>;
   };
   defaults?: QueryDefaults;
}

export type QuerySettings<Query> = Query extends SqlQueryBaseAny
   ? {
        query: SqlQueryHandlerAny;
        profile: ProfileConfig | string;
        plugin: VexnorPluginAny;
        params: QuerySettingsParams<ParamsOf<Query>>;
        environments?: Record<string, ParamsOf<Query>>;
        format?: "table" | "json" | "csv";
        limit?: number;
     }
   : never;

export interface QueryDefaults {
   profile?: ProfileConfig | string;
   format?: "table" | "json" | "csv";
   limit?: number;
}

export type QuerySettingsParams<T> =
   T extends Record<string, unknown>
      ? {
           [K in keyof T]: T[K] | ContextValue;
        }
      : T;

//
// export type QuerySettingsParams<T extends SqlQueryAny> = T extends
//    | SqlQuery<{ Params: void }>
//    | SqlQueryHandler<{ Params: void; Read: object; Write: object; Connection: unknown }>
//    ? Record<string, never>
//    : T extends
//           | SqlQuery<infer Q extends { Params?: unknown }>
//           | SqlQueryHandler<infer R extends { Params: void; Read: object; Write: object; Connection: unknown }>
//      ? Q["Params"] | R["Params"] extends Record<string, unknown>
//         ? { [K in keyof (Q["Params"] | R["Params"])]: (Q["Params"] | R["Params"])[K] | ContextValue }
//         : Q["Params"] | R["Params"]
//      : Record<string, never>;
//
// export type HandlerSettingsParams<T extends SqlQueryHandlerAny> =
//    T extends SqlQueryHandler<{ Params: void; Read: object; Write: object; Connection: unknown }>
//       ? Record<string, "never-1">
//       : T extends SqlQueryHandler<infer R>
//         ? R["Params"] extends Record<string, unknown>
//            ? { [K in keyof R["Params"]]: R["Params"][K] | ContextValue }
//            : R["Params"]
//         : T;
