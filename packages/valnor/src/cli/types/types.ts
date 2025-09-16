export interface CommandOptions {
   outDir: string;
   uri?: string;
   schema: string[];
   pascalCaseTables?: boolean;
   camelCaseColumns?: boolean;
   plugin: string;
   host?: string;
   database?: string;
   user?: string;
   password?: string;
   port?: number;
}
