import { SqlQuery } from "./sql-query.js";
import { SqlBuildContext } from "./sql-build-context.js";
import { Sql } from "../sql-base.js";
import { Key } from "node:readline";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlCharmAny = SqlCharm<any>;

export class SqlCharm<T extends { Key?: string; Row?: unknown; Params?: unknown }> extends Sql {
   readonly key?: Key;
   readonly query: SqlQuery<{ Row: T["Row"]; Params: T["Params"] }>;

   constructor({ key, query }: { key?: Key; query: SqlQuery<{ Row: T["Row"]; Params: T["Params"] }> }) {
      super({
         ID: `${query.ID} as ${key}`,
      });
      this.query = query;
      this.key = key;
   }

   build(context: SqlBuildContext) {
      const queryName = context.scope({ query: this.query }, () => {
         return context.getQueryName(this.query);
      });
      context.addStrings(`"${queryName}" as "${this.key}"`);
   }
}
