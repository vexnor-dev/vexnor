import { Sql, SqlOptions } from "../sql-base.js";
import { SqlQueryParams } from "./sql-query.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlCharmAny = SqlCharm<any>;

export abstract class SqlCharm<T extends { Params?: unknown }> extends Sql {
   readonly params: SqlQueryParams<T>;

   protected constructor(options: SqlOptions & { params: SqlQueryParams<T> }) {
      super(options);
      this.params = options.params;
   }
}
