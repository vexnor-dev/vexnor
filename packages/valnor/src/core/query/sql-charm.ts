import { PARAMS, ROW, Sql, SqlOptions, TYPE } from "../sql-base.js";
import { SqlBuildContext } from "./sql-build-context.js";
import { SqlBuildOptions } from "./sql-query-types.js";
import { BuildSqlParams } from "./sql-param.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlCharmAny = SqlCharm<any>;

export type ExtractCharmParams<T> =
   T extends SqlCharm<infer Options extends { Params: Record<string, unknown> }> ? Options["Params"] : "wtf";

export abstract class SqlCharm<T extends { Params?: unknown }> extends Sql {
   declare readonly [PARAMS]: T["Params"];

   readonly params: BuildSqlParams<T["Params"]>;

   protected constructor(options: SqlOptions & { params: BuildSqlParams<T["Params"]> }) {
      super(options);
      this.params = options.params;
   }
}

export type SqlSelectCharmArgs<T extends { Key: string; Type: unknown }> = {
   key: T["Key"];
   build: Sql["build"];
};

export class SqlSelectCharm<T extends { Key: string; Type: unknown }> extends Sql {
   declare readonly [ROW]: Record<T["Key"], T["Type"]>;
   declare readonly [TYPE]: Record<T["Key"], T["Type"]>;

   private readonly _build: Sql["build"];
   readonly key: T["Key"];

   constructor({ key, build }: SqlSelectCharmArgs<T>) {
      super({
         ID: `${key}`,
      });
      this._build = build;
      this.key = key;
   }

   build(context: SqlBuildContext, options?: SqlBuildOptions): void {
      this._build(context, options);
   }
}
