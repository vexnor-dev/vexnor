import { format } from "sql-formatter";
import { registerFormatter } from "./formatter-registry.js";

export function setupFormatter(options: { active: boolean }): void {
   if (options.active) {
      registerFormatter({ active: true, format });
   } else {
      registerFormatter({ active: false });
   }
}
