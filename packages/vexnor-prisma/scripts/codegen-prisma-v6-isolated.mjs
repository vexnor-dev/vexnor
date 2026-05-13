#!/usr/bin/env node
import { copyFileSync, cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, resolve } from "node:path";
import { spawnSync } from "node:child_process";

/** @param {string} cmd @param {string[]} args @param {import('node:child_process').SpawnSyncOptions} options */
function run(cmd, args, options) {
   const result = spawnSync(cmd, args, options);
   if (result.status !== 0) {
      throw new Error(`Command failed (${result.status}): ${cmd} ${args.join(" ")}`);
   }
}

const passthroughArgs = process.argv.slice(2);
const callerCwd = process.cwd();
const tempDir = mkdtempSync(resolve(tmpdir(), "vexnor-prisma-v6-"));

/** @param {string[]} args */
function normalizePathArgs(args) {
   const output = [];
   for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];
      if (arg === "--schema" || arg === "--config") {
         const value = args[i + 1];
         if (value == null) {
            output.push(arg);
            continue;
         }
         output.push(arg);
         output.push(isAbsolute(value) ? value : resolve(callerCwd, value));
         i += 1;
         continue;
      }
      if (arg.startsWith("--schema=")) {
         const value = arg.slice("--schema=".length);
         output.push(`--schema=${isAbsolute(value) ? value : resolve(callerCwd, value)}`);
         continue;
      }
      if (arg.startsWith("--config=")) {
         const value = arg.slice("--config=".length);
         output.push(`--config=${isAbsolute(value) ? value : resolve(callerCwd, value)}`);
         continue;
      }
      output.push(arg);
   }
   return output;
}

/** @param {string[]} args */
function getArgValue(args, flagName) {
   for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];
      if (arg === flagName) return args[i + 1] ?? null;
      if (arg.startsWith(`${flagName}=`)) return arg.slice(flagName.length + 1);
   }
   return null;
}

const normalizedArgs = normalizePathArgs(passthroughArgs);
const schemaPath = getArgValue(normalizedArgs, "--schema");
if (!schemaPath) throw new Error("Missing required --schema argument");

const tempSchemaPath = resolve(tempDir, "schema.prisma");
copyFileSync(schemaPath, tempSchemaPath);
const targetGeneratedDir = resolve(dirname(schemaPath), "generated");
const tempGeneratedDir = resolve(tempDir, "generated");

const prismaArgs = normalizedArgs.map((arg, index, all) => {
   if (arg === "--schema") {
      return arg;
   }
   if (index > 0 && all[index - 1] === "--schema") {
      return tempSchemaPath;
   }
   if (arg.startsWith("--schema=")) {
      return `--schema=${tempSchemaPath}`;
   }
   return arg;
});

try {
   run("pnpm", ["init"], { cwd: tempDir, stdio: "inherit", env: process.env });
   run("pnpm", ["add", "-D", "prisma@6", "@prisma/client@6"], { cwd: tempDir, stdio: "inherit", env: process.env });

   run("pnpm", ["prisma", "generate", ...prismaArgs], { cwd: tempDir, stdio: "inherit", env: process.env });

   if (!existsSync(tempGeneratedDir)) {
      throw new Error(`Expected generated output at ${tempGeneratedDir}, but it was not found.`);
   }
   rmSync(targetGeneratedDir, { recursive: true, force: true });
   cpSync(tempGeneratedDir, targetGeneratedDir, { recursive: true, force: true });
} finally {
   rmSync(tempDir, { recursive: true, force: true });
}
