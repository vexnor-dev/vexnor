import { describe, expect, test } from "vitest";
import { VexnorConnection, connect, isVexnorConnection } from "#src/plugin/vexnor-connection.js";

describe("VexnorConnection — uncovered paths", () => {
   test("connect() creates VexnorConnection", () => {
      const fakePool = { query: () => {} };
      const conn = connect(fakePool);
      expect(isVexnorConnection(conn)).toBe(true);
      expect(conn.db).toBe(fakePool);
   });

   test("connect() with pipeline option", () => {
      const fakePool = { query: () => {} };
      const fakePipeline = { execute: () => {} };
      const conn = connect(fakePool, { pipeline: fakePipeline as never });
      expect(conn.pipeline).toBe(fakePipeline);
   });

   test("connect() without pipeline defaults to null", () => {
      const fakePool = { query: () => {} };
      const conn = connect(fakePool);
      expect(conn.pipeline).toBeNull();
   });

   test("close() throws when no close function provided by connect()", async () => {
      const conn = connect({});
      await expect(conn.close()).rejects.toThrow("No close function provided");
   });

   test("VexnorConnection with custom close function", async () => {
      let closed = false;
      const conn = new VexnorConnection({}, () => { closed = true; }, null);
      await conn.close();
      expect(closed).toBe(true);
   });

   test("isVexnorConnection returns false for non-connection", () => {
      expect(isVexnorConnection({})).toBe(false);
      expect(isVexnorConnection(null)).toBe(false);
      expect(isVexnorConnection("string")).toBe(false);
   });
});
