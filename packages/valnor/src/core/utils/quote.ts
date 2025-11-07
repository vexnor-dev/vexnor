/**
 * Quotes text when different from "*".
 * Used for controlling quoting for column names
 * @param text
 */
export function quote<U extends string>(text: U) {
   function q(value: string) {
      const result = [];
      if (!value.startsWith(`"`)) result.push(`"`);
      result.push(value);
      if (!value.endsWith(`"`)) result.push(`"`);

      return result.join("");
   }

   return text
      .split(".")
      .map((z) => {
         if (z === "*") return z;
         return q(z);
      })
      .join(".")
      .split(" as ")
      .map((z) => {
         if (z === "*") return z;
         return q(z);
      })
      .join(" as ");
}
