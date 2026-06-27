import { sql } from "#src/core/sql.js";
import { mockHandler } from "#src/test/mock-query-handler.js";

export const randomQuery = sql`SELECT 1`;
export const randomHandler = mockHandler(sql`SELECT 1`);
