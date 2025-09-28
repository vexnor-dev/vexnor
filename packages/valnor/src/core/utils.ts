import { ok } from "assert";
import { x } from "../x.js";

export function trim(strings: TemplateStringsArray | string, ...values: never[]): string {
   ok(!values?.length, `Values not expected: ${values}`);
   return x(() => {
      if (typeof strings === "string") return strings;

      return strings.join("");
   })
      .replace(/\s+/g, " ")
      .replace("( ", "(")
      .replace(" )", ")")
      .replace(" /*", "/*")
      .trim();
}
