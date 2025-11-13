import { describe, expect, test } from "vitest";
import { quote } from "../quote.js";

describe("quote() tests", () => {
   test(`quoting: Account as a_1 should render "Account" as "a_1"`, () => {
      const actual = quote("Account as a_1");
      expect(actual).toEqual(`"Account" as "a_1"`);
   });

   test(`quoting: a_1.account_id should render as "a_1"."account_id"`, () => {
      const actual = quote("a_1.account_id");
      expect(actual).toEqual(`"a_1"."account_id"`);
   });

   test(`quoting: a_1.account_id as accountId should render as "a_1"."account_id" as "accountId"`, () => {
      const actual = quote("a_1.account_id as accountId");
      expect(actual).toEqual(`"a_1"."account_id" as "accountId"`);
   });

   test(`quoting: a_1.* should render as "a_1".*`, () => {
      const actual = quote("a_1.*");
      expect(actual).toEqual(`"a_1".*`);
   });
});
