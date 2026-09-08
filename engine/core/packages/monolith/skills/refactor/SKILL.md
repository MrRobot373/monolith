---
name: refactor
description: Restructure code without changing behaviour - extract, rename, deduplicate, simplify, split. Use when code is hard to change, duplicated, or needs reshaping before a feature can land cleanly.
whenToUse: The code works but its shape is the problem.
metadata:
  category: engineering
  version: 1.0.0
  license: MIT
---

# Refactoring

## Behaviour must not change

That is the definition. If behaviour changes, it is a rewrite, and it needs
tests and review as a change - not as a tidy-up. Never mix the two in one
commit: when something breaks afterwards, nobody can tell which half did it.

## Have a safety net first

Before restructuring, make sure something would catch a mistake:

- Tests covering the behaviour you are about to move. If they do not exist,
  write them **first**, against the current behaviour.
- Or a characterisation test that captures what it does today, bugs included.

Refactoring without a net is editing and hoping.

## Have a reason

Refactor because a specific change is hard, or a bug keeps recurring here, or
the same logic exists in three places and they have drifted. "It's not how I
would have written it" is not a reason.

## Do it in reversible steps

Rename, then extract, then move, then simplify - each a separate step that keeps
the tests green. A single commit that renames, restructures and re-splits is
unreviewable and unrevertable.

## Common wins

| Smell | Fix |
|---|---|
| Same logic in 3+ places, drifting | extract one function; check the differences are accidental |
| Function you must scroll to read | split at its natural seams |
| Boolean parameter changing behaviour | two named functions |
| Deep nesting | early returns for the error cases |
| Comment explaining what code does | rename until it does not need one |

## Restraint

- Do not abstract on the second occurrence. Wait for the third; two similar
  things often diverge, and a premature abstraction is harder to undo than
  duplication.
- Do not widen scope. Refactoring the file you are in is fine; refactoring the
  module because you are there is how a one-hour task becomes a week.
- Leave unrelated code alone, even when it is worse than what you came for.

## Related

- `testing` for the net, `code-review` to check the result
- `tech-plan` when the restructuring is large enough to need sequencing
