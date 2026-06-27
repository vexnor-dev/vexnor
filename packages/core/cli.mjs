#!/usr/bin/env tsx
if (!process.env.VEXNOR_ORIGINAL_CWD) {
   process.env.VEXNOR_ORIGINAL_CWD = process.cwd();
}

await import("./dist/cli/main.js");
