import { Sql } from "../sql-base.js";
import { SqlBuildContext } from "./sql-build-context.js";
import { SqlQueryAny } from "./sql-query.js";

export class SqlQueryName extends Sql {
   readonly mapper: null | ((value: string) => string);

   constructor(
      public readonly query: SqlQueryAny,
      args?: { mapper?: (value: string) => string },
   ) {
      super({
         ID: query.ID,
      });
      this.mapper = args?.mapper ?? null;
   }

   build(context: SqlBuildContext): void {
      context.scope({ query: this.query });
      let queryName = context.getQueryName(this.query);
      if (this.mapper) queryName = this.mapper(queryName);
      context.addStrings(`"${queryName}"`);
   }

   map(mapper: (value: string) => string): SqlQueryName {
      return new SqlQueryName(this.query, { mapper });
   }

   value(context: SqlBuildContext) {
      return context.getQueryName(this.query);
   }
}
