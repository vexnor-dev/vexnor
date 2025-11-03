import { SqlQuery } from "./sql-query.js";
import { SqlQueryRowOut } from "../sql-types.js";

export abstract class SqlQueryHandler<T extends { Row: SqlQueryRowOut; QueryResult: object }> {
   protected constructor(public readonly query: SqlQuery<{ Row: T["Row"] }>) {}

   abstract resolveRows(res: T["QueryResult"]): T["Row"][];
}
