import { describe, expect, test, beforeEach } from "vitest";
import { SchemaGraph } from "#src/execution/schema-graph.js";
import { SqlQueryRegistry } from "#src/execution/sql-query-registry.js";
import { SqlTable, newSqlTable, type SqlTableForeignKey } from "#src/core/schema/sql-table.js";
import { SqlQuery } from "#src/core/query/sql-query.js";
import { MockPlugin, MockConnection } from "#src/test/mock-plugin.js";

function makeTable(name: string, columns: Record<string, string>, opts?: { fk?: SqlTableForeignKey[]; pk?: string[]; schema?: string }) {
   return newSqlTable<{ Select: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Delete: true }>({
      crud: { select: true, insert: true, update: true, delete: true },
      tableInfo: { name, schema: opts?.schema ?? "worldcup", alias: null, out: false },
      pk: (opts?.pk ?? ["id"]) as never[],
      fk: opts?.fk,
      columns: columns as never,
   });
}

/**
 * Tests that join queries with different target tables produce unique hashes,
 * preventing hash collisions in SqlQueryRegistry.
 *
 * The original bug: SchemaGraph.joinBy() called multiple times from the same root
 * table with different targets would produce queries with identical hashes.
 * SqlQueryRegistry.register() would then overwrite the first entry with the second.
 */
describe("SchemaGraph join hash collision", () => {
   const Match = makeTable("match", {
      matchId: "match_id",
      tournamentId: "tournament_id",
      homeTeamId: "home_team_id",
      awayTeamId: "away_team_id",
      draw: "draw",
   }, {
      pk: ["matchId"],
      fk: [
         { from: ["tournamentId"], to: { schema: "worldcup", table: "tournament", columns: ["tournamentId"] } },
         { from: ["homeTeamId"], to: { schema: "worldcup", table: "team", columns: ["teamId"] } },
         { from: ["awayTeamId"], to: { schema: "worldcup", table: "team", columns: ["teamId"] } },
      ],
   });

   const Tournament = makeTable("tournament", {
      tournamentId: "tournament_id",
      year: "year",
      tournamentName: "tournament_name",
   }, { pk: ["tournamentId"] });

   const Team = makeTable("team", {
      teamId: "team_id",
      teamName: "team_name",
   }, { pk: ["teamId"] });

   let graph: SchemaGraph;

   beforeEach(() => {
      SqlTable.clearRegistry();
      SqlTable.register(Match);
      SqlTable.register(Tournament);
      SqlTable.register(Team);
      graph = new SchemaGraph({ Match, Tournament, Team });
   });

   /** Assert that JoinResult.query is a SqlQuery instance and return it with proper type narrowing */
   function assertQuery(joinResult: { query: unknown }): SqlQuery<{ Row: unknown; Params: unknown }> {
      expect(joinResult.query).toBeInstanceOf(SqlQuery);
      if (!(joinResult.query instanceof SqlQuery)) throw new Error("unreachable");
      return joinResult.query;
   }

   describe("joinBy() hash uniqueness", () => {
      test("different join targets from same root must produce different query hashes", async () => {
         // First join: match → tournament
         const joinA = graph.joinBy("worldcup.match", [{ table: "worldcup.tournament" }]);
         expect(joinA).not.toBeNull();

         // Second join: match → tournament + team
         const joinB = graph.joinBy("worldcup.match", [{ table: "worldcup.tournament" }, { table: "worldcup.team" }]);
         expect(joinB).not.toBeNull();

         const queryA = assertQuery(joinA!);
         const queryB = assertQuery(joinB!);

         const hashA = await queryA.hash;
         const hashB = await queryB.hash;

         // These MUST be different — if they're the same, registering both in SqlQueryRegistry
         // causes the second to overwrite the first, breaking the first query's joinBy.
         expect(hashA).not.toBe(hashB);
      });

      test("same join targets from same root must produce same hash (idempotent)", async () => {
         const joinA = graph.joinBy("worldcup.match", [{ table: "worldcup.tournament" }]);
         const joinB = graph.joinBy("worldcup.match", [{ table: "worldcup.tournament" }]);

         const queryA = assertQuery(joinA!);
         const queryB = assertQuery(joinB!);

         const hashA = await queryA.hash;
         const hashB = await queryB.hash;

         // Same join path should produce same hash
         expect(hashA).toBe(hashB);
      });

      test("single target vs same target with join type still produces same hash", async () => {
         // Join types don't affect the hash — they're runtime behavior (passed via joinBy params)
         const joinA = graph.joinBy("worldcup.match", [{ table: "worldcup.tournament" }]);
         const joinB = graph.joinBy("worldcup.match", [{ table: "worldcup.tournament", type: "left" }]);

         const queryA = assertQuery(joinA!);
         const queryB = assertQuery(joinB!);

         const hashA = await queryA.hash;
         const hashB = await queryB.hash;

         // Same tables = same hash, even with different join types
         expect(hashA).toBe(hashB);
      });
   });

   describe("join() direct — hash uniqueness", () => {
      test("Table.join() with different join maps produces different hashes", async () => {
         // Single table join
         const queryA = Match.join({ tournament: Tournament }).select({});
         // Multi-table join
         const queryB = Match.join({ tournament: Tournament, team: Team }).select({});

         const hashA = await queryA.hash;
         const hashB = await queryB.hash;

         expect(hashA).not.toBe(hashB);
      });

      test("Table.join() with same join map produces same hash", async () => {
         const queryA = Match.join({ tournament: Tournament }).select({});
         const queryB = Match.join({ tournament: Tournament }).select({});

         const hashA = await queryA.hash;
         const hashB = await queryB.hash;

         expect(hashA).toBe(hashB);
      });

      test("join map key order does not affect hash (sorted internally)", async () => {
         const queryA = Match.join({ team: Team, tournament: Tournament }).select({});
         const queryB = Match.join({ tournament: Tournament, team: Team }).select({});

         const hashA = await queryA.hash;
         const hashB = await queryB.hash;

         expect(hashA).toBe(hashB);
      });
   });

   describe("SqlQueryRegistry — both queries coexist after registration", () => {
      test("registering two join queries from same root stores both independently", async () => {
         const plugin = new MockPlugin({ name: "@vexnor/postgres" });
         const registry = new SqlQueryRegistry();

         const joinA = graph.joinBy("worldcup.match", [{ table: "worldcup.tournament" }]);
         const joinB = graph.joinBy("worldcup.match", [{ table: "worldcup.tournament" }, { table: "worldcup.team" }]);

         const queryA = assertQuery(joinA!);
         const queryB = assertQuery(joinB!);

         // Register both under the same plugin
         await registry.register(plugin, {
            join_match_tournament: queryA,
            join_match_tournament_team: queryB,
         });

         const registered = registry.getRegisteredQueries();
         const names = registered.map((q) => q.name).sort();

         // Both must be present — the second must NOT overwrite the first
         expect(names).toMatchInlineSnapshot(`
           [
             "join_match_tournament",
             "join_match_tournament_team",
           ]
         `);

         // Verify they have different hashes
         const hashes = new Set(registered.map((q) => q.hash));
         expect(hashes.size).toBe(2);
      });

      test("executing each registered join query resolves to the correct entry", async () => {
         const plugin = new MockPlugin({ name: "@vexnor/postgres" });
         const registry = new SqlQueryRegistry();

         const joinA = graph.joinBy("worldcup.match", [{ table: "worldcup.tournament" }]);
         const joinB = graph.joinBy("worldcup.match", [{ table: "worldcup.tournament" }, { table: "worldcup.team" }]);

         const queryA = assertQuery(joinA!);
         const queryB = assertQuery(joinB!);

         await registry.register(plugin, {
            join_match_tournament: queryA,
            join_match_tournament_team: queryB,
         });

         const hashA = await queryA.hash;
         const hashB = await queryB.hash;

         // Execute both — each should resolve without QUERY_NOT_FOUND
         const makeDb = (): MockConnection => ({ query: async () => ({ rows: [] }) }) as MockConnection;

         const resultA = await registry.execute(
            { hash: hashA, plugin: "@vexnor/postgres", params: { limit: 10 }, mode: "read", name: null, location: "test" },
            async () => makeDb(),
         );
         const resultB = await registry.execute(
            { hash: hashB, plugin: "@vexnor/postgres", params: { limit: 10 }, mode: "read", name: null, location: "test" },
            async () => makeDb(),
         );

         // Both execute successfully (empty result sets, but no errors)
         expect(resultA).toEqual({ rows: [] });
         expect(resultB).toEqual({ rows: [] });
      });
   });
});
