import { QueryConfig, QueryResult, QueryResultRow } from "pg";

export interface SqlClient {
   query<R extends QueryResultRow>(queryConfig: QueryConfig): Promise<QueryResult<R>>;
}
