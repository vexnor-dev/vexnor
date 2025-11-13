/**
 * Quotes text when different from "*".
 * Used for controlling quoting for column names
 * @param text
 */
export function quote<U extends string>(text: U) {
   function q(value: string) {
      if (value === "*") return value;

      const result = [];
      if (!value.startsWith(`"`)) result.push(`"`);
      result.push(value);
      if (!value.endsWith(`"`)) result.push(`"`);

      return result.join("");
   }

   return text
      .split(" as ")
      .map((part) => part.split(".").map((z) => q(z)).join("."))
      .join(" as ");
}
