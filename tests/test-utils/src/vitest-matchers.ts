import { expect } from "vitest";

expect.extend({
   toEqualQuery(received: string, expected: string) {
      const normalize = (str: string) => str.replace(/\s+/g, " ").trim();
      const normalizedReceived = normalize(received);
      const normalizedExpected = normalize(expected);
      const pass = normalizedReceived === normalizedExpected;

      return {
         pass,
         message: () =>
            pass
               ? `Expected queries not to match`
               : `Expected queries to match:\n\nReceived:\n${normalizedReceived}\n\nExpected:\n${normalizedExpected}`,
      };
   },
});

declare module "vitest" {
   interface Assertion<T = any> {
      toEqualQuery(expected: string): T;
   }
}
