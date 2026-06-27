import { beforeEach } from "vitest";
import { resetAll } from "#src/lib/cache.js";
import { setupFormatter } from "#src/format/index.js";
import { sqlBuildDefaults } from "#src/core/builder/sql-build-options.js";

setupFormatter({ active: true });
sqlBuildDefaults.boundaryComments = true;

beforeEach(() => {
   resetAll();
});
