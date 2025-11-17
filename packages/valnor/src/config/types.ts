import { ExtractParamsFromQuery, SqlQueryAny, AsyncQueryHandlerAny } from "../core/index.js";

type QueryOrHandler = SqlQueryAny | AsyncQueryHandlerAny;
import { ConnectionConfig } from "../plugin/index.js";

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

export type QuerySettings<Query extends QueryOrHandler> = {
   query: Query;
   plugin?: unknown;
   profile: ProfileConfig | string;
   params: ExtractParamsFromQuery<Query>;
   environments?: Record<string, Query extends { Params?: infer P } ? P : never>;
   format?: "table" | "json" | "csv";
   limit?: number;
};

export interface QueryDefaults {
   profile?: ProfileConfig | string;
   format?: "table" | "json" | "csv";
   limit?: number;
}
