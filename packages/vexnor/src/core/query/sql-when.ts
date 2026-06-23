import { PARAMS, ParamsOf, Sql, SqlOptions } from "#/core/sql-base.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { SqlBuildOptions } from "#/core/builder/sql-build-options.js";
import { SqlQuery } from "#/core/query/sql-query.js";
import { resolvePath } from "#/core/query/resolve-path.js";
import { BuildSqlParams, LeafPaths, PathToNested, SqlParam, SqlParamAny } from "#/core/query/sql-param.js";

export type SqlWhenTypeArgs = { Name: string; Type: unknown; OnTrue: Sql; OnFalse: Sql | null };

/**
 * A portable conditional primitive that includes or excludes a SQL fragment
 * based on a boolean parameter.
 *
 * Supports negation via `"!"` prefix — `"!flag"` includes the onTrue branch
 * when the param is falsy.
 *
 * Both branches are static SQL known at definition time — fully serializable
 * for cross-stack execution. The `negate` field is included in the manifest.
 *
 * @example
 * // Include when truthy
 * sql`
 *   SELECT ${row(Account.$$)} FROM ${Account}
 *   WHERE ${Account.$status} = ${param<P>('status')}
 *   ${when('hasEmail', sql`AND ${Account.$email} = ${param<P>('email')}`)}
 * `
 *
 * @example
 * // Include when falsy (negated)
 * sql`
 *   SELECT ${row(Account.$$)} FROM ${Account}
 *   ${when('!hasEmail', sql`WHERE ${Account.$email} IS NULL`)}
 * `
 *
 * @example
 * // With else branch
 * sql`
 *   SELECT ${row(Account.$$)} FROM ${Account}
 *   ORDER BY ${Account.$createdAt} ${when('sortAsc', sql`ASC`, sql`DESC`)}
 * `
 */
export class SqlWhen<T extends SqlWhenTypeArgs> extends Sql {
   declare readonly [PARAMS]: PathToNested<T["Name"], T["Type"]> & ParamsOf<T["OnTrue"]>;

   readonly paramName: T["Name"];
   readonly negate: boolean;
   readonly onTrue: Sql;
   readonly onFalse: Sql | null;
   readonly params: BuildSqlParams<T>;

   constructor({
      paramName,
      onTrue,
      onFalse,
      negate,
   }: {
      paramName: T["Name"];
      onTrue: T["OnTrue"];
      onFalse?: T["OnFalse"] | null;
      negate?: boolean;
   }) {
      // Support "!" prefix for negation
      const hasPrefix = paramName.startsWith("!");
      const resolvedName = hasPrefix ? paramName.slice(1) : paramName;
      const resolvedNegate = negate ?? hasPrefix;

      const hashId = `${paramName}|onTrue=${onTrue.hashId}|onFalse=${onFalse?.hashId ?? "-"}`;
      super({
         type: "SqlWhen",
         id: resolvedName,
         hashId,
      } satisfies SqlOptions);

      this.paramName = resolvedName;
      this.negate = resolvedNegate;
      this.onTrue = onTrue;
      this.onFalse = onFalse ?? null;

      // Collect params from branches so the parent query can discover them
      const collected: Record<string, SqlParamAny> = {};
      for (const branch of [onTrue, onFalse]) {
         if (!branch) continue;

         if (branch instanceof SqlQuery && branch.params) {
            Object.assign(collected, branch.params);
         }

         Object.assign(collected, {
            [paramName]: new SqlParam({
               name: paramName,
               isContext: false,
            }),
         });
      }
      this.params = collected as BuildSqlParams<T>;
   }

   write(context: SqlBuildContext, options?: SqlBuildOptions | null): void {
      if (!context.params) {
         // Serialize mode: build both branches to capture their tokens
         const onTrueTokens = this.buildBranchTokens(this.onTrue, context, options);
         const onFalseTokens = this.onFalse ? this.buildBranchTokens(this.onFalse, context, options) : undefined;
         context.addOperator({
            type: "when",
            param: this.paramName,
            ...(this.negate ? { negate: true } : {}),
            onTrue: onTrueTokens,
            ...(onFalseTokens ? { onFalse: onFalseTokens } : {}),
         });
         return;
      }

      const params = context.params as Record<string, unknown>;
      const rawValue = resolvePath(params, this.paramName);
      const isPresent = rawValue != null && rawValue !== false;
      const value = this.negate ? !isPresent : isPresent;

      const branch = value ? this.onTrue : this.onFalse;
      if (!branch) return;

      if (branch instanceof SqlQuery) {
         branch.build(context, options, { queryType: "inline" });
      } else {
         branch.build(context, options);
      }
   }

   private buildBranchTokens(
      branch: Sql,
      context: SqlBuildContext,
      options?: SqlBuildOptions | null,
   ): import("#/core/query/sql-models.js").SqlBuildToken[] {
      const branchContext = new SqlBuildContext({ dialect: context.dialect, params: null });
      if (branch instanceof SqlQuery) {
         branch.build(branchContext, options, { queryType: "inline" });
      } else {
         branch.build(branchContext, options);
      }
      return [...branchContext.tokens];
   }
}

/**
 * Conditional SQL fragment — includes `onTrue` when the boolean param is truthy,
 * otherwise includes `onFalse` (or nothing if omitted).
 *
 * Prefix the flag with `"!"` to negate — includes `onTrue` when the param is falsy.
 *
 * @param name - name of flag parameter (can also use existing param names)
 * @param onTrue - SQL fragment to include when condition is met
 * @param onFalse - Optional SQL fragment to include when condition is not met
 */
export function when<
   T extends Record<string, unknown>,
   K extends LeafPaths<T> = LeafPaths<T>,
   OnTrue extends Sql = Sql,
   OnFalse extends Sql | null = null,
>(
   name: K,
   onTrue: OnTrue,
   onFalse: OnFalse | null = null,
): SqlWhen<{
   Name: typeof name;
   Type: T[K];
   OnTrue: OnTrue;
   OnFalse: OnFalse;
}> {
   return new SqlWhen({
      paramName: name,
      onTrue,
      onFalse: onFalse,
      negate: name.includes("!"),
   });
}
