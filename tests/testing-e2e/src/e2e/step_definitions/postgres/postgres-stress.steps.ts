import { When, Then, Given, And } from "@cucumber/cucumber";
import { TestWorld } from "@/e2e/test-world.js";
import { Account, Order, OrderItem, Product } from "@/codegen/postgres/one_sql.schema.js";
import { ok, deepStrictEqual } from "node:assert";
import { pool } from "@/db/postgres.js";
import { raw, sql } from "valnor";
import { IProductSelect } from "@/codegen/postgres/one_sql.product-table.js";
import { IAccountSelect } from "@/codegen/postgres/one_sql.account-table.js";
import { IOrderSelect } from "@/codegen/postgres/one_sql.order-table.js";
import { IOrderItemSelect } from "@/codegen/postgres/one_sql.order_item-table.js";

Given("the database is clean", async function (this: TestWorld) {
   await pool.query(
      "TRUNCATE one_sql.order_item, one_sql.order, one_sql.product, one_sql.account RESTART IDENTITY CASCADE",
   );
});

When("I insert a product with the following metadata:", async function (this: TestWorld, docString: string) {
   const metadata = JSON.parse(docString);
   const label = metadata.specs.screen_size === "1.5 inch" ? "Smartwatch" : "Smart Display";
   const price = metadata.specs.screen_size === "1.5 inch" ? 299.99 : 129.99;

   this.pg.productInserted = await sql<IProductSelect>`
        INSERT INTO ${Product}
            ${Product.$$values({
               label: label,
               price: String(price),
               metadata: metadata,
            })}
        RETURNING ${Product.$$all}
    `.pg.getOneRequired({ db: pool });
});

Then("I should be able to retrieve the product and its metadata", async function (this: TestWorld) {
   ok(this.pg.productInserted, "Product should have been inserted in a previous step");
   const product = await sql<IProductSelect>`
        SELECT ${Product.$$all}
        FROM ${Product}
        WHERE ${Product.productId} = ${this.pg.productInserted.productId}
    `.pg.getOneRequired({ db: pool });

   deepStrictEqual(product.metadata, this.pg.productInserted.metadata);
});

When("I query for products with screen size {string}", async function (this: TestWorld, screenSize: string) {
   const products = await sql<IProductSelect>`
        SELECT ${Product.$$all}
        FROM ${Product}
        WHERE ${raw(`metadata->'specs'->>'screen_size'`)} = ${screenSize}
    `.pg.getAll({ db: pool });

   this.pg.productsSelected = products;
});

When("I query for products with the tag {string}", async function (this: TestWorld, tag: string) {
   const products = await sql<IProductSelect>`
        SELECT ${Product.$$all}
        FROM ${Product}
        WHERE ${raw(`metadata->'tags'`)} @> ${JSON.stringify([tag])}
    `.pg.getAll({ db: pool });

   this.pg.productsSelected = products;
});

Then("I should find {int} product", function (this: TestWorld, count: number) {
   ok(this.pg.productsSelected, "Products should have been selected in a previous step");
   deepStrictEqual(this.pg.productsSelected.length, count);
});

When("I update the battery life of the product to {string}", async function (this: TestWorld, batteryLife: string) {
   ok(this.pg.productInserted, "Product should have been inserted in a previous step");
   this.pg.productInserted = await sql<IProductSelect>`
        UPDATE ${Product}
        SET metadata = jsonb_set(metadata, '{specs,battery_life}', to_jsonb(${batteryLife}::text))
        WHERE ${Product.productId} = ${this.pg.productInserted.productId}
        RETURNING ${Product.$$all}
    `.pg.getOneRequired({ db: pool });
});

Then("the product's battery life should be {string}", function (this: TestWorld, expectedBatteryLife: string) {
   ok(this.pg.productInserted?.metadata?.specs, "Product with metadata and specs should exist");
   deepStrictEqual(this.pg.productInserted.metadata.specs.battery_life, expectedBatteryLife);
});

Given("an account exists", async function (this: TestWorld) {
   this.pg.accountInserted = await sql<IAccountSelect>`
        INSERT INTO ${Account}
            ${Account.$values({
               firstName: "John",
               lastName: "Doe",
               email: "john.doe@example.com",
            })}
        RETURNING ${Account.$$all}
    `.pg.getOneRequired({ db: pool });
});

And("I create an order for the product", async function (this: TestWorld) {
   ok(this.pg.accountInserted, "Account should have been inserted in a previous step");
   ok(this.pg.productInserted, "Product should have been inserted in a previous step");

   const order = await sql<IOrderSelect>`
        INSERT INTO ${Order}
            ${Order.$values({ accountId: this.pg.accountInserted.accountId, createdAt: new Date(), modifiedAt: new Date() })}
        RETURNING ${Order.$$all}
    `.pg.getOneRequired({ db: pool });

   await sql<IOrderItemSelect>`
        INSERT INTO ${OrderItem}
            ${OrderItem.$values({
               orderId: order.orderId,
               productId: this.pg.productInserted.productId,
               productPrice: this.pg.productInserted.price,
               quantity: 1,
               createdAt: new Date(),
               modifiedAt: new Date(),
            })}
    `.pg.getOneRequired({ db: pool });
});

When("I query for orders with items tagged as {string}", async function (this: TestWorld, tag: string) {
   const orders = await sql<IOrderSelect>`
        SELECT ${Order.orderId}, ${Order.status}, ${Order.accountId}, ${Order.createdAt}, ${Order.modifiedAt}
        FROM ${Order}
        JOIN ${OrderItem} ON ${OrderItem.orderId} = ${Order.orderId}
        JOIN ${Product} ON ${Product.productId} = ${OrderItem.productId}
        WHERE ${sql.raw(`one_sql.product.metadata->'tags'`)} @> ${JSON.stringify([tag])}
    `.pg.getAll({ db: pool });

   this.pg.ordersSelected = orders;
});

Then("I should find {int} order", function (this: TestWorld, count: number) {
   ok(this.pg.ordersSelected, "Orders should have been selected in a previous step");
   deepStrictEqual(this.pg.ordersSelected.length, count);
});

When(
   "I insert a product with the tags {string} and {string}",
   async function (this: TestWorld, tag1: string, tag2: string) {
      this.pg.productInserted = await sql<IProductSelect>`
        INSERT INTO ${Product}
            ${Product.$values({
               label: "Tagged Product",
               price: 10.0,
               tags: [tag1, tag2],
            })}
        RETURNING ${Product.$$all}
    `.pg.getOneRequired({ db: pool });
   },
);

Then("I should be able to retrieve the product and its tags", async function (this: TestWorld) {
   ok(this.pg.productInserted, "Product should have been inserted in a previous step");
   const product = await sql<IProductSelect>`
        SELECT ${Product.$$all}
        FROM ${Product}
        WHERE ${Product.productId} = ${this.pg.productInserted.productId}
    `.pg.getOneRequired({ db: pool });

   deepStrictEqual(product.tags, this.pg.productInserted.tags);
});

When("I query for products with the array tag {string}", async function (this: TestWorld, tag: string) {
   const products = await sql<IProductSelect>`
        SELECT ${Product.$$all}
        FROM ${Product}
        WHERE ${tag} = ANY(${Product.tags})
    `.pg.getAll({ db: pool });
   this.pg.productsSelected = products;
});

When(
   "I query for products with any of the array tags {string} or {string}",
   async function (this: TestWorld, tag1: string, tag2: string) {
      const products = await sql<IProductSelect>`
        SELECT ${Product.$$all}
        FROM ${Product}
        WHERE ${Product.tags} && ${[tag1, tag2]}
    `.pg.getAll({ db: pool });
      this.pg.productsSelected = products;
   },
);
