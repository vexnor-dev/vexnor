import { describe, expect, test, beforeEach } from "vitest";
import { confirmPrompt } from "../confirm-prompt.js";
import { Readable, Writable } from "stream";
import type { Interface } from "readline";

describe("confirmPrompt", () => {
   let mockStdin: Readable;
   let mockStdout: Writable;
   let output: string;

   function createMockInterface() {
      return {
         question(prompt: string, callback: (answer: string) => void) {
            output += prompt;
            const answer = mockStdin.read()?.toString().trim() || "";
            callback(answer);
         },
         close() {},
      } as Interface;
   }

   beforeEach(() => {
      output = "";
      mockStdin = new Readable({
         read() {},
      });
      mockStdout = new Writable({
         write(chunk, encoding, callback) {
            output += chunk.toString();
            callback();
         },
      });
   });

   test("returns true for 'y' input", async () => {
      mockStdin.push("y\n");
      mockStdin.push(null);

      const result = await confirmPrompt("Are you sure?", false, createMockInterface);
      expect(result).toBe(true);
      expect(output).toContain("Are you sure? (y/N):");
   });

   test("returns true for 'yes' input", async () => {
      mockStdin.push("yes\n");
      mockStdin.push(null);

      const result = await confirmPrompt("Are you sure?", false, createMockInterface);
      expect(result).toBe(true);
   });

   test("returns false for 'n' input", async () => {
      mockStdin.push("n\n");
      mockStdin.push(null);

      const result = await confirmPrompt("Are you sure?", false, createMockInterface);
      expect(result).toBe(false);
   });

   test("returns false for empty input", async () => {
      mockStdin.push("\n");
      mockStdin.push(null);

      const result = await confirmPrompt("Are you sure?", false, createMockInterface);
      expect(result).toBe(false);
   });

   test("requires exact 'yes' when requireYes is true", async () => {
      mockStdin.push("yes\n");
      mockStdin.push(null);

      const result = await confirmPrompt("Destructive operation", true, createMockInterface);
      expect(result).toBe(true);
      expect(output).toContain("type 'yes' to confirm");
   });

   test("rejects 'y' when requireYes is true", async () => {
      mockStdin.push("y\n");
      mockStdin.push(null);

      const result = await confirmPrompt("Destructive operation", true, createMockInterface);
      expect(result).toBe(false);
   });

   test("rejects 'YES' when requireYes is true", async () => {
      mockStdin.push("YES\n");
      mockStdin.push(null);

      const result = await confirmPrompt("Destructive operation", true, createMockInterface);
      expect(result).toBe(false);
   });

   test("is case insensitive", async () => {
      mockStdin.push("Y\n");
      mockStdin.push(null);

      const result = await confirmPrompt("Are you sure?", false, createMockInterface);
      expect(result).toBe(true);
   });
});
