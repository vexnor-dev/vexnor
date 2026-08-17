import { AsyncLocalStorage } from "node:async_hooks";
import to from "to-case";
import { CodeWriter } from "#src/lib/code-writer.js";
import { VexnorPluginAny } from "#src/plugin/plugin.js";
import { GenerateConfig } from "#src/config/config-types.js";
import type { SchemaCatalogEnum } from "#src/schema/schema-catalog.js";

export class CodegenContextModel {
   readonly outDir: string;
   readonly plugin: VexnorPluginAny;
   readonly camelCaseColumns?: boolean;
   readonly includeEnums?: boolean;
   readonly generate: GenerateConfig | null;
   readonly source: string;
   readonly dialect: string;
   readonly enums: SchemaCatalogEnum[];
   readonly getColumnName: (columnName: string) => string;
   readonly getTableName: (tableName: string) => string;

   constructor(args: CodegenContextArgs) {
      this.outDir = args.outDir;
      this.plugin = args.plugin;
      this.camelCaseColumns = args.camelCaseColumns;
      this.includeEnums = args.includeEnums;
      this.generate = args.generate ?? null;
      this.source = args.source ?? "";
      this.dialect = args.dialect ?? args.plugin.dialect;
      this.enums = args.enums ?? [];
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
   generate?: GenerateConfig | null;
   source?: string;
   dialect?: string;
   enums?: SchemaCatalogEnum[];
};
