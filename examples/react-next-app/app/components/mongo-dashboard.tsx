"use client";

interface DashboardProps {
   revenue: { _id: string; orderCount: number; totalItems: number }[];
   brands: { _id: string; orderCount: number; totalQuantity: number }[];
   countries: { _id: string; count: number; avgPrice: number }[];
   sizes: { _id: string; label: string; volume: number; brand: string }[];
}

export function MongoDashboard({ revenue, brands, countries, sizes }: DashboardProps) {
   return (
      <section className="mb-10">
         <h2 className="text-lg font-medium text-gray-800 mb-1">Aggregation Dashboard</h2>
         <p className="text-xs text-gray-400 mb-4">
            Pipeline: $unwind → $group → $project → $sort (computed from embedded items arrays)
         </p>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Revenue by Status */}
            <div className="border border-gray-200 rounded-lg p-4">
               <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                  Orders by Status
               </h3>
               <div className="space-y-2">
                  {revenue.map((r) => (
                     <div key={r._id} className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">{r._id}</span>
                        <span className="text-xs text-gray-500">
                           {r.orderCount} orders · {r.totalItems} items
                        </span>
                     </div>
                  ))}
               </div>
            </div>

            {/* Top Brands */}
            <div className="border border-gray-200 rounded-lg p-4">
               <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                  Top Brands (from items.metadata.brand)
               </h3>
               <div className="space-y-2">
                  {brands.slice(0, 5).map((b) => (
                     <div key={b._id} className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">{b._id}</span>
                        <span className="text-xs text-gray-500">{b.totalQuantity} units</span>
                     </div>
                  ))}
               </div>
            </div>

            {/* Products by Country */}
            <div className="border border-gray-200 rounded-lg p-4">
               <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                  Products by Country (metadata.countryOfOrigin)
               </h3>
               <div className="space-y-2">
                  {countries.map((c) => (
                     <div key={c._id} className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">{c._id}</span>
                        <span className="text-xs text-gray-500">
                           {c.count} products · avg ${c.avgPrice.toFixed(0)}
                        </span>
                     </div>
                  ))}
               </div>
            </div>

            {/* Largest Products by Volume */}
            <div className="border border-gray-200 rounded-lg p-4">
               <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                  Largest Products (dimensions volume)
               </h3>
               <div className="space-y-2">
                  {sizes.slice(0, 5).map((s) => (
                     <div key={s._id} className="flex justify-between items-center">
                        <div>
                           <span className="text-sm font-medium text-gray-700">{s.label}</span>
                           <span className="text-xs text-gray-400 ml-1">({s.brand})</span>
                        </div>
                        <span className="text-xs text-gray-500">{s.volume} cm³</span>
                     </div>
                  ))}
               </div>
            </div>
         </div>
      </section>
   );
}
