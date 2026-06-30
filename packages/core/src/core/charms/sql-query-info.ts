import { Sql } from "#src/core/sql-base.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { Queue } from "#src/lib/queue.js";

export type SqlQueryInfoOptions = Partial<Pick<SqlQueryInfo, "label" | "driver">> & Record<string, unknown>;

export class SqlQueryInfo extends Sql {
   readonly label: string | null;
   readonly driver: string | null;

   constructor(public readonly options: SqlQueryInfoOptions) {
      super({
         type: "SqlQueryInfo",
         ...(() => {
            const hashId = Object.entries(options)
               .map(([k, v]) => `${k}=${v}`)
               .join(", ");
            return {
               id: hashId,
               hashId: hashId,
            };
         })(),
      });
      this.label = options.label ?? null;
      this.driver = options.driver ?? null;
   }

   write(context: SqlBuildContext) {
      context.addStrings("\n/* ");
      const q = new Queue(Object.entries(this.options));
      for (const {
         item: [key, value],
         index,
      } of q.each()) {
         if (index > 0) context.addStrings(", ");
         context.addStrings(`${key}: ${value}`);
      }
      context.addStrings(" */\n");
   }
}

/**
 * Attaches metadata to a query for debugging and logging purposes.
 *
 * The options object is emitted as a SQL comment in the generated query text.
 * Use `label` to give the query a human-readable name that appears in logs
 * and error messages. Use `driver` to hint which database driver should
 * execute this query.
 *
 * @param options - Metadata to attach. `label` and `driver` are well-known keys;
 *   any additional properties are also emitted in the comment.
 *
 * @example
 * const q = sql`
 *   ${info({ label: "find-active-accounts" })}
 *   SELECT ${row(Account.$$)}
 *   FROM ${Account}
 *   WHERE ${Account.$active} = true
 * `;
 * // Emits: /* label: find-active-accounts *\/  before the query
 */
export function info(options: SqlQueryInfoOptions) {
   return new SqlQueryInfo(options);
}
