import { IWorldOptions, setWorldConstructor, World } from "@cucumber/cucumber";
import { IAccountSelect } from "./codegen/pg/one_sql.account-table.js";
import { IOrderSelect } from "./codegen/pg/one_sql.order-table.js";
import { AccountWithOrders } from "./types/index.js";

/**
 * Cucumber test world.
 * https://github.com/cucumber/cucumber-js/blob/main/docs/support_files/world.md
 */
export class TestWorld extends World {
   accountInserted?: IAccountSelect;
   ordersInserted?: IOrderSelect[];
   accountSelected?: IAccountSelect;
   accountUpdated?: IAccountSelect;
   accountsWithOrders?: AccountWithOrders[];

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
