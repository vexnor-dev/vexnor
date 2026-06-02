"use client";

export function SearchInput({
   defaultValue,
   onChange,
}: {
   defaultValue: string;
   onChange?: (value: string) => void;
}) {
   return (
      <div className="relative mb-4">
         <input
            type="search"
            defaultValue={defaultValue}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
         />
      </div>
   );
}
