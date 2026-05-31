import { createRootRoute, createRoute, createRouter, Link, Outlet } from "@tanstack/react-router";
import HomePage from "../pages/home";
import PostgresAccountsPage from "../pages/postgres-accounts";
import MssqlAccountsPage from "../pages/mssql-accounts";
import Sqlite3AccountsPage from "../pages/sqlite3-accounts";
import { useAuth } from "#/auth-context";

function AuthBar() {
   const auth = useAuth();
   const fakeToken = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyXzEyMyIsInJvbGVzIjpbImFkbWluIl19.signature";
   return (
      <div className="auth-bar">
         {auth.authenticated ? (
            <>
               Signed in as <strong>{auth.userId}</strong> [{auth.roles.join(", ")}]
               <button className="btn btn-ghost" onClick={auth.logout}>Sign out</button>
            </>
         ) : (
            <>
               Anonymous
               <button className="btn btn-ghost" onClick={() => auth.login(fakeToken)}>Sign in (demo)</button>
            </>
         )}
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

const routeTree = rootRoute.addChildren([indexRoute, postgresRoute, mssqlRoute, sqlite3Route]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
   interface Register {
      router: typeof router;
   }
}
