import { createRootRoute, createRoute, createRouter, Link, Outlet, useNavigate } from "@tanstack/react-router";
import HomePage from "../pages/home";
import PostgresAccountsPage from "../pages/postgres-accounts";
import MssqlAccountsPage from "../pages/mssql-accounts";
import Sqlite3AccountsPage from "../pages/sqlite3-accounts";
import Sqlite3LoginPage from "../pages/sqlite3-login";
import PostgresLoginPage from "../pages/postgres-login";
import MssqlLoginPage from "../pages/mssql-login";
import { useAuthSessions, type DbKey } from "#/auth-context";

const DB_LABELS: Record<DbKey, string> = {
   postgres: "PostgreSQL",
   mssql: "MS SQL",
   sqlite3: "SQLite3",
};

const DB_LOGIN_PATHS: Record<DbKey, string> = {
   postgres: "/postgres-login",
   mssql: "/mssql-login",
   sqlite3: "/sqlite3-login",
};

function AuthBar() {
   const { postgres, mssql, sqlite3, logout } = useAuthSessions();
   const sessions: Record<DbKey, ReturnType<typeof useAuthSessions>[DbKey]> = { postgres, mssql, sqlite3 };
   const navigate = useNavigate();

   return (
      <div className="auth-bar">
         {(Object.entries(sessions) as [DbKey, typeof postgres][]).map(([db, s], i) => (
            <span key={db} className="auth-bar-session">
               {i > 0 && <span className="auth-bar-sep">·</span>}
               <span className="auth-bar-db">{DB_LABELS[db]}</span>
               {s.authenticated ? (
                  <>
                     {" · "}<strong>{s.name.split(" ")[0]}</strong>
                     <button className="btn btn-ghost" onClick={() => logout(db)}>Sign out</button>
                  </>
               ) : (
                  <>
                     {" · "}<span className="auth-bar-anon">Anonymous</span>
                     <button className="btn btn-ghost" onClick={() => void navigate({ to: DB_LOGIN_PATHS[db] as "/postgres-login" | "/mssql-login" | "/sqlite3-login" })}>Sign in</button>
                  </>
               )}
            </span>
         ))}
      </div>
   );
}

const rootRoute = createRootRoute({
   component: () => (
      <div className="layout">
         <AuthBar />
         <nav className="nav">
            <Link to="/" activeProps={{ className: "active" }} activeOptions={{ exact: true }}>Home</Link>
            <Link to="/postgres" search={{ filter: undefined }} activeProps={{ className: "active" }}>PostgreSQL</Link>
            <Link to="/mssql" search={{ filter: undefined }} activeProps={{ className: "active" }}>MS SQL Server</Link>
            <Link to="/sqlite3" search={{ filter: undefined }} activeProps={{ className: "active" }}>SQLite3</Link>
         </nav>
         <Outlet />
      </div>
   ),
});

const sqlite3LoginRoute = createRoute({
   getParentRoute: () => rootRoute,
   path: "/sqlite3-login",
   component: Sqlite3LoginPage,
});

const postgresLoginRoute = createRoute({
   getParentRoute: () => rootRoute,
   path: "/postgres-login",
   component: PostgresLoginPage,
});

const mssqlLoginRoute = createRoute({
   getParentRoute: () => rootRoute,
   path: "/mssql-login",
   component: MssqlLoginPage,
});

const postgresRoute = createRoute({
   getParentRoute: () => rootRoute,
   path: "/postgres",
   validateSearch: (search: Record<string, unknown>) => ({
      filter: typeof search.filter === "string" ? search.filter : undefined,
   }),
   component: PostgresAccountsPage,
});

const mssqlRoute = createRoute({
   getParentRoute: () => rootRoute,
   path: "/mssql",
   validateSearch: (search: Record<string, unknown>) => ({
      filter: typeof search.filter === "string" ? search.filter : undefined,
   }),
   component: MssqlAccountsPage,
});

const sqlite3Route = createRoute({
   getParentRoute: () => rootRoute,
   path: "/sqlite3",
   validateSearch: (search: Record<string, unknown>) => ({
      filter: typeof search.filter === "string" ? search.filter : undefined,
   }),
   component: Sqlite3AccountsPage,
});

const indexRoute = createRoute({
   getParentRoute: () => rootRoute,
   path: "/",
   component: HomePage,
});

const routeTree = rootRoute.addChildren([
   indexRoute,
   sqlite3LoginRoute,
   postgresLoginRoute,
   mssqlLoginRoute,
   postgresRoute,
   mssqlRoute,
   sqlite3Route,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
   interface Register {
      router: typeof router;
   }
}
