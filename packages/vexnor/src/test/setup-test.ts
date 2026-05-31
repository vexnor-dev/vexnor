import { beforeEach } from "vitest";
import { resetAll } from "#/lib/cache.js";
import { setupFormatter } from "#/format/index.js";

setupFormatter({ active: true });

beforeEach(() => {
   resetAll();
});
