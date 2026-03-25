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
- When fixing a bug, identify the exact root cause before touching code.
- After making changes, always verify with a full build and test run.

## No half-measures

- If a fix touches a type mapping, regenerate all affected codegen immediately.
- If a test covers type coverage, it must cover ALL columns, not a representative sample.
- If a snapshot contains a dynamic value, it will fail on the next run — catch it before committing.
