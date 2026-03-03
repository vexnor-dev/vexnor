import { expand, raw, SqlParam, SqlQuery, SqlQueryAny, SqlQueryExtended } from "../query/index.js";
import { ParamsOfArgs, RowOf, Sql } from "../sql-base.js";
import { sql } from "../sql.js";
import { SqlTable } from "../schema/index.js";
import { SqlTableCommand } from "./sql-table-command.js";
import { Simplify, Void } from "../utils/index.js";
import { ok } from "assert";

export type SqlTableReadArgs = {
   select?: SqlQueryAny;
   where?: SqlQueryAny;
   join?: SqlQueryAny;
   groupBy?: SqlQueryAny;
   having?: SqlQueryAny;
   orderBy?: SqlQueryAny;
   offset?: SqlParam<{ Name: "offset"; Type: number }>;
   limit?: SqlParam<{ Name: "limit"; Type: number }>;
   includeOne?: Record<string, SqlQueryAny>;
   includeMany?: Record<string, SqlQueryAny>;
};

export type SqlTableReadResult<
   T extends { Select: Record<string, unknown> },
   Args extends SqlTableReadArgs,
> = SqlQueryExtended<{
   Params: Void<ParamsOfArgs<Args>>;
   Row: SqlTableReadRow<T, Args>;
}>;

export type SqlTableReadRow<T extends { Select: Record<string, unknown> }, Args extends SqlTableReadArgs> = Simplify<
   SqlTableReadRowSelect<T, Args> & SqlTableReadRowIncludeOne<Args> & SqlTableReadRowIncludeMany<Args>
>;

type SqlTableReadRowSelect<
   T extends { Select: Record<string, unknown> },
   Args extends SqlTableReadArgs,
> = Args["select"] extends SqlQueryAny ? RowOf<Args["select"]> : T["Select"];

type SqlTableReadRowIncludeOne<Args extends SqlTableReadArgs> =
   Args extends Pick<SqlTableReadArgs, "includeOne">
      ? {
           [K in keyof Args["includeOne"]]: Args["includeOne"][K] extends SqlQueryAny
              ? RowOf<Args["includeOne"][K]>
              : never;
        }
      : unknown;

type SqlTableReadRowIncludeMany<Args extends SqlTableReadArgs> =
   Args extends Pick<SqlTableReadArgs, "includeMany">
      ? {
           [K in keyof Args["includeMany"]]: Args["includeMany"][K] extends SqlQueryAny
              ? RowOf<Args["includeMany"][K]>[]
              : never;
        }
      : unknown;

export type SqlTableReadOptional<T> = T extends { Select: Record<string, unknown> } ? SqlTableRead<T> : unknown;

export class SqlTableRead<T extends { Select: Record<string, unknown> }> implements SqlTableCommand<T> {
   constructor(public readonly table: SqlTable<T>) {}

   read<Args extends SqlTableReadArgs>(args: Args): SqlTableReadResult<T, Args> {
      const { select, includeOne, includeMany } = args;
      ok(!includeMany || Object.keys(includeMany).length === 0, `'includeMany' not supported by default SqlTableRead.`);
      ok(!includeOne || Object.keys(includeOne).length === 0, `'includeOne' not supported by default SqlTableRead.`);

      return sql`
         ${expand(() => {
            if (!select) return sql`select ${this.table.$$}`;

            const hasSelect = select?.rawStrings[0]?.toLowerCase().includes("select");
            if (hasSelect) return select;

            return sql`select ${select}`;
         })}
         from
         ${this.table}
         ${expand<ParamsOfArgs<SqlTableReadArgs>>((params) => {
            if (!params) return null;

            const results: Sql[] = [];
            for (const [paramKey, { keyword, prefix }] of CONFIG.entries()) {
               const param = params[<keyof ParamsOfArgs<SqlTableReadArgs>>paramKey] ?? {};
               if (!param) continue;

               const arg = args[<keyof SqlTableReadArgs>paramKey];
               if (!arg) continue;
               if (!(arg instanceof Sql)) continue;

               const query = arg instanceof SqlQuery ? arg : undefined;
               const search = (keyword ?? prefix)?.toLowerCase();
               const hasPrefix = search ? query?.rawStrings[0]?.toLowerCase().includes(search) : false;
               switch (true) {
                  case hasPrefix:
                     results.push(arg);
                     break;
                  case !!prefix:
                     if (arg instanceof SqlQuery) {
                        results.push(sql`${raw(prefix)} ${arg.render("inline")}`);
                        break;
                     }

                     results.push(sql`${raw(prefix)} ${arg}`);
                     break;
                  default:
                     results.push(arg);
                     break;
               }
            }

            return results;
         })}
      ` as SqlTableReadResult<T, Args>;
   }
}

const CONFIG = new Map<
   keyof Omit<SqlTableReadArgs, "includeOne" | "includeMany">,
   { prefix?: string; keyword?: string }
>([
   ["where", { prefix: "where" }],
   ["select", { prefix: "select" }],
   ["join", { keyword: "join" }],
   ["groupBy", { prefix: "group by" }],
   ["having", { prefix: "having" }],
   ["offset", { prefix: "offset" }],
   ["limit", { prefix: "limit" }],
]);
