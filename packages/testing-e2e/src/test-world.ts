import { IWorldOptions, setWorldConstructor, World } from "@cucumber/cucumber";
import { IAccountSelect as IAccountSelectPg } from "./codegen/postgres/one_sql.account-table.js";
import { IOrderSelect as IOrderSelectPg } from "./codegen/postgres/one_sql.order-table.js";
import { IAccountSelect as IAccountSelectSqlite } from "./codegen/sqlite/main.account-table.js";
import { IOrderSelect as IOrderSelectSqlite } from "./codegen/sqlite/main.order-table.js";
import { IAccountSelect as IAccountSelectMssql } from "./codegen/mssql/one_sql.account-table.js";
import { IOrderSelect as IOrderSelectMssql } from "./codegen/mssql/one_sql.order-table.js";
import { AccountWithOrders } from "./types/index.js";

/**
 * Cucumber test world.
 * https://github.com/cucumber/cucumber-js/blob/main/docs/support_files/world.md
 */
export class TestWorld extends World {
   pg: {
      accountInserted?: IAccountSelectPg;
      ordersInserted?: IOrderSelectPg[];
      accountSelected?: IAccountSelectPg;
      accountUpdated?: IAccountSelectPg;
      accountsWithOrders?: AccountWithOrders[];
   } = {};

   sqlite: {
      accountInserted?: IAccountSelectSqlite;
      ordersInserted?: IOrderSelectSqlite[];
      accountSelected?: IAccountSelectSqlite;
      accountUpdated?: IAccountSelectSqlite;
      accountsWithOrders?: AccountWithOrders[];
   } = {};

   mssql: {
      accountInserted?: IAccountSelectMssql;
      ordersInserted?: IOrderSelectMssql[];
      accountSelected?: IAccountSelectMssql;
      accountUpdated?: IAccountSelectMssql;
      accountsWithOrders?: AccountWithOrders[];
   } = {};

   constructor({ log, ...args }: IWorldOptions) {
      super({
         ...args,
         log: logger(log),
      });
   }
}

const logger = (log: IWorldOptions["log"]) => (message: string) => {
   console.log(message);
   log(message);
};

// Register the custom world
setWorldConstructor(TestWorld);
