export function trim(strings: TemplateStringsArray | string, ...values: never[]): string {
   if (values?.length) {
      throw new Error(`Values not expected: ${values}`);
   }
   const str = typeof strings === "string" ? strings : strings.join("");
   return str.trim().replace(/\s+/g, " ").replace("( ", "(").replace(" )", ")").replace(" /*", "/*").replace(" ,", ",");
}
