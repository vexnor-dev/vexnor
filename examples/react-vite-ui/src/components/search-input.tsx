import { useRef, useState } from "react";
import { useLocation, useNavigate, useRouterState } from "@tanstack/react-router";

interface SearchInputProps {
   placeholder?: string;
   debounceMs?: number;
}

export function SearchInput({ placeholder = "Search…", debounceMs = 300 }: SearchInputProps) {
   const { search: { filter } } = useLocation();
   const navigate = useNavigate();
   const page = useRouterState();
   const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
   const [value, setValue] = useState<string>(filter ?? "");

   function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const v = e.target.value;
      setValue(v);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
         await navigate({
            to: page.location.pathname,
            search: (params) => ({ ...params, filter: v || undefined }),
         });
      }, debounceMs);
   }

   return (
      <input
         type="search"
         className="search-input"
         value={value}
         onChange={handleChange}
         placeholder={placeholder}
      />
   );
}
