// noinspection SqlNoDataSourceInspection,SqlResolve
import { ARGS, PARAMS, ROW, Sql } from "#/core/sql-base.js";
import { SqlQuery } from "#/core/query/sql-query.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { SqlBuildOptions, sqlBuildDefaults } from "#/core/builder/sql-build-options.js";
import { BuildSqlParams, SqlParam } from "#/core/query/sql-param.js";
import { ParamValidation } from "#/core/query/sql-param-validation.js";

export type SqlExpandAny = SqlExpand<{ Params: Record<string, unknown> }>;

export type ExpandValidation<Params extends Record<string, unknown>> = {
   [K in keyof Params]: ParamValidation<Params[K]> | null;
};

export class SqlExpand<T extends { Params: Record<string, unknown> }> extends Sql {
   declare readonly [ROW]: ReturnType<typeof expand> extends SqlQuery<
      infer Options extends { Row: Record<string, unknown> }
   >
      ? Options["Row"]
      : void;

   declare readonly [PARAMS]: T["Params"];
   declare readonly [ARGS]: T["Params"];

   constructor(
      public readonly params: BuildSqlParams<T["Params"]>,
      public readonly expand: SqlExpandHandler<T>,
   ) {
      super({
         type: "SqlExpand",
         ...(() => {
            const hashId = Object.keys(params).join("-");
            return {
               id: hashId,
               hashId: hashId,
            };
         })(),
      });
   }

   write(context: SqlBuildContext, options?: SqlBuildOptions): void {
      if (!context.params) {
         context.addExpand(this);
         if (options?.boundaryComments ?? sqlBuildDefaults.boundaryComments) context.addStrings(`/* <${this.id} /> */`);
         return;
      }

      const paramValues = context.params as Record<string, unknown>;

      // resolve each declared param through valueOrDefault (applies default, validates, throws if invalid with no default)
      const resolvedParams = Object.fromEntries(
         Object.values(this.params).map((sqlParam) => [
            sqlParam.name,
            sqlParam.valueOrDefault(paramValues[sqlParam.name]),
         ]),
      ) as T["Params"];

      let expanded = this.expand(resolvedParams) ?? [];
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
 * Lazily expands a dynamic list of SQL nodes at query execution time.
 *
 * The generic declares the full param set and types. The validation map keys
 * must match the generic — each value is `ParamValidation<T[K]> | null`.
 * `null` means declare the param with no validation rules.
 *
 * All declared params are collected into `query.params` and validated at
 * build time before the handler is invoked.
 *
 * @example
 * const q = sql`
 *   SELECT ${row(Account.$$)}
 *   FROM ${Account}
 *   WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>(
 *     { ids: null },
 *     ({ ids }) => ids.map((id) => sql`${id}`)
 *   )})
 * `;
 *
 * @example
 * // With validation
 * expand<{ ids: string[]; sort: string }>(
 *   { ids: { minLength: 1 }, sort: { values: ["asc", "desc"] } },
 *   ({ ids }) => ids.map((id) => sql`${id}`)
 * )
 */
export function expand<Params extends Record<string, unknown>>(
   validation: ExpandValidation<Params>,
   handler: SqlExpandHandler<{ Params: Params }>,
): SqlExpand<{ Params: Params }> {
   const params = Object.fromEntries(
      Object.entries(validation).map(([key, rules]) => [
         key,
         new SqlParam({ name: key, validation: rules as ParamValidation<unknown> | null }),
      ]),
   ) as BuildSqlParams<Params>;
   return new SqlExpand(params, handler);
}
