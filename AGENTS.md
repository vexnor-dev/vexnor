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
- State assumptions explicitly before implementing. If uncertain about intent, ask — do not interpret silently.
- If a request has multiple valid interpretations, present them and ask which one is intended. Do not pick one and proceed.
- Match existing code style, conventions, and patterns — even if you would do it differently. Consistency with the codebase wins over personal preference.

## Answering "why"

- When asked "why" about a mistake or decision, give only the real, direct reason. No padding, no apology, no explanation of what the rule should have been.

## Do not remove existing code

- Never remove comments, JSDoc, or documentation unless explicitly asked.
- Never remove code structure, exports, or logic unless explicitly asked.
- When editing a file, preserve everything that is not directly related to the change.
- **Exception: if YOUR changes orphan an import, variable, or function (made it unused), remove it.** Do not leave dead code that you created. But never remove pre-existing dead code unless asked.

## Know when to stop and ask

- If a fix attempt fails twice, stop. Explain the root cause clearly before trying again.
- If the root cause is unclear, say so explicitly and ask for direction — never guess.
- Never make speculative changes to recover from a failed fix.
- If a task involves unfamiliar interactions between components, ask for clarification until the full picture is clear before writing any code.
- It is always better to ask one more question than to make one wrong change.
- **If you cannot solve a problem without reverting to a solution the user already rejected — whether explicitly or by updating a file after you — stop immediately and ask for clarification. Never silently revert.**
- If a simpler approach exists than what was requested, say so and push back. Do not silently comply with unnecessary complexity.

## No legacy assumptions

- Never assume a feature exists for legacy reasons and silently accommodate it.
- If a type error or constraint suggests a runtime path exists beyond the current type contract (e.g., array format where only objects are typed), **ask the developer** whether that path is intentional and should be supported, or whether it should be removed.
- Do not widen types, add union alternatives, or introduce fallback code paths to support formats that may not be required. Ask first.
- Do not use `as never`, `as any`, or `as unknown` to silence type errors caused by passing data in an unsupported format. Fix the test or the code to use the correct format.

## No overengineering

- Solve the exact problem that was asked about. Nothing more.
- If the solution can be 50 lines, do not write 200 lines. If it's overcomplicated, simplify before declaring done.
- No abstractions for single-use code. No "flexibility" or "configurability" that wasn't requested.
- No wrapper functions, helper classes, or indirection layers unless the task explicitly requires them.
- Do not suggest architectural improvements, refactors, or "better approaches" unless asked for advice.
- Do not propose follow-up work, enhancements, or "things to consider." Finish the task and stop.
- If a simpler approach exists than what was asked for, say so briefly — then do what was asked unless told otherwise.
- **The measure of quality is solving the problem with minimum necessary code, not maximum cleverness.**

## Plan before executing

- For multi-step tasks, state a brief plan with verification criteria before writing code:
  ```
  1. [Step] → verify: [how I'll confirm it worked]
  2. [Step] → verify: [how I'll confirm it worked]
  ```
- Transform vague requests into concrete, verifiable goals before starting. "Add validation" → "What inputs are invalid? What should happen when they're received?"
- If success criteria are unclear, ask — do not invent requirements to fill the gap.

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

## Testing object fields and types

- When testing that a result row includes specific fields, access them DIRECTLY via `row.field` — never use `.toHaveProperty("field")`.
- For fields that ARE on the static Row type: access directly, no directive needed.
  ```typescript
  const row = results[0]!;
  expect(row.accountId).toBeDefined();
  expect(row.email).toBe("test@example.com");
  ```
- For fields that are NOT on the static Row type (e.g., window aliases from runtime `params.windowBy`, projected fields from runtime `params.select`): use `@ts-expect-error` before the access.
  ```typescript
  const row = results[0]!;
  // @ts-expect-error — runtime window alias, not on static Row type
  expect(row.myRank).toBeDefined();
  ```
- To verify that a field does NOT exist on a type, use `@ts-expect-error`:
  ```typescript
  // @ts-expect-error — 'fakeField' should not exist on this type
  void row.fakeField;
  ```
- Never use `as Record<string, unknown>`, `as any`, or `as never` to access fields on result rows.
- `.toHaveProperty()` is allowed ONLY for checking non-row objects (metadata, configuration, internal structures).

## Test-driven validation

- Before accepting a bug as real, write a test that exposes it and run it to confirm.
- Do not suggest fixes until the test proves the assumption.

## Bug-fixing workflow

When a bug is discovered in existing code — whether during local testing, automated tests, or integration testing:

1. **Write a failing test first** — an automated test (unit or e2e, whichever is appropriate) that reproduces the bug. Run it and confirm it **fails**.
2. **Implement the fix** — make the code change that resolves the root cause.
3. **Confirm the test passes** — run the test again and verify it now **passes**.
4. **Never fix a bug without a test that guards against regression.** The test is the proof the bug existed and the proof it's resolved.

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
