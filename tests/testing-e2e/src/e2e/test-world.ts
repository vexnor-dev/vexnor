import { IWorldOptions, setWorldConstructor, World } from "@cucumber/cucumber";
import { IAccountSelect as IAccountSelectPg } from "@/codegen/postgres/one_sql.account-table.js";
import { IOrderSelect as IOrderSelectPg } from "@/codegen/postgres/one_sql.order-table.js";
import { IProductSelect as IProductSelectPg } from '@/codegen/postgres/one_sql.product-table.js';
import { IAccountSelect as IAccountSelectSqlite } from "@/codegen/sqlite/main.account-table.js";
import { IOrderSelect as IOrderSelectSqlite } from "@/codegen/sqlite/main.order-table.js";
import { IProductSelect as IProductSelectSqlite } from '@/codegen/sqlite/main.product-table.js';
import { IAccountSelect as IAccountSelectMssql } from "@/codegen/mssql/one_sql.account-table.js";
import { IOrderSelect as IOrderSelectMssql } from "@/codegen/mssql/one_sql.order-table.js";
import { IProductSelect as IProductSelectMssql } from '@/codegen/mssql/one_sql.product-table.js';
import { AccountWithOrders } from "@/types/index.js";

export interface ITestWorld extends World {
    pg: {
        accountInserted?: IAccountSelectPg;
        ordersInserted?: IOrderSelectPg[];
        accountSelected?: IAccountSelectPg;
        accountUpdated?: IAccountSelectPg;
        accountsWithOrders?: AccountWithOrders[];
        productInserted?: IProductSelectPg;
        productsSelected?: IProductSelectPg[];
        ordersSelected?: IOrderSelectPg[];
    }

    sqlite: {
        accountInserted?: IAccountSelectSqlite;
        ordersInserted?: IOrderSelectSqlite[];
        accountSelected?: IAccountSelectSqlite;
        accountUpdated?: IAccountSelectSqlite;
        accountsWithOrders?: AccountWithOrders[];
        productInserted?: IProductSelectSqlite;
        productsSelected?: IProductSelectSqlite[];
        ordersSelected?: IOrderSelectSqlite[];
    }

    mssql: {
        accountInserted?: IAccountSelectMssql;
        ordersInserted?: IOrderSelectMssql[];
        accountSelected?: IAccountSelectMssql;
        accountUpdated?: IAccountSelectMssql;
        accountsWithOrders?: AccountWithOrders[];
        productInserted?: IProductSelectMssql;
        productsSelected?: IProductSelectMssql[];
        ordersSelected?: IOrderSelectMssql[];
    }
}

/**
 * Cucumber test world.
 * https://github.com/cucumber/cucumber-js/blob/main/docs/support_files/world.md
 */
export class TestWorld extends World implements Omit<ITestWorld, keyof World> {
   pg: ITestWorld['pg'] = {} as ITestWorld['pg'];

   sqlite: ITestWorld['sqlite'] = {} as ITestWorld['sqlite'];

   mssql: ITestWorld['mssql'] = {} as ITestWorld['mssql'];

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
