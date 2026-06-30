import { Link } from "@tanstack/react-router";

const databases = [
   {
      to: "/postgres" as const,
      name: "PostgreSQL",
      badge: "pg",
      description: "Filtered accounts with use(Promise) + Suspense. Auth-aware remoteClient passes JWT to /api/db.",
   },
   {
      to: "/mssql" as const,
      name: "MS SQL Server",
      badge: "mssql",
      description: "Same pattern using the mssql driver. FOR JSON PATH aggregation for nested lastOrder.",
   },
   {
      to: "/sqlite3" as const,
      name: "SQLite3",
      badge: "better-sqlite3",
      description: "Synchronous better-sqlite3 wrapped in Promise.resolve(). Same query API as the other drivers.",
   },
];

const highlights = [
   {
      title: "Isomorphic queries",
      body: "One query definition in shared/queries/ runs on the server (Hono) and from the browser via remoteClient — no duplication.",
   },
   {
      title: "QueryRegistry",
      body: "The server registers queries by hash at startup. The client dispatches by hash — raw SQL never crosses the wire.",
   },
   {
      title: "use(Promise) + Suspense",
      body: "Data fetching uses React's built-in streaming primitives. No useEffect, no loading state boilerplate.",
   },
   {
      title: "URL-driven filtering",
      body: "?filter=john drives server-side SQL filtering via param(). Shareable, bookmarkable, works on back/forward.",
   },
];

const keyFiles = [
   ["shared/queries/", "Query definitions — shared between client and server"],
   ["server/src/server.ts", "Hono server — QueryRegistry + /api/db endpoint"],
   ["client/src/remote-client.ts", "Static remoteClient (no auth)"],
   ["client/src/use-remote-client.ts", "Auth-aware remoteClient hook"],
   ["client/src/pages/postgres-accounts.tsx", "use(Promise) + Suspense pattern"],
];

export default function HomePage() {
   return (
      <div className="page">
         <h1>Vexnor — React + Vite + Hono</h1>
         <p style={{ color: "#6b7280", marginBottom: "40px", fontSize: "15px" }}>
            Isomorphic SQL execution across PostgreSQL, MS SQL Server, and SQLite3.
            Same query, same API — runs on the server and from the browser.
         </p>

         <section style={{ marginBottom: "40px" }}>
            <div className="section-label">Explore</div>
            <div className="home-cards">
               {databases.map((db) => (
                  <Link key={db.to} to={db.to} search={{ filter: undefined }} className="home-card">
                     <div className="home-card-top">
                        <span className="badge">{db.badge}</span>
                        <span className="home-card-name">{db.name}</span>
                     </div>
                     <p className="home-card-desc">{db.description}</p>
                  </Link>
               ))}
            </div>
         </section>

         <section style={{ marginBottom: "40px" }}>
            <div className="section-label">What to look at</div>
            <div className="highlight-grid">
               {highlights.map((h) => (
                  <div key={h.title} className="highlight-card">
                     <p className="highlight-title">{h.title}</p>
                     <p className="highlight-body">{h.body}</p>
                  </div>
               ))}
            </div>
         </section>

         <section>
            <div className="section-label">Key files</div>
            <div className="file-list">
               {keyFiles.map(([path, desc]) => (
                  <div key={path} className="file-row">
                     <span className="file-path">{path}</span>
                     <span className="file-desc">{desc}</span>
                  </div>
               ))}
            </div>
         </section>
      </div>
   );
}
