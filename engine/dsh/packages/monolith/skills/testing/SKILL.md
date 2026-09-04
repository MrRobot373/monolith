---
name: testing
description: Decide what to test and write the tests - unit, integration, end-to-end, regression. Use when adding tests, when a change needs proving, or when deciding whether existing coverage is adequate.
whenToUse: Code needs tests written, or you need to judge whether a change is adequately covered.
metadata:
  category: engineering
  version: 1.0.0
  license: MIT
---

# Testing

## Match the project's testing style

Read existing tests before writing new ones - runner, file layout, naming,
fixtures, how they build test data. A test in an unfamiliar style is friction
for everyone who reads it later.

## Test behaviour, not implementation

A test should fail when the behaviour breaks and survive a refactor that keeps
it. Tests that assert on internal calls break on every rename and teach the team
to ignore red builds.

## What deserves a test

| Priority | What |
|---|---|
| Highest | The bug you just fixed - a regression test, written first |
| High | Boundaries: empty, one, many, max, null, malformed |
| High | Error paths and permission checks |
| Medium | The main success path |
| Low | Getters, framework glue, generated code |

Coverage percentage is a weak signal. One test proving the auth check rejects
the wrong user is worth fifty asserting that constructors set fields.

## Writing a good test

- Name it after the behaviour: `rejects_expired_token`, not `test_auth_2`.
- Arrange, act, assert - visibly separated.
- One reason to fail per test. A test asserting six unrelated things tells you
  little when it goes red.
- Assert on values, not just "no exception".
- No sleeps. Wait on the condition, or inject the clock.
- Independent and order-free. Shared mutable fixtures cause the flakes that
  eventually get the whole suite disabled.

## Fixing a bug

Write the failing test **first**, watch it fail, then fix. A test written after
the fix proves nothing - you never saw it catch the bug.

## Run them

Never report tests as passing without running them and reading the output. If
some fail, say which and why. Reporting green on an unrun suite is the worst
possible outcome of a testing task.

## Related

- `debugging` to find the cause before writing the regression test
- `code-review` for reviewing rather than writing
