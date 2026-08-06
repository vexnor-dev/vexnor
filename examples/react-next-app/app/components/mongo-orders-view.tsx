"use client";

import { useState, useTransition } from "react";
import { findOrdersByStatus } from "@/shared/queries/mongodb";
import { useRemoteClient } from "@/app/components/use-remote-client";

interface OrderItem {
   productId: string;
   label: string;
   productPrice: number;
   discountPrice: number | null;
   quantity: number;
   metadata: {
      brand: string;
      weight: number;
      dimensions: { width: number; height: number; depth: number };
      colors: string[];
      countryOfOrigin: string;
      releaseDate: string;
      isRecyclable: boolean;
   } | null;
}

interface Order {
   _id: string;
   status: string;
   accountId: string;
   items: OrderItem[];
   createdAt: Date;
}

export function MongoOrdersView({ initialOrders }: { initialOrders: Order[] }) {
   const remoteClient = useRemoteClient();
   const [isPending, startTransition] = useTransition();
   const [orders, setOrders] = useState<Order[]>(initialOrders);
   const [status, setStatus] = useState("delivered");
   const [expanded, setExpanded] = useState<string | null>(null);

   function refetch(newStatus: string) {
      startTransition(async () => {
         const result = await findOrdersByStatus.all({
            db: remoteClient,
            params: { status: newStatus, limit: 10 },
         });
         setOrders(result);
      });
   }

   return (
      <section className="mb-10">
         <h2 className="text-lg font-medium text-gray-800 mb-1">Orders — Embedded Items Array</h2>
         <p className="text-xs text-gray-400 mb-4">
            Each order has items[] with denormalized product data + nested metadata.dimensions/colors
         </p>

         <div className="flex gap-2 mb-4">
            {["created", "paid", "delivered", "received"].map((s) => (
               <button
                  key={s}
                  onClick={() => { setStatus(s); refetch(s); }}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                     status === s
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
               >
                  {s}
               </button>
            ))}
         </div>

         <div className={`space-y-3 ${isPending ? "opacity-60" : ""}`}>
            {orders.map((order) => (
               <div key={order._id} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Order header */}
                  <div
                     className="px-4 py-3 bg-gray-50 flex justify-between items-center cursor-pointer hover:bg-gray-100"
                     onClick={() => setExpanded(expanded === order._id ? null : order._id)}
                  >
                     <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-gray-500">{order._id}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                           order.status === "delivered" ? "bg-green-100 text-green-700" :
                           order.status === "paid" ? "bg-blue-100 text-blue-700" :
                           order.status === "received" ? "bg-purple-100 text-purple-700" :
                           "bg-yellow-100 text-yellow-700"
                        }`}>{order.status}</span>
                        <span className="text-xs text-gray-400">{order.items.length} items</span>
                     </div>
                     <span className="text-xs text-gray-400">
                        {new Date(order.createdAt).toISOString().slice(0, 10)}
                     </span>
                  </div>

                  {/* Expanded: show items with nested metadata */}
                  {expanded === order._id && (
                     <div className="px-4 py-3 divide-y divide-gray-100">
                        {order.items.map((item, i) => (
                           <div key={i} className="py-2 first:pt-0 last:pb-0">
                              <div className="flex justify-between items-start">
                                 <div>
                                    <span className="text-sm font-medium text-gray-800">{item.label}</span>
                                    <span className="text-xs text-gray-400 ml-2">× {item.quantity}</span>
                                 </div>
                                 <div className="text-right">
                                    <span className="text-sm text-gray-700">${item.productPrice.toFixed(2)}</span>
                                    {item.discountPrice && (
                                       <span className="text-xs text-green-600 ml-1">(${item.discountPrice.toFixed(2)})</span>
                                    )}
                                 </div>
                              </div>
                              {/* Nested metadata — the MongoDB-native part */}
                              {item.metadata && (
                                 <div className="mt-1 flex flex-wrap gap-2 text-xs">
                                    <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                                       {item.metadata.brand}
                                    </span>
                                    <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                                       {item.metadata.dimensions.width}×{item.metadata.dimensions.height}×{item.metadata.dimensions.depth} cm
                                    </span>
                                    <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                                       {item.metadata.weight} kg
                                    </span>
                                    <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                                       {item.metadata.countryOfOrigin}
                                    </span>
                                    {item.metadata.colors.map((c) => (
                                       <span key={c} className="px-1.5 py-0.5 bg-blue-50 rounded text-blue-600">
                                          {c}
                                       </span>
                                    ))}
                                    {item.metadata.isRecyclable && (
                                       <span className="px-1.5 py-0.5 bg-green-50 rounded text-green-600">recyclable</span>
                                    )}
                                 </div>
                              )}
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            ))}
            {orders.length === 0 && (
               <p className="text-center text-gray-400 py-8">No orders found</p>
            )}
         </div>
      </section>
   );
}
