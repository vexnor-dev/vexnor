import { SqlQueryHandlerAny } from "#/core/query/sql-query-handler.js";
import { SqlQueryAny, SqlQuery } from "#/core/query/sql-query.js";
import { ParamsOf } from "#/core/sql-base.js";
import { ConnectionConfig, ValnorPluginAny } from "#/plugin/plugin.js";

export type QueryOrHandler = SqlQueryAny | SqlQueryHandlerAny;

export interface ValnorConfig {
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
}

export interface ExecConfig {
   format?: "table" | "json" | "csv";
   limit?: number;
   confirmMutations?: boolean;
   confirmDestructive?: boolean;
   dryRun?: boolean;
}

export interface QueryConfig<T extends Record<string, QueryOrHandler>> {
   queries: {
      [K in keyof T as string]: QuerySettings<T[K]>;
   };
   defaults?: QueryDefaults;
}

export type QuerySettings<Query> = Query extends SqlQueryAny
   ? {
        query: SqlQueryHandlerAny;
        profile: ProfileConfig | string;
        plugin: ValnorPluginAny;
        params: QuerySettingsParams<Query>;
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

export type QuerySettingsParams<T extends SqlQueryAny> =
   T extends SqlQuery<{ Params: void }>
      ? Record<string, never>
      : T extends SqlQuery<infer Q extends { Params?: unknown }>
        ? Q["Params"]
        : Record<string, never>;
