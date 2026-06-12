export interface CodegenCommandOptions {
   outDir: string;
   uri?: string;
   schema: string[];
   omit?: string[];
   camelCaseColumns?: boolean;
   plugin: string;
   host?: string;
   database?: string;
   user?: string;
   password?: string;
   port?: number;
   config?: string;
   profile?: string;
}
