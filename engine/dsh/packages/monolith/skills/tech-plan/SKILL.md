---
name: tech-plan
description: Plan an implementation before writing code - scope, decisions, risks, sequencing. Use for any change large enough that starting in the wrong place would be expensive to undo.
whenToUse: The user asked how to build something, or the task spans several files, systems or sessions.
metadata:
  category: engineering
  version: 1.0.0
  license: MIT
---

# Planning a change

A plan exists to put the expensive-to-reverse decisions in front of the user
while changing them is still free. It is not a proof that you thought of
everything.

## Read the code first

Never plan against an imagined codebase. Before proposing anything:

- Find the code that already does something similar - `grep`, `glob`
- Read how the surrounding code is structured, named and tested
- Identify the seam the change belongs at

A plan that ignores existing conventions creates a second way of doing things,
which is worse than either way alone.

## Structure

1. **Three lines**: what is being built, the approach, the riskiest assumption.
2. **Decisions you'll want to tweak** - data model, interfaces, anything
   user-facing. For each: the choice, one alternative, and what changing it
   later would cost. Order by likelihood of change, not build order.
3. **Unknowns** - state the default you will take and the signal that would
   make you pivot.
4. **The mechanical work** - compressed. The reviewer trusts you here.

## Sizing

- If it touches one file and one behaviour, skip the plan and do it.
- If it changes a schema, an interface others call, or how data is stored,
  plan it - those are the reversals that hurt.
- Sequence so that something works at every step. A plan whose value only
  appears at step 9 cannot be reviewed or abandoned partway.

## Honesty

Name what you did not investigate. "I have not checked how the mobile client
consumes this endpoint" is a real part of a plan. Discovering it in step 6 is
not.

## Related

- `debugging` when the task is diagnosis rather than construction
- `backend-api`, `frontend`, `sql` for the domain specifics
- `testing` to decide what proves the change works
