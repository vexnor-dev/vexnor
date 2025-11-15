#!/usr/bin/env node
if (!process.env.VALNOR_ORIGINAL_CWD) {
   process.env.VALNOR_ORIGINAL_CWD = process.cwd();
}

await import("./dist/cli/main.js");
