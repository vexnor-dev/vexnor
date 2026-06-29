# Agent Rules

This is a serious, high-quality codebase. No shortcuts. No lazy work. Ever.

## Full capacity — always

- Give 1000% on every task. This is not a toy project. Every change matters.
- Never conserve tokens or processing at the expense of correctness or completeness.
- Never produce a partial solution to save effort. If the full solution is needed, deliver it in full.
- Never summarize or skip steps when the actual work is what's needed.
- If a task is large, do it fully — do not trim scope without explicit instruction from the user.

## Completeness

- When asked to update, fix, or cover something — do it for ALL cases, not a subset.
- Never update only a few columns when all columns are required.
- Never leave dynamic values (UUIDs, auto-generated PKs, timestamps with defaults) in snapshots — always destructure them out and assert their type separately.
- Always read the actual generated types before writing test data — never guess column types.

## Correctness before speed

- Read the relevant files before making changes. Do not assume.
- Always read the **full current file state** before editing — not just the sections that seem relevant.
- **Never use a cached or previously seen version of a file when updating it. Always reload from the filesystem first.**
- **When rewriting a file in full, always read the current file from disk first and carry forward every change the user has made since the last known state.**
- **Never use `create` on an existing file. Always use targeted edits (`strReplace`, `insert`) to avoid overwriting parallel changes.**
- When fixing a bug, identify the exact root cause before touching code.
- After making changes, always verify with a full build and test run.

## Answering "why"

- When asked "why" about a mistake or decision, give only the real, direct reason. No padding, no apology, no explanation of what the rule should have been.

## Do not remove existing code

- Never remove comments, JSDoc, or documentation unless explicitly asked.
- Never remove code structure, exports, or logic unless explicitly asked.
- When editing a file, preserve everything that is not directly related to the change.

## Know when to stop and ask

- If a fix attempt fails twice, stop. Explain the root cause clearly before trying again.
- If the root cause is unclear, say so explicitly and ask for direction — never guess.
- Never make speculative changes to recover from a failed fix.
- If a task involves unfamiliar interactions between components, ask for clarification until the full picture is clear before writing any code.
- It is always better to ask one more question than to make one wrong change.
- **If you cannot solve a problem without reverting to a solution the user already rejected — whether explicitly or by updating a file after you — stop immediately and ask for clarification. Never silently revert.**

## No speculative fixes

- Do not touch things that have not been confirmed broken.
- Do not make "while I'm here" changes.
- If something looks wrong but wasn't mentioned, flag it — do not silently fix it.
- Do not rename, restructure, or reformat existing code unless explicitly asked. Names, field names, and signatures must be preserved exactly as-is.
- **Never change an agreed API or DX without explicit instruction. If a constraint blocks the implementation, stop and ask — do not invent a workaround.**
- **Never introduce new exports, types, or abstractions to work around a problem unless explicitly asked. Identify the root cause and ask for direction.**

## No half-measures

- If a fix touches a type mapping, regenerate all affected codegen immediately.
- If a test covers type coverage, it must cover ALL columns, not a representative sample.
- If a snapshot contains a dynamic value, it will fail on the next run — catch it before committing.

## No unsafe casting

- Never use `as any` or `(x as any).prop` to work around a type error. Find the correct type instead.
- If a third-party type is wrong or missing, use a proper type guard, a narrowing function, or a minimal local type that accurately describes the shape.
- `as any` is only acceptable in the implementation signature of a function overload where TypeScript cannot resolve the return type — and only there.

## Tests are not optional

- Every new feature or function must have unit tests. No exceptions.
- Write the test file before declaring the work done.
- Unit tests go in `__tests__/` alongside the implementation.
- Use `toMatchInlineSnapshot()` for all SQL text and values output — write empty calls first, then populate by running with `-u`.
- Do not ship code without running the full test suite and confirming it passes.

## Git commits by AI

- Every commit must have a comprehensive commit message: summary line + detailed body explaining what changed and why.
- Before committing, AI must prove local CI passed by running: build all packages, run all tests.
- If build or tests fail, fix them first — never commit broken code.
- Include the build/test evidence (counts, pass/fail) in the commit process.

## Snapshot assertions

- ALWAYS use `toMatchInlineSnapshot()` when asserting string or object outputs in tests — never use `toContain`, `toBe`, `toEqual`, `toStrictEqual`, or `not.toContain` for string or object output assertions.
- Let Vitest populate the snapshot value by running with `-u` on the first run.
- Write tests with empty `toMatchInlineSnapshot()` calls first, then populate by running with `-u`.

## Test-driven validation

- Before accepting a bug as real, write a test that exposes it and run it to confirm.
- Do not suggest fixes until the test proves the assumption.

## Permissions granted

The following actions are pre-approved by the repo owner:

- **Git push** to feature branches (never to main/master directly)
- **Git force push** (`--force-with-lease`) to feature branches after rebase
- **Git rebase** feature branches onto main to resolve merge conflicts
- **Create and remove worktrees** for feature branch work
- **Create commits** with comprehensive messages after build+test pass
- **Delete dead/unused code** (unreferenced files, obsolete exports)
- **Remove deprecated APIs** when they are replaced by new implementations in the same PR
- **Modify CI workflows** (.github/workflows/) to fix broken steps
- **Update snapshots** with `--update` flag when code changes legitimately alter output
- **Rebuild packages** (`pnpm build`, `pnpm --filter ... build`) as needed
- **Regenerate cross-runtime fixtures** (`npx tsx generate-cross-runtime.ts`)
- **Run .NET build and tests** (`dotnet build`, `dotnet test`)
- **Modify coverage exclusions** in vitest.config.ts for non-library code (CLI, test infrastructure, examples)
- **Create local SQLite databases** from migration SQL files for testing (`@db-sqlite3/`)
- **Run codegen** for test projects and examples (`pnpm --filter ... run codegen`)
- **Fix code-quality review findings** (CodeQL, github-code-quality) without explicit per-issue approval
- **Add test coverage** for uncovered diff lines flagged by codecov/patch

## Workflow context

- **Monorepo structure**: packages/ (core), plugins/ (postgres, mssql, sqlite3), orms/ (sequelize, prisma, typeorm, drizzle), tests/ (e2e), stacks/ (.NET SDK), examples/
- **Test command**: `pnpm test` (runs vitest --coverage for all projects)
- **Build command**: `pnpm build` (builds all packages in dependency order)
- **.NET tests**: `dotnet test stacks/dotnet` (181 tests including cross-runtime snapshots)
- **Cross-runtime fixtures**: `cd stacks/fixtures && npx tsx generate-cross-runtime.ts`
- **DB connections**: env-dev.json at monorepo root (postgres, mssql environments)
- **CI**: GitHub Actions — `build-and-test` (builds, tests with DBs), `report` (coverage upload)
- **Coverage target**: min 90% on all metrics for new code
