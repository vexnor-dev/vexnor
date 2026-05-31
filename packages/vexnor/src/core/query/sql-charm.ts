import { BuildSqlParams } from "#/core/query/sql-param.js";
import { PARAMS, ROW, Sql, SqlOptions, TYPE } from "#/core/sql-base.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { SqlBuildOptions } from "#/core/builder/sql-build-options.js";
import { SqlJsonSchema } from "#/core/utils/sql-json-schema.js";

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
   write: Sql["write"];
   params: BuildSqlParams<T["Params"]>;
   decode?: (row: Record<string, unknown>) => Record<string, unknown>;
   jsonSchema?: SqlJsonSchema;
};

export class SqlSelectCharm<T extends { Key: string; Type: unknown; Params?: unknown }> extends Sql {
   declare readonly [ROW]: Record<T["Key"], T["Type"]>;
   declare readonly [TYPE]: Record<T["Key"], T["Type"]>;
   declare readonly [PARAMS]: T["Params"];

   readonly key: T["Key"];
   readonly params: BuildSqlParams<T["Params"]>;
   private readonly _jsonSchema?: SqlJsonSchema;

   get jsonSchema(): SqlJsonSchema {
      return this._jsonSchema ?? {};
   }

   constructor({ key, write, jsonSchema, params }: SqlSelectCharmArgs<T>) {
      super({
         type: "SqlSelectCharm",
         id: `${key}`,
         hashId: `${key}:${JSON.stringify(jsonSchema ?? {})}|${Object.keys(params ?? {}).join(",")}`,
      });
      this.write = write;
      this.key = key;
      this._jsonSchema = jsonSchema;
      this.params = (params ?? null) as BuildSqlParams<T["Params"]>;
   }

   // eslint-disable-next-line unused-imports/no-unused-vars
   protected write<T>(_context: SqlBuildContext, _options?: SqlBuildOptions | null, _scope?: T | null): void {
      throw new Error("Method not implemented.");
   }
}
