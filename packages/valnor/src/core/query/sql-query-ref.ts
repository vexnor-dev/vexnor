import { ARGS, PARAMS, Sql, TYPE } from "#/core/sql-base.js";
import { QUERY, SqlQuery, SqlQueryColumns } from "#/core/query/sql-query.js";
import { SqlQueryOptions } from "#/core/query/sql-query-types.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { SqlBuildOptions } from "#/core/builder/sql-build-options.js";
import { CACHE } from "#/lib/cache.js";
import { SqlBuildError } from "#/core/sql-build-error.js";
import { SqlQueryRow } from "#/core/query/sql-models.js";
import { newSqlQueryColumn } from "#/core/query/sql-query-column.js";
import { Lazy } from "#/lib/lazy.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlQueryRefAny = SqlQueryRef<any>;

export type SqlQueryRefExtended<T extends { Row?: unknown; Params?: unknown }> = SqlQueryRef<T> &
   SqlQueryColumns<T["Row"]>;

export class SqlQueryRef<T extends { Row?: unknown; Params?: unknown }> extends Sql {
   declare readonly [QUERY]: SqlQuery<T>;
   declare readonly [TYPE]: T["Row"];
   declare readonly [PARAMS]: T["Params"];
   declare readonly [ARGS]: T["Params"];

   private readonly _rowLazy = new Lazy<SqlQueryRow<T>>(this.initRow.bind(this));

   constructor(
      public readonly innerQuery: SqlQuery<T>,
      public readonly scope: SqlQueryOptions | null,
      public readonly out = false,
   ) {
      super({
         id: innerQuery.id,
      });
   }

   get $$() {
      return this.innerQuery.$$;
   }

   get row(): SqlQueryRow<T> {
      return this._rowLazy.value;
   }

   write(context: SqlBuildContext, options?: SqlBuildOptions | null): void {
      if (this.out) {
         context.addStrings(`"${context.getQueryName(this)}"`);
         return;
      }

      this.innerQuery.build(context, options, this.scope);
   }

   initRow(query = this.innerQuery): SqlQueryRow<T> {
      if (!query.row) return null as SqlQueryRow<T>;

      let row: Partial<SqlQueryRow<T>> = {};
      for (const [key, col] of Object.entries(query.row)) {
         row = {
            ...row,
            [key]: newSqlQueryColumn({
               ...col,
               query: this,
            }),
         };
      }

      return row as SqlQueryRow<T>;
   }
}

export function newSqlQueryRef<T extends { Row?: unknown; Params?: unknown }>(innerQuery: SqlQuery<T>, scope: null, recursive: true): SqlQueryRefExtended<T>;
export function newSqlQueryRef<T extends { Row?: unknown; Params?: unknown }>(innerQuery: SqlQuery<T>, scope: SqlQueryOptions): SqlQueryRefExtended<T>;
export function newSqlQueryRef<T extends { Row?: unknown; Params?: unknown }>(
   innerQuery: SqlQuery<T>,
   scope: SqlQueryOptions | null,
   recursive = false,
): SqlQueryRefExtended<T> {
   let cacheKey: string[] | undefined = undefined;
   switch (true) {
      case recursive:
         cacheKey = [innerQuery.id, "recursive"];
         break;
      case scope !== null:
         cacheKey = [
            innerQuery.id,
            `paramKey=${scope.paramKey ?? "?"}`,
            `queryType=${scope.queryType ?? "?"}`,
            `queryFormat=${scope.queryFormat ?? "?"}`,
         ];
         break;
      default:
         throw new SqlBuildError(`Invalid args for creating query ref for '${innerQuery.id}`);
   }

   const target = CACHE.get<SqlQueryRef<T>>(cacheKey, () => new SqlQueryRef(innerQuery, scope, recursive));
   return new Proxy(target, {
      ownKeys(target): ArrayLike<string | symbol> {
         const rowKeys = target.row ? Object.keys(target.row) : [];
         return [...Reflect.ownKeys(target), ...rowKeys];
      },
      getOwnPropertyDescriptor(target, p: string | symbol): PropertyDescriptor | undefined {
         if (Reflect.has(target, p)) return Reflect.getOwnPropertyDescriptor(target, p);
         if (target.row && Reflect.has(target.row, p)) return Reflect.getOwnPropertyDescriptor(target.row, p);

         return undefined;
      },
      has(target, p: string | symbol): boolean {
         if (Reflect.has(target, p)) return true;
         return Boolean(target.row && Reflect.has(target.row, p));
      },
      get(target, p: string | symbol, receiver: unknown): unknown {
         if (Reflect.has(target, p)) return Reflect.get(target, p, receiver);
         if (target.row && Reflect.has(target.row, p)) return Reflect.get(target.row, p, receiver);

         return undefined;
      },
   }) as SqlQueryRefExtended<T>;
}
