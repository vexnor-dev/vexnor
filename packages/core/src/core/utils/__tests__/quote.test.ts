import { describe, expect, test } from "vitest";
import { quoteText } from "#src/core/utils/quote-text.js";

describe("quoteText() tests", () => {
   test(`quoting: Account as a_1 should render "Account" as "a_1"`, () => {
      const actual = quoteText("Account as a_1");
      expect(actual).toEqual(`"Account" as "a_1"`);
   });

   test(`quoting: a_1.account_id should render as "a_1"."account_id"`, () => {
      const actual = quoteText("a_1.account_id");
      expect(actual).toEqual(`"a_1"."account_id"`);
   });

   test(`quoting: a_1.account_id as accountId should render as "a_1"."account_id" as "accountId"`, () => {
      const actual = quoteText("a_1.account_id as accountId");
      expect(actual).toEqual(`"a_1"."account_id" as "accountId"`);
   });

   test(`quoting: a_1.* should render as "a_1".*`, () => {
      const actual = quoteText("a_1.*");
      expect(actual).toEqual(`"a_1".*`);
   });
});
