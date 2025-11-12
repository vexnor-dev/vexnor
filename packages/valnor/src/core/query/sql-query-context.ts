import { Sql } from "../sql-base.js";

export class SqlQueryContext {
   readonly sqlByQueryId = new Map<Sql, string>();

   constructor() {}

   track(queryId: string, sql: Sql) {
      this.sqlByQueryId.set(sql, queryId);
   }

   append(children: Map<Sql, string>) {
      children.forEach((value, key) => {
         this.sqlByQueryId.set(key, value);
      });
   }
}
