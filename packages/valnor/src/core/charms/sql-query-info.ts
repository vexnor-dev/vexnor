import { Sql } from "#/core/sql-base.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { Queue } from "#/lib/queue.js";

export type SqlQueryInfoOptions = Partial<Pick<SqlQueryInfo, "label" | "driver">> & Record<string, unknown>;

export class SqlQueryInfo extends Sql {
   readonly label: string | null;
   readonly driver: string | null;

   constructor(public readonly options: SqlQueryInfoOptions) {
      super({
         id: Object.entries(options)
            .map(([k, v]) => `${k}=${v}`)
            .join(", "),
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

export function info(options: SqlQueryInfoOptions) {
   return new SqlQueryInfo(options);
}
