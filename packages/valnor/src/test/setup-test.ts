import { beforeEach } from "vitest";
import { resetIds } from "#/core/sql-base.js";

beforeEach(() => {
   resetIds();
});
