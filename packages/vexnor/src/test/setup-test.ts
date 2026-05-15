import { beforeEach } from "vitest";
import { resetIds } from "#/core/sql-base.js";
import { resetCache } from "#/lib/cache.js";
import { setupFormatter } from "#/format/index.js";

setupFormatter({ active: true });

beforeEach(() => {
   resetIds();
   resetCache();
});
