import { describe, expect, test } from "vitest";
import { getCanonicalInsertKeys } from "../canonical-insert-keys.js";
import { InferTable$RowBySelect } from "../../types/index.js";

describe("getCanonicalInsertKeys() tests", () => {
   const mockRow: InferTable$RowBySelect<Record<string, unknown>> = {
      $firstName: { key: "firstName", columnName: "first_name" },
      $lastName: { key: "lastName", columnName: "last_name" },
      $email: { key: "email", columnName: "email" },
      $accountId: { key: "accountId", columnName: "account_id" },
   } as any;

   test("single insert returns keys in canonical order", () => {
      const inserts = [{ email: "test@example.com", lastName: "Doe", firstName: "John" }];
      const keys = getCanonicalInsertKeys(mockRow, inserts);
      expect(keys).toEqual(["firstName", "lastName", "email"]);
   });

   test("multiple inserts with same keys in different order returns canonical order", () => {
      const inserts = [
         { firstName: "John", lastName: "Doe", email: "john@example.com" },
         { email: "jane@example.com", firstName: "Jane", lastName: "Smith" },
         { lastName: "Bob", email: "bob@example.com", firstName: "Bobby" },
      ];
      const keys = getCanonicalInsertKeys(mockRow, inserts);
      expect(keys).toEqual(["firstName", "lastName", "email"]);
   });

   test("keys are ordered by row definition, not insert order", () => {
      const inserts = [{ email: "test@example.com", firstName: "John" }];
      const keys = getCanonicalInsertKeys(mockRow, inserts);
      expect(keys).toEqual(["firstName", "email"]);
   });

   test("throws error when inserts array is empty", () => {
      expect(() => getCanonicalInsertKeys(mockRow, [])).toThrow("No inserts provided");
   });

   test("throws error when inserts have different keys (extra key)", () => {
      const inserts = [
         { firstName: "John", lastName: "Doe" },
         { firstName: "Jane", lastName: "Smith", email: "jane@example.com" },
      ];
      expect(() => getCanonicalInsertKeys(mockRow, inserts)).toThrow(
         "Row 1 has different columns than row 0",
      );
   });

   test("throws error when inserts have different keys (missing key)", () => {
      const inserts = [
         { firstName: "John", lastName: "Doe", email: "john@example.com" },
         { firstName: "Jane", lastName: "Smith" },
      ];
      expect(() => getCanonicalInsertKeys(mockRow, inserts)).toThrow(
         "Row 1 has different columns than row 0",
      );
   });

   test("throws error when insert has key not in table row", () => {
      const inserts = [{ firstName: "John", invalidColumn: "value" }];
      expect(() => getCanonicalInsertKeys(mockRow, inserts)).toThrow(
         "Column invalidColumn does not exist in table",
      );
   });

   test("handles subset of table columns", () => {
      const inserts = [{ firstName: "John" }];
      const keys = getCanonicalInsertKeys(mockRow, inserts);
      expect(keys).toEqual(["firstName"]);
   });
});
