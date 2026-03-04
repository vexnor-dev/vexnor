import { ARGS, PARAMS, Sql } from "../sql-base.js";
import { SqlBuildContext } from "./sql-build-context.js";
import { SqlBuildOptions } from "./sql-query-types.js";
import { indexedArray } from "../../lib/index.js";
import { SqlQuery } from "./sql-query.js";

export type SqlExpandAny = SqlExpand<{ Params: unknown }>;

export class SqlExpand<T extends { Params: unknown }> extends Sql {
   declare readonly [PARAMS]: T["Params"];
   declare readonly [ARGS]: T["Params"];

   constructor(public readonly expand: SqlExpandHandler<T>) {
      super({
         id: ``,
      });

      this.expand = expand;
   }

   build(context: SqlBuildContext, options?: SqlBuildOptions): void {
      if (!context.params) {
         context.addExpand(this);
         context.addStrings(`/* <${this.id} /> */`);
         return;
      }

      let expanded = this.expand(<T["Params"]>context.params) ?? [];
      if (typeof expanded === "object" && !Array.isArray(expanded)) expanded = [expanded];
      for (const { index, item } of indexedArray(expanded)) {
         if (index > 0) context.addStrings(", ");

         if (item instanceof SqlQuery) {
            item.render("inline").build(context, options);
            continue;
         }

         item.build(context, options);
      }
   }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlExpandHandlerAny = SqlExpandHandler<any>;

export type SqlExpandHandler<T extends { Params: unknown }> = (params: T["Params"]) => Sql[] | Sql | null;

/**
 *
 * @param handler
 */
export function expand<Params extends unknown[] | Record<string, unknown> | void>(
   handler: SqlExpandHandler<{ Params: Params }>,
): SqlExpand<{ Params: Params }> {
   return new SqlExpand(handler);
}
