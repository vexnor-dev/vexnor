"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
   { href: "/", label: "Home", exact: true },
   { href: "/postgres/accounts", label: "PostgreSQL" },
   { href: "/mssql/accounts", label: "MS SQL Server" },
   { href: "/sqlite3/accounts", label: "SQLite3" },
];

export function Nav() {
   const pathname = usePathname();

   return (
      <nav className="border-b border-gray-200 px-6 py-3 flex gap-6 text-sm">
         {links.map(({ href, label, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href.replace("/accounts", ""));
            return (
               <Link
                  key={href}
                  href={href}
                  className={`transition-colors ${active ? "text-gray-900 font-medium" : "text-gray-400 hover:text-gray-700"}`}
               >
                  {label}
               </Link>
            );
         })}
      </nav>
   );
}
