import { describe, expect, test } from "vitest";
import { CodeWriter } from "#src/lib/code-writer.js";

describe("CodeWriter", () => {
   test("writes lines and blocks with indentation", () => {
      const writer = new CodeWriter({ indentNumberOfSpaces: 2, useSingleQuote: true });
      writer.write("const x =").inlineBlock(() => {
         writer.writeLine("a: 1,");
      });

      expect(writer.toString()).toBe("const x = {\n  a: 1,\n}");
   });

   test("supports quote helpers", () => {
      const writer = new CodeWriter({ useSingleQuote: false });
      writer.quote("abc").newLine();
      writer.write("value=").quote();
      writer.write("x");
      writer.quote();

      expect(writer.toString()).toBe('"abc"\nvalue="x"');
   });

   test("supports spaced block syntax", () => {
      const writer = new CodeWriter({ indentNumberOfSpaces: 3 });
      writer.write("if (ok)").block(() => {
         writer.writeLine("run();");
      });

      expect(writer.toString()).toBe("if (ok) {\n   run();\n}\n");
   });

   test("genericBlock writes <{ ... }> with indentation", () => {
      const writer = new CodeWriter({ indentNumberOfSpaces: 3 });
      writer.write("newSqlTable").genericBlock(() => {
         writer.writeLine("Select: IFooSelect;");
         writer.writeLine("Insert: IFooInsert;");
      }).write("(");

      expect(writer.toString()).toMatchInlineSnapshot(`
        "newSqlTable<{
           Select: IFooSelect;
           Insert: IFooInsert;
        }>("
      `);
   });
});
