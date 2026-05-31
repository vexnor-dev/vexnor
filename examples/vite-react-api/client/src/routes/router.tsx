import { createRootRoute, createRoute, createRouter, Link, Outlet } from "@tanstack/react-router";
import PostgresAccountsPage from "../pages/postgres-accounts";
import MssqlAccountsPage from "../pages/mssql-accounts";
import Sqlite3AccountsPage from "../pages/sqlite3-accounts";
import { useAuth } from "#/auth-context";

function AuthBar() {
   const auth = useAuth();
   // In a real app, login() would receive a JWT from your auth provider (Auth0, Cognito, etc.)
   // Here we simulate it with a hardcoded token for demonstration purposes
   const fakeToken = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyXzEyMyIsInJvbGVzIjpbImFkbWluIl19.signature";
   return (
      <div style={{ padding: "8px", background: "#f0f0f0", marginBottom: "8px" }}>
         {auth.authenticated ? (
            <span>
               Signed in as <strong>{auth.userId}</strong> [{auth.roles.join(", ")}]{" "}
               <button onClick={auth.logout}>Sign out</button>
            </span>
         ) : (
            <span>
               Anonymous <button onClick={() => auth.login(fakeToken)}>Sign in (demo)</button>
            </span>
         )}
      </div>
   );
}

const rootRoute = createRootRoute({
   component: () => (
      <>
         <AuthBar />
         <nav>
            <Link to="/postgres">PostgreSQL</Link>
            {" | "}
            <Link to="/mssql">MS SQL Server</Link>
            {" | "}
            <Link to="/sqlite3">SQLite3</Link>
         </nav>
         <Outlet />
      </>
   ),
});

const postgresRoute = createRoute({
   getParentRoute: () => rootRoute,
   path: "/postgres",
   component: PostgresAccountsPage,
});

const mssqlRoute = createRoute({
   getParentRoute: () => rootRoute,
   path: "/mssql",
   component: MssqlAccountsPage,
});

const sqlite3Route = createRoute({
   getParentRoute: () => rootRoute,
   path: "/sqlite3",
   component: Sqlite3AccountsPage,
});

const indexRoute = createRoute({
   getParentRoute: () => rootRoute,
   path: "/",
   component: () => <p>Select a database above.</p>,
});

const routeTree = rootRoute.addChildren([indexRoute, postgresRoute, mssqlRoute, sqlite3Route]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
   interface Register {
      router: typeof router;
   }
}
