import Link from "next/link";

const databases = [
   {
      href: "/postgres/accounts",
      name: "PostgreSQL",
      description: "Server Component fetches directly via pg pool. Mutations use Server Actions.",
      badge: "pg",
   },
   {
      href: "/mssql/accounts",
      name: "MS SQL Server",
      description: "Server Component fetches directly via mssql pool. Mutations use Server Actions.",
      badge: "mssql",
   },
   {
      href: "/sqlite3/accounts",
      name: "SQLite3",
      description: "Server Component fetches directly via better-sqlite3. Mutations use Server Actions.",
      badge: "better-sqlite3",
   },
];

const highlights = [
   {
      title: "Write real SQL",
      body: "Queries are plain tagged template literals — no DSL, no query builder, no ORM magic.",
   },
   {
      title: "Typed results",
      body: "Return types are inferred from exactly what you SELECT. Nothing more, nothing less.",
   },
   {
      title: "Isomorphic execution",
      body: "The same query object runs directly on the server (RSC) or is dispatched from the client via /api/db.",
   },
   {
      title: "Server Components + Server Actions",
      body: "Pages fetch data directly in async Server Components. Create/delete go through Server Actions — no separate API layer needed.",
   },
];

export default function HomePage() {
   return (
      <div className="max-w-3xl mx-auto px-6 py-16">
         <h1 className="text-3xl font-semibold text-gray-900 mb-3">Vexnor — Next.js Example</h1>
         <p className="text-gray-500 text-lg mb-12">
            Isomorphic SQL execution across PostgreSQL, MS SQL Server, and SQLite3 using Next.js App Router.
         </p>

         <section className="mb-12">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Explore</h2>
            <div className="flex flex-col gap-3">
               {databases.map((db) => (
                  <Link
                     key={db.href}
                     href={db.href}
                     className="block p-4 rounded-lg border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all group"
                  >
                     <div className="flex items-center gap-2 mb-1">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-mono font-medium bg-gray-100 text-gray-600 group-hover:bg-gray-200 transition-colors">
                           {db.badge}
                        </span>
                        <p className="font-medium text-gray-900">{db.name}</p>
                     </div>
                     <p className="text-sm text-gray-500">{db.description}</p>
                  </Link>
               ))}
            </div>
         </section>

         <section className="mb-12">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">What to look at</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {highlights.map((h) => (
                  <div key={h.title} className="p-4 rounded-lg border border-gray-200">
                     <p className="font-medium text-gray-900 mb-1">{h.title}</p>
                     <p className="text-sm text-gray-500">{h.body}</p>
                  </div>
               ))}
            </div>
         </section>

         <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Key files</h2>
            <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 text-sm">
               {[
                  ["shared/queries/", "Query definitions — shared between RSC and /api/db"],
                  ["shared/db/", "DB connection singletons (pg, mssql, better-sqlite3)"],
                  ["app/postgres/accounts/page.tsx", "Server Component — fetches directly, Server Actions for mutations"],
                  ["app/mssql/accounts/page.tsx", "Same pattern for MS SQL Server"],
                  ["app/sqlite3/accounts/page.tsx", "Same pattern for SQLite3"],
                  ["app/api/db/route.ts", "QueryRegistry endpoint for remote/client-side execution"],
                  ["instrumentation.ts", "Loads vexnor plugin augments before any module evaluates"],
               ].map(([path, desc]) => (
                  <div key={path} className="px-4 py-3">
                     <p className="font-mono text-gray-900 mb-0.5">{path}</p>
                     <p className="text-gray-400">{desc}</p>
                  </div>
               ))}
            </div>
         </section>
      </div>
   );
}
