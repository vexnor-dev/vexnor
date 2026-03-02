import { expand, raw, SqlParam, SqlQuery, SqlQueryAny, SqlQueryExtended } from "../query/index.js";
import { ParamsOfArgs, RowOf, Sql } from "../sql-base.js";
import { sql } from "../sql.js";
import { SqlTable } from "../schema/index.js";
import { SqlTableCommand } from "./sql-table-command.js";
import { Simplify } from "../utils/index.js";

export type SqlTableReadArgs = {
   select?: SqlQueryAny;
   where?: SqlQueryAny;
   join?: SqlQueryAny;
   groupBy?: SqlQueryAny;
   having?: SqlQueryAny;
   offset?: SqlParam<{ Name: "offset"; Type: number }>;
   limit?: SqlParam<{ Name: "limit"; Type: number }>;
};

export type SqlTableReadResult<
   T extends { Select: Record<string, unknown> },
   Args extends SqlTableReadArgs,
> = SqlQueryExtended<{
   Params: Simplify<ParamsOfArgs<Args>>;
   Row: Args["select"] extends SqlQueryAny ? RowOf<Args["select"]> : T["Select"];
}>;

export type SqlTableReadOptional<T> = T extends { Select: Record<string, unknown> } ? SqlTableRead<T> : unknown;

export class SqlTableRead<T extends { Select: Record<string, unknown> }> implements SqlTableCommand<T> {
   constructor(public readonly table: SqlTable<T>) {}

   read<Args extends SqlTableReadArgs>(args: Args): SqlTableReadResult<T, Args> {
      const { select } = args;
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
            for (const [paramKey, { keyword, prefix }] of Object.entries(CONFIG)) {
               const param = params[<keyof ParamsOfArgs<SqlTableReadArgs>>paramKey];
               if (!param) continue;

               const arg = args[<keyof SqlTableReadArgs>paramKey];
               if (!arg) continue;

               const query = arg instanceof SqlQuery ? arg : undefined;
               const search = (keyword ?? prefix)?.toLowerCase();
               const hasPrefix = search ? query?.rawStrings[0]?.toLowerCase().includes(search) : false;
               switch (true) {
                  case hasPrefix:
                     results.push(arg);
                     break;
                  case !!prefix:
                     if (arg instanceof SqlQuery) {
                        results.push(sql`${raw(prefix, { quote: false })} ${arg.render("inline")}`);
                        break;
                     }

                     results.push(sql`${raw(prefix, { quote: false })} ${arg}`);
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

const CONFIG: Record<
   keyof SqlTableReadArgs,
   {
      prefix?: string;
      keyword?: string;
   }
> = {
   where: { prefix: "where" },
   select: { prefix: "select" },
   join: { keyword: "join" },
   groupBy: { prefix: "group by" },
   having: { prefix: "having" },
   offset: { prefix: "offset" },
   limit: { prefix: "limit" },
};
