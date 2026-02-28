import { PARAMS, Sql } from "../sql-base.js";
import { SqlBuildContext } from "./sql-build-context.js";
import { SqlBuildOptions } from "./sql-query-types.js";
import { indexedArray } from "../../lib/index.js";
import { ok } from "assert";

export type SqlExpandAny = SqlExpand<{ Params: unknown }>;

export class SqlExpand<T extends { Params: unknown }> extends Sql {
   declare readonly [PARAMS]: T["Params"];

   constructor(public readonly expand: SqlExpandHandler<T>) {
      super({
         id: ``,
      });

      this.expand = expand;
   }

   build(context: SqlBuildContext, options?: SqlBuildOptions): void {
      switch (context.params) {
         case undefined:
            context.addExpand(this);
            break;
         default: {
            ok(context.params, `'context.params' is required to expand ${this.id}.`);
            const token = this.expand(<T["Params"]>context.params);
            switch (true) {
               case Array.isArray(token): {
                  for (const { index, item: q } of indexedArray(token)) {
                     if (index > 0) context.addStrings(", ");
                     q.build(context, options);
                  }

                  break;
               }
               default:
                  token.build(context, options);
                  break;
            }
         }
      }
   }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlExpandHandlerAny = SqlExpandHandler<any>;

export type SqlExpandHandler<T extends { Params: unknown }> = (params: T["Params"]) => Array<Sql> | Sql;

/**
 *
 * @param handler
 */
export function expand<Params extends unknown[] | Record<string, unknown>>(
   handler: SqlExpandHandler<{ Params: Params }>,
): SqlExpand<{ Params: Params }> {
   return new SqlExpand(handler);
}
