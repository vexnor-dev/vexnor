import { sql } from "#/core/sql.js";
import { mockHandler } from "#/test/mock-query-handler.js";

export const randomQuery = sql`SELECT 1`;
export const randomHandler = mockHandler(sql`SELECT 1`);
