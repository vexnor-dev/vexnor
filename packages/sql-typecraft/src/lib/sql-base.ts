import { SqlQueryContext } from "./sql-query-context.js";
import { SqlBuild } from "./sql-types.js";

export abstract class Sql {
   abstract build(context: SqlQueryContext): SqlBuild;
}
