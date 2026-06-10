import { AsyncLocalStorage } from "node:async_hooks";
import to from "to-case";
import { CodeWriter } from "#/lib/code-writer.js";
import { VexnorPluginAny } from "#/plugin/plugin.js";

export class CodegenContextModel {
   readonly outDir: string;
   readonly plugin: VexnorPluginAny;
   readonly camelCaseColumns?: boolean;
   readonly includeEnums?: boolean;
   readonly getColumnName: (columnName: string) => string;
   readonly getTableName: (tableName: string) => string;

   constructor(args: CodegenContextArgs) {
      this.outDir = args.outDir;
      this.plugin = args.plugin;
      this.camelCaseColumns = args.camelCaseColumns;
      this.includeEnums = args.includeEnums;
      this.getColumnName = (columnName: string) => (this.camelCaseColumns ? to.camel(columnName) : columnName);
      this.getTableName = (tableName: string) => to.pascal(tableName);
   }

   newWriter() {
      return new CodeWriter({
         newLine: "\n",
         useTabs: false,
         useSingleQuote: true,
         indentNumberOfSpaces: 3,
      });
   }
}

export const CodegenContext = new AsyncLocalStorage<CodegenContextModel>();

export function getCodegenContext(): CodegenContextModel {
   const context = CodegenContext.getStore();
   if (!context) throw new Error("No CodegenContext found");

   return context;
}

export type CodegenContextArgs = {
   outDir: string;
   plugin: VexnorPluginAny;
   camelCaseColumns?: boolean;
   includeEnums?: boolean;
};
