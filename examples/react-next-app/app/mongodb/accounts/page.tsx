import { mongoDb } from "@/shared/db/mongodb";
import {
   findAccounts,
   findOrdersByStatus,
   findProductsByTag,
   revenueByStatus,
   topBrandsByOrders,
   productsByCountry,
   productsBySize,
} from "@/shared/queries/mongodb";
import { MongoAccountsGrid } from "@/app/components/mongo-accounts-grid";
import { MongoOrdersView } from "@/app/components/mongo-orders-view";
import { MongoDashboard } from "@/app/components/mongo-dashboard";
import { MongoProductsView } from "@/app/components/mongo-products-view";

export default async function MongoDBPage() {
   // Fetch all data server-side in parallel
   const [accounts, orders, products, revenue, brands, countries, sizes] = await Promise.all([
      findAccounts.all({ db: mongoDb, params: { status: "confirmed", limit: 20 } }),
      findOrdersByStatus.all({ db: mongoDb, params: { status: "delivered", limit: 10 } }),
      findProductsByTag.all({ db: mongoDb, params: { tag: "electronics" } }),
      revenueByStatus.all({ db: mongoDb }),
      topBrandsByOrders.all({ db: mongoDb }),
      productsByCountry.all({ db: mongoDb }),
      productsBySize.all({ db: mongoDb }),
   ]);

   return (
      <div className="max-w-7xl mx-auto px-6 py-10">
         <h1 className="text-2xl font-semibold text-gray-900 mb-2">MongoDB</h1>
         <p className="text-gray-500 text-sm mb-8">
            Document-native patterns: embedded arrays, nested objects, aggregation pipelines, denormalized data.
         </p>

         {/* Dashboard — aggregation results */}
         <MongoDashboard revenue={revenue} brands={brands} countries={countries} sizes={sizes} />

         {/* Orders — embedded items with nested metadata */}
         <MongoOrdersView initialOrders={orders} />

         {/* Products — nested metadata, dot-path queries */}
         <MongoProductsView initialProducts={products} />

         {/* Accounts — basic find with status filter */}
         <MongoAccountsGrid initialAccounts={accounts} />
      </div>
   );
}
