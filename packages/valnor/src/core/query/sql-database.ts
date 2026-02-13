import { ConnectionConfig, ValnorConnection } from "../../plugin/index.js";

export interface SqlDatabase<Connection> {
   driver: string;

   createConnection<Config extends ConnectionConfig>(config: Config): Promise<ValnorConnection<Connection>>;
}
