---
name: code-review
description: Review code for correctness bugs, security problems, and simplification - a diff, a file, or a pull request. Use when asked to review, check, or find problems in code.
whenToUse: Code exists and needs judging before it ships.
metadata:
  category: engineering
  version: 1.0.0
  license: MIT
---

# Reviewing code

## Read enough to judge it

A diff does not show what it breaks. Before commenting, look at what calls the
changed code and what the surrounding conventions are. A "bug" that is actually
the codebase's house style is a wasted comment; a missed caller is a shipped
outage.

## Order of attention

1. **Correctness** - does it do what it claims, including at the boundaries?
   Empty, one, many, null, concurrent, retried, partially failed.
2. **Security** - unvalidated input, injection, missing authorisation, secrets
   in code or logs, permissive CORS, unsafe deserialization.
3. **Data safety** - migrations that lock or lose, non-transactional multi-table
   writes, non-idempotent handlers.
4. **Simplification** - existing helper not reused, needless abstraction, dead
   code, a loop that should be a query.
5. **Style** - only where it hurts readability or diverges from the codebase.

## Write findings that can be acted on

Every finding: **where**, **what breaks**, **a concrete failure**, **the fix**.

> `orders.py:88` - `total` is summed after the `LEFT JOIN`, so an order with two
> shipments is counted twice. An order with one shipment is correct, which is
> why the tests pass. Aggregate in a subquery, then join.

A finding without a failure scenario is an opinion. Say so if it is one.

## Calibrate

- Distinguish **must fix** from **worth considering**. Flagging everything at
  the same volume means none of it lands.
- Do not invent problems to look thorough. "This looks correct; here is the one
  thing I would change" is a legitimate review.
- Do not rewrite to taste. If it is correct, clear and consistent, leave it.

## Verify before claiming

If you assert a bug, be able to name the input that triggers it. Where you can
run the code, run it. Confident, wrong review comments cost more trust than
missed nits.

## Related

- `testing` to lock in what the review found
- `debugging` when a finding needs confirming
- `refactor` when the answer is restructuring
