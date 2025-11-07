import { expect } from "vitest";
import { trim } from "../src/core/index.js";

/**
 * A custom vitest matcher to compare two SQL queries.
 * It trims whitespace and newlines to provide a more robust comparison.
 */

expect.extend({
   toEqualQuery(received: string, expected: string, message?: string) {
      const trimmedReceived = trim(received);
      const trimmedExpected = trim(expected);
      const pass = trimmedReceived === trimmedExpected;
      const diff = this.utils.diff(trimmedExpected, trimmedReceived, {
         expand: this.expand,
      });

      return {
         pass,
         message: () => (pass ? "" : message || `Expected queries to be equal after trimming.\n${diff}`),
         actual: trimmedReceived,
         expected: trimmedExpected,
      };
   },
});

interface CustomMatchers {
   toEqualQuery(expected: string, message?: string): void;
}

declare module "vitest" {
   interface Assertion<T = any> extends CustomMatchers {}
   interface AsymmetricMatchersContaining extends CustomMatchers {}
}
