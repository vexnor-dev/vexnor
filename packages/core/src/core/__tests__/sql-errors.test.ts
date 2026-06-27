import { describe, expect, test } from "vitest";
import { SqlMetaError } from "#src/core/sql-meta-error.js";
import { SqlExecError } from "#src/cli/exec/sql-exec-error.js";

describe("SqlMetaError", () => {
   test("sets message and name", () => {
      const err = new SqlMetaError("invalid query");
      expect(err.message).toBe("invalid query");
      expect(err.name).toBe("SqlMetaError");
      expect(err).toBeInstanceOf(Error);
   });

   test("forwards cause via options", () => {
      const cause = new Error("root cause");
      const err = new SqlMetaError("wrapper", { cause });
      expect(err.cause).toBe(cause);
   });
});

describe("SqlExecError", () => {
   test("sets message and name", () => {
      const err = new SqlExecError("exec failed");
      expect(err.message).toBe("exec failed");
      expect(err.name).toBe("SqlExecError");
      expect(err).toBeInstanceOf(Error);
   });
});
