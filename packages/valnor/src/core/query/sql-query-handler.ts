import { SqlQuery } from "./sql-query.js";

export abstract class SqlQueryHandler<T extends { Row?: unknown; QueryResult: object }> {
   protected constructor(public readonly query: SqlQuery<{ Row?: T["Row"] }>) {}

   abstract resolveRows(res: T["QueryResult"]): T["Row"][];
}
