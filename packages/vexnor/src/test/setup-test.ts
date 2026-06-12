import { beforeEach } from "vitest";
import { resetAll } from "#/lib/cache.js";
import { setupFormatter } from "#/format/index.js";
import { sqlBuildDefaults } from "#/core/builder/sql-build-options.js";

setupFormatter({ active: true });
sqlBuildDefaults.boundaryComments = true;

beforeEach(() => {
   resetAll();
});
