import { AsyncQueryHandlerAny, ExtractParamsFromQuery, SqlQueryAny } from "../core/index.js";
import { ConnectionConfig, ValnorPlugin } from "../plugin/index.js";

export type QueryOrHandler = SqlQueryAny | AsyncQueryHandlerAny;

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
        query: SqlQueryAny;
        profile: ProfileConfig | string;
        plugin: ValnorPlugin;
        params?: ExtractParamsFromQuery<Query>;
        environments?: Record<string, ExtractParamsFromQuery<Query>>;
        format?: "table" | "json" | "csv";
        limit?: number;
     }
   : Query extends AsyncQueryHandlerAny
     ? {
          query: AsyncQueryHandlerAny;
          profile: ProfileConfig | string;
          plugin: ValnorPlugin;
          params?: ExtractParamsFromQuery<Query>;
          environments?: Record<string, ExtractParamsFromQuery<Query>>;
          format?: "table" | "json" | "csv";
          limit?: number;
       }
     : never;

export interface QueryDefaults {
   profile?: ProfileConfig | string;
   format?: "table" | "json" | "csv";
   limit?: number;
}
