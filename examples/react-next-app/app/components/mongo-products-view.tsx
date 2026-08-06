"use client";

import { useState, useTransition } from "react";
import { findProductsByTag, findProductsByBrand, findProductsByColor } from "@/shared/queries/mongodb";
import { useRemoteClient } from "@/app/components/use-remote-client";

interface Product {
   _id: string;
   label: string;
   price: number;
   discount: number | null;
   availability: { isAvailable: boolean; isPublished: boolean };
   metadata: {
      brand: string;
      weight: number;
      dimensions: { width: number; height: number; depth: number };
      colors: string[];
      countryOfOrigin: string;
      releaseDate: string;
      isRecyclable: boolean;
   } | null;
   tags: string[];
}

type QueryMode = "tag" | "brand" | "color";

const TAGS = ["electronics", "gadgets", "premium", "basics", "budget", "eco-friendly"];
const BRANDS = ["WidgetCo", "PremiumCo", "TechCorp", "GadgetInc", "NanoBuild"];
const COLORS = ["midnight-blue", "silver", "gold", "matte-black", "white", "red"];

export function MongoProductsView({ initialProducts }: { initialProducts: Product[] }) {
   const remoteClient = useRemoteClient();
   const [isPending, startTransition] = useTransition();
   const [products, setProducts] = useState<Product[]>(initialProducts);
   const [mode, setMode] = useState<QueryMode>("tag");
   const [filterValue, setFilterValue] = useState("electronics");

   function search(queryMode: QueryMode, value: string) {
      setMode(queryMode);
      setFilterValue(value);
      startTransition(async () => {
         let result: Product[];
         switch (queryMode) {
            case "tag":
               result = await findProductsByTag.all({ db: remoteClient, params: { tag: value } });
               break;
            case "brand":
               result = await findProductsByBrand.all({ db: remoteClient, params: { brand: value } });
               break;
            case "color":
               result = await findProductsByColor.all({ db: remoteClient, params: { color: value } });
               break;
         }
         setProducts(result);
      });
   }

   return (
      <section className="mb-10">
         <h2 className="text-lg font-medium text-gray-800 mb-1">Products — Nested Metadata Queries</h2>
         <p className="text-xs text-gray-400 mb-4">
            Dot-path queries: tags (scalar array), metadata.brand (nested object), metadata.colors (nested array)
         </p>

         {/* Query mode tabs */}
         <div className="flex gap-4 mb-4 border-b border-gray-200">
            {([
               { key: "tag" as const, label: "By Tag (array field)" },
               { key: "brand" as const, label: "By Brand (metadata.brand)" },
               { key: "color" as const, label: "By Color (metadata.colors[])" },
            ]).map(({ key, label }) => (
               <button
                  key={key}
                  onClick={() => search(key, key === "tag" ? "electronics" : key === "brand" ? "WidgetCo" : "silver")}
                  className={`pb-2 text-xs font-medium transition-colors border-b-2 ${
                     mode === key
                        ? "border-gray-900 text-gray-900"
                        : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
               >
                  {label}
               </button>
            ))}
         </div>

         {/* Filter chips */}
         <div className="flex flex-wrap gap-2 mb-4">
            {(mode === "tag" ? TAGS : mode === "brand" ? BRANDS : COLORS).map((v) => (
               <button
                  key={v}
                  onClick={() => search(mode, v)}
                  className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                     filterValue === v
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
               >
                  {v}
               </button>
            ))}
         </div>

         {/* Product cards */}
         <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 ${isPending ? "opacity-60" : ""}`}>
            {products.map((p) => (
               <div key={p._id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                     <span className="text-sm font-medium text-gray-800">{p.label}</span>
                     <div className="text-right">
                        <span className="text-sm font-semibold text-gray-900">${p.price.toFixed(2)}</span>
                        {p.discount && (
                           <span className="text-xs text-green-600 block">-${p.discount.toFixed(2)}</span>
                        )}
                     </div>
                  </div>
                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mb-2">
                     {p.tags.map((t) => (
                        <span key={t} className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-500">{t}</span>
                     ))}
                  </div>
                  {/* Nested metadata */}
                  {p.metadata && (
                     <div className="text-xs text-gray-400 space-y-0.5">
                        <div>{p.metadata.brand} · {p.metadata.countryOfOrigin} · {p.metadata.weight}kg</div>
                        <div>{p.metadata.dimensions.width}×{p.metadata.dimensions.height}×{p.metadata.dimensions.depth} cm</div>
                        <div className="flex gap-1 flex-wrap">
                           {p.metadata.colors.map((c) => (
                              <span key={c} className="px-1 py-0.5 bg-blue-50 text-blue-500 rounded">{c}</span>
                           ))}
                        </div>
                     </div>
                  )}
                  {!p.metadata && <div className="text-xs text-gray-300 italic">No metadata</div>}
               </div>
            ))}
            {products.length === 0 && (
               <p className="col-span-3 text-center text-gray-400 py-8">No products found</p>
            )}
         </div>
      </section>
   );
}
