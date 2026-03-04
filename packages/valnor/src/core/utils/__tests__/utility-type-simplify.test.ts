import { assertType, describe, test } from "vitest";
import { Simplify } from "../utility-types.js";

describe("Simplify<{}> tests", () => {
   test("simplify {} without voids", () => {
      type Target = { name: string; id: number };
      type Result = Simplify<Target>;
      assertType<Result>({ name: "test", id: 1 });
   });

   test("simplify {} with voids", () => {
      type Target = { name: void; id: number };
      type Result = Simplify<Target>;
      assertType<Result>({ id: 1 });
   });

   test("simplify {} with voids", () => {
      type Target = { address: { city: string; country: void }; id: number };
      type Result = Simplify<Target>;
      assertType<Result>({ id: 1, address: { city: "test" } });
   });

   test("simplify void & {}", () => {
      type Target = void & { address: { city: string; country: { name: string; location: void } }; id: number };
      type Result = Simplify<Target>;
      assertType<Result>({ id: 1, address: { city: "test", country: { name: "" } } });
   });

   test("simplify void", () => {
      type Target = void;
      type Result = Simplify<Target>;
      assertType<Result>(void 0);
   });
});
