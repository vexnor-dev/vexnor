import { ARGS, PARAMS, ROW, Sql } from "#/core/sql-base.js";
import { SqlQuery } from "#/core/query/sql-query.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { SqlBuildOptions } from "#/core/builder/sql-build-options.js";

export type SqlExpandAny = SqlExpand<{ Params: unknown }>;

export class SqlExpand<T extends { Params: unknown }> extends Sql {
   declare readonly [ROW]: ReturnType<typeof expand> extends SqlQuery<
      infer Options extends { Row: Record<string, unknown> }
   >
      ? Options["Row"]
      : void;

   declare readonly [PARAMS]: T["Params"];
   declare readonly [ARGS]: T["Params"];

   constructor(public readonly expand: SqlExpandHandler<T>) {
      super({
         id: ``,
      });

      this.expand = expand;
   }

   write(context: SqlBuildContext, options?: SqlBuildOptions): void {
      if (!context.params) {
         context.addExpand(this);
         context.addStrings(`/* <${this.id} /> */`);
         return;
      }

      let expanded = this.expand(<T["Params"]>context.params) ?? [];
      if (typeof expanded === "object" && !Array.isArray(expanded)) expanded = [expanded];
      for (const [index, item] of expanded.entries()) {
         if (index > 0) context.addStrings(", ");

         if (item instanceof SqlQuery) {
            item.build(context, options, { queryType: "inline" });
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
