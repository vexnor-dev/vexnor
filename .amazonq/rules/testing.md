# Testing Rules

## Snapshot assertions

- ALWAYS use `toMatchInlineSnapshot()` when asserting string or object outputs in tests — never use `toContain`, `toBe`, `toEqual`, `toStrictEqual`, or `not.toContain` for string or object output assertions.
- Let Vitest populate the snapshot value by running with `-u` on the first run.
- Write tests with empty `toMatchInlineSnapshot()` calls first, then populate by running with `-u`.

## Test-driven validation

- Before accepting a bug as real, write a test that exposes it and run it to confirm.
- Do not suggest fixes until the test proves the assumption.
