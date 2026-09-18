---
name: backend-api
description: Design and build server-side APIs and services - endpoints, contracts, validation, auth, errors, pagination, background work. Use for REST, GraphQL or RPC work and any server-side feature.
whenToUse: The task is server-side application code or an interface other systems call.
metadata:
  category: engineering
  version: 1.0.0
  license: MIT
---

# Backend and APIs

## The contract is the product

Other people build against your interface, so changing it later is expensive.
Settle these before implementing:

- Resource shape and field names - and whether they leak internals
- What is required vs optional, and what the defaults are
- Error shape: one consistent envelope, machine-readable code plus human message
- Pagination: cursor for anything that grows; offset breaks under concurrent writes
- Versioning: how the next breaking change will ship

## Validate at the boundary

Never trust an input because a caller "should" have checked. Validate at the
edge, reject with a specific message naming the field, and let the interior of
the service assume clean data. Validation scattered through business logic is
how partially-written state happens.

## Errors

| Situation | Status |
|---|---|
| Malformed input | 400 with the offending field named |
| Not authenticated | 401 |
| Authenticated, not permitted | 403 |
| Missing, or hidden by permissions | 404 |
| Conflicts with current state | 409 |
| Valid but semantically wrong | 422 |

Never return 200 with an error in the body. Never leak stack traces, SQL or
internal paths to a caller.

## Data safety

- Every write that spans two tables is a transaction, or it is a future bug.
- Make retries safe. A client that times out **will** retry; an idempotency key
  is cheaper than reconciling duplicate charges.
- Never log secrets, tokens or personal data. Assume logs are widely readable.

## Performance you can predict

- Find the N+1 before it ships. One query per row in a loop is the commonest
  cause of an endpoint that works in dev and dies in production.
- Put a limit on every unbounded list, including internal ones.
- Add the index the query needs; say which query it is for in the migration.

## Related

- `sql` for schema and query work
- `testing` for contract and integration tests
- `frontend` for the client that consumes it
