import { SqlTableInfo } from "../../plugin/index.js";
import { x } from "../../x.js";

export interface SqlOutputFile {
   schemaName: string;
   moduleName: string;
   fileName: string;
   tableTypeName?: string;
}

export type SqlDriver = "pg" | "postgres.js" | "mssql" | "mysql";

export const SqlDrivers: SqlDriver[] = x(() => {
   return Object.keys({
      pg: null,
      "postgres.js": null,
      mssql: null,
      mysql: null,
   } satisfies Record<SqlDriver, null>) as SqlDriver[];
});

export interface CommandOptions {
   outDir: string;
   uri?: string;
   schema: string[];
   pascalCaseTables?: boolean;
   camelCaseColumns?: boolean;
   driver: "pg" | "postgres.js";
   host?: string;
   database?: string;
   user?: string;
   password?: string;
   port?: number;
}

export interface PrintTableArgs {
   table: SqlTableInfo;
}
