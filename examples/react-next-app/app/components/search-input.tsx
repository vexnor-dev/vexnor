"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition, useRef } from "react";

export function SearchInput({ defaultValue }: { defaultValue: string }) {
   const router = useRouter();
   const pathname = usePathname();
   const searchParams = useSearchParams();
   const [pending, startTransition] = useTransition();
   const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

   function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const value = e.target.value;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
         const params = new URLSearchParams(searchParams.toString());
         if (value) {
            params.set("filter", value);
         } else {
            params.delete("filter");
         }
         startTransition(() => router.replace(`${pathname}?${params.toString()}`));
      }, 300);
   }

   return (
      <div className="relative mb-6">
         <input
            type="search"
            defaultValue={defaultValue}
            onChange={handleChange}
            placeholder="Search by name or email…"
            className={`w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 transition-opacity ${pending ? "opacity-50" : ""}`}
         />
      </div>
   );
}
