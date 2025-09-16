import { AsyncLocalStorage } from "async_hooks";
import to from "to-case";
import { SqlDriver } from "./types/index.js";
import CodeBlockWriter from "code-block-writer";
import { SqlColumnInfo, SqlColumnType } from "../plugin/index.js";

export class CodegenContextModel {
   readonly outDir: string;
   readonly getColumnType: (columns: SqlColumnInfo) => SqlColumnType;
   readonly driver: SqlDriver;
   readonly pascalCaseTables?: boolean;
   readonly camelCaseColumns?: boolean;
   readonly includeEnums?: boolean;
   readonly getColumnName: (columnName: string) => string;
   readonly getTableName: (tableName: string) => string;

   constructor(args: {
      outDir: string;
      getColumnType: (columns: SqlColumnInfo) => SqlColumnType;
      driver: SqlDriver;
      pascalCaseTables?: boolean;
      camelCaseColumns?: boolean;
      includeEnums?: boolean;
   }) {
      this.outDir = args.outDir;
      this.getColumnType = args.getColumnType;
      this.driver = args.driver;
      this.pascalCaseTables = args.pascalCaseTables;
      this.camelCaseColumns = args.camelCaseColumns;
      this.includeEnums = args.includeEnums;
      this.getColumnName = (columnName: string) => (this.camelCaseColumns ? to.camel(columnName) : columnName);
      this.getTableName = (tableName: string) => (this.pascalCaseTables ? to.pascal(tableName) : tableName);
   }

   newWriter() {
      return new CodeBlockWriter.default({
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
