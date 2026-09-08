---
name: ux-review
description: Review an interface or flow for usability, clarity, accessibility and friction, and propose specific fixes. Use when asked to critique a screen, improve UX, or find why users struggle with something.
whenToUse: An interface exists and the question is whether it works for people, not whether it compiles.
metadata:
  category: engineering
  version: 1.0.0
  license: MIT
---

# Reviewing an interface

## Review the flow, not the screen

Users do not experience screens, they experience tasks. Walk the whole path -
arrive, decide, act, confirm, recover from a mistake - and review that. A
beautiful screen inside a broken flow is still a broken product.

## What to look for, in priority order

1. **Can they tell what to do?** The primary action should be obvious in under
   two seconds. If two actions compete visually, neither is primary.
2. **Does the system say what happened?** Every action gets feedback. Silent
   success is indistinguishable from failure.
3. **Can they recover?** Undo, back, edit. Destructive actions confirm - and
   the confirmation says what will be lost, not "Are you sure?".
4. **Is the wording theirs or yours?** Name things as users recognise them.
   People manage notifications, not webhook configs.
5. **Errors**: say what went wrong and how to fix it. No apologies, no codes
   alone, never "an error occurred".
6. **Accessibility**: keyboard path, focus order, contrast, labels, targets big
   enough to hit.

## Report findings so they can be acted on

For each finding: **where**, **what breaks**, **who it affects**, **the fix**.

> **Checkout, step 2** - the "Continue" button is disabled with no explanation
> until every field is valid, so a user with one bad field sees a dead button
> and no reason. Fix: keep it enabled and show the field error on submit.

Rank by cost to the user, not by ease of fixing. State plainly when something is
a genuine blocker rather than a polish item.

## Restraint

Not every difference is a defect. Say what works, and do not rewrite a
functioning flow around personal taste. If a pattern is unusual but consistent
and learnable, leave it alone.

## Related

- `frontend` to implement the fixes
- `testing` to lock in the recovered behaviour
