import { beforeEach } from "vitest";
import { resetIds } from "#/core/sql-base.js";
import { resetCache } from "#/lib/cache.js";

beforeEach(() => {
   resetIds();
   resetCache();
});
