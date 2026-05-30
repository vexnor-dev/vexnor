# Execution Rules

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
- When fixing a bug, identify the exact root cause before touching code.
- After making changes, always verify with a full build and test run.

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

## No speculative fixes

- Do not touch things that have not been confirmed broken.
- Do not make "while I'm here" changes.
- If something looks wrong but wasn't mentioned, flag it — do not silently fix it.

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
