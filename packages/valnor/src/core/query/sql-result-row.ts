import { isSql, Sql } from "../sql-base.js";
import { isRecord, SqlBuildOptions } from "../sql-types.js";
import { SqlQueryContext } from "./sql-query-context.js";
import { SqlBuildError } from "../sql-build-error.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlRowAny = SqlResultRow<any>;

export class SqlResultRow<T extends Sql[]> extends Sql {
   constructor(public readonly columns: T) {
      super();
   }

   $build(context: SqlQueryContext, options?: SqlBuildOptions): void {
      let index = 0;
      const items: unknown[] = [...this.columns];
      while (items.length) {
         const item = items.shift();
         if (isSql(item)) {
            if (index++ > 0) context.strings.push(", ");
            item.$build(context, options);
            continue;
         }

         if (isRecord(item)) {
            items.push(...Object.values(item));
            continue;
         }

         throw new SqlBuildError(`Invalid row item: ${item}`);
      }
   }
}

export function row<T extends Sql, U extends T[]>(...columns: U): SqlResultRow<typeof columns> {
   return new SqlResultRow<typeof columns>(columns);
}
