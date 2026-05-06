import { SqlBuildContext } from "#/core/builder/sql-build-context.js";

export function getAliasStackInfo(stack: SqlBuildContext["_tableAliasStack"]): string {
   if (!stack) return "<none>";

   return (
      "\n<stack>" +
      stack
         .entries()
         .map(([key, map]) => {
            const lines = map
               .entries()
               .map(([k, v]) => `   ${k} => ${v}`)
               .reduce((result, value) => {
                  return `${result}\n${value}`;
               }, "");
            return `${key}:${lines}`;
         })
         .reduce((result, value) => {
            return `${result}\n${value}`;
         }, "") +
      "\n</stack>"
   );
}
