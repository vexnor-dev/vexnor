import { ConnectionConfig, ValnorConnection } from "../../plugin/index.js";

export interface SqlDatabase {
   driver: string;

   createConnection<Config extends ConnectionConfig>(config: Config): Promise<ValnorConnection<any>>;
}
