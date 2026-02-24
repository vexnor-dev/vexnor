import { PARAMS, ROW, Sql, SqlOptions, TYPE } from "../sql-base.js";
import { SqlBuildContext } from "./sql-build-context.js";
import { hasParams, SqlBuildOptions } from "./sql-query-types.js";
import { BuildSqlParams } from "./sql-param.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlCharmAny = SqlCharm<any>;

export type ExtractCharmParams<T> =
   T extends SqlCharm<infer Options extends { Params: Record<string, unknown>; Type?: unknown }>
      ? Options["Params"]
      : void;

export abstract class SqlCharm<T extends { Params?: unknown; Type?: unknown }> extends Sql {
   declare readonly [PARAMS]: T["Params"];
   declare readonly [TYPE]: T["Type"];

   readonly params: BuildSqlParams<T["Params"]>;

   protected constructor(options: SqlOptions & { params: BuildSqlParams<T["Params"]> }) {
      super(options);
      this.params = options.params;
   }
}

export type SqlSelectCharmArgs<T extends { Key: string; Type: unknown; Params?: unknown }> = {
   key: T["Key"];
   build: Sql["build"];
   params: BuildSqlParams<T["Params"]>;
};

export class SqlSelectCharm<T extends { Key: string; Type: unknown; Params?: unknown }> extends Sql {
   declare readonly [ROW]: Record<T["Key"], T["Type"]>;
   declare readonly [TYPE]: Record<T["Key"], T["Type"]>;
   declare readonly [PARAMS]: T["Params"];

   private readonly _build: Sql["build"];
   readonly key: T["Key"];
   readonly params: BuildSqlParams<T["Params"]>;

   constructor({ key, build, ...args }: SqlSelectCharmArgs<T>) {
      super({
         id: `${key}`,
      });
      this._build = build;
      this.key = key;
      this.params = (hasParams(args) ? args.params : null) as BuildSqlParams<T["Params"]>;
   }

   build(context: SqlBuildContext, options?: SqlBuildOptions): void {
      this._build(context, options);
   }
}
