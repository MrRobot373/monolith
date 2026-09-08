---
name: debugging
description: Find the actual cause of a failure - crashes, wrong output, flaky tests, performance problems - instead of guessing at fixes. Use whenever something is broken and the reason is not yet known.
whenToUse: Something fails and you do not yet know why.
metadata:
  category: engineering
  version: 1.0.0
  license: MIT
---

# Debugging

## Reproduce before you theorise

An unreproducible bug cannot be confirmed fixed. Get to a command that fails
every time, and shrink it until it is small. Most bugs become obvious the moment
the reproduction is small enough.

If it only fails sometimes, that is data: concurrency, ordering, time, or
leftover state.

## Read the actual error

Read the whole message and the whole trace, bottom to top. The first line is
usually the symptom; the cause is further down. Note the exact file and line -
guessing from the message alone is how you fix the wrong thing.

**Never accept a summarised error.** If a tool or a model reports "a permission
error", get the literal text. Reported errors are routinely misattributed, and
a wrong label sends the whole investigation sideways.

## Narrow it down

Binary search the difference:

- **Between versions**: what was the last working commit? `git bisect`.
- **Between environments**: works locally, fails in CI - list what differs.
- **Between inputs**: which input flips it?
- **Within the flow**: assert or log at the midpoint. Is the value right there?

Each step should halve the space. If it does not, you are guessing.

## Confirm the cause before fixing

State the mechanism in one sentence: "the cache key omits the tenant id, so
tenant B reads tenant A's row." If you cannot say it that plainly, you have not
found it yet.

Then verify: make the cause happen deliberately and watch the symptom appear.

## Fix

- Fix the cause, not the symptom. A null check that hides why the value was null
  moves the bug somewhere less visible.
- Write the regression test first, watch it fail, then fix.
- Fix one thing. Bundled changes make it impossible to know what worked.

## When you are stuck

Say so, and say what you ruled out. "I have confirmed it is not the cache and
not the serializer; the next thing I would instrument is the retry path" is
useful. Inventing a plausible-sounding cause is not.

## Related

- `testing` for the regression test
- `code-review` to catch the class of bug next time
