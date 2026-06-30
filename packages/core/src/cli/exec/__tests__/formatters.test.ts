import { describe, expect, test } from "vitest";
import { formatJson, formatCsv, formatTable } from "#src/cli/exec/formatters.js";

describe("formatters", () => {
   const sampleData = [
      { id: 1, name: "Alice", email: "alice@example.com" },
      { id: 2, name: "Bob", email: "bob@example.com" },
   ];

   describe("formatJson", () => {
      test("formats data as JSON", () => {
         const result = formatJson(sampleData);
         expect(result).toBe(JSON.stringify(sampleData, null, 2));
      });

      test("handles empty array", () => {
         const result = formatJson([]);
         expect(result).toBe("[]");
      });
   });

   describe("formatCsv", () => {
      test("formats data as CSV", () => {
         const result = formatCsv(sampleData);
         expect(result).toBe("id,name,email\n1,Alice,alice@example.com\n2,Bob,bob@example.com");
      });

      test("handles empty array", () => {
         const result = formatCsv([]);
         expect(result).toBe("");
      });

      test("escapes values with commas", () => {
         const data = [{ name: "Smith, John", age: 30 }];
         const result = formatCsv(data);
         expect(result).toBe('name,age\n"Smith, John",30');
      });

      test("escapes values with quotes", () => {
         const data = [{ name: 'John "Johnny" Doe', age: 30 }];
         const result = formatCsv(data);
         expect(result).toBe('name,age\n"John ""Johnny"" Doe",30');
      });

      test("handles null and undefined", () => {
         const data = [{ name: "Alice", value: null, other: undefined }];
         const result = formatCsv(data);
         expect(result).toBe("name,value,other\nAlice,,");
      });

      test("throws for non-object array", () => {
         expect(() => formatCsv([1, 2, 3])).toThrow("CSV format requires array of objects");
      });
   });

   describe("formatTable", () => {
      test("formats data as table", () => {
         const result = formatTable(sampleData);
         const lines = result.split("\n");
         expect(lines[0]).toBe("id | name  | email            ");
         expect(lines[1]).toBe("---+-------+------------------");
         expect(lines[2]).toBe("1  | Alice | alice@example.com");
         expect(lines[3]).toBe("2  | Bob   | bob@example.com  ");
      });

      test("handles empty array", () => {
         const result = formatTable([]);
         expect(result).toBe("");
      });

      test("handles null and undefined", () => {
         const data = [{ name: "Alice", value: null, other: undefined }];
         const result = formatTable(data);
         const lines = result.split("\n");
         expect(lines[0]).toBe("name  | value | other");
         expect(lines[2]).toBe("Alice |       |      ");
      });

      test("pads columns correctly", () => {
         const data = [
            { short: "a", long: "very long value" },
            { short: "b", long: "x" },
         ];
         const result = formatTable(data);
         const lines = result.split("\n");
         expect(lines[0]).toBe("short | long           ");
         expect(lines[2]).toBe("a     | very long value");
         expect(lines[3]).toBe("b     | x              ");
      });

      test("throws for non-object array", () => {
         expect(() => formatTable([1, 2, 3])).toThrow("Table format requires array of objects");
      });
   });
});
