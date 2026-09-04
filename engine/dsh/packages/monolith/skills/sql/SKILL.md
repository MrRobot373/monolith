---
name: sql
description: Write and review SQL, design schemas, and plan migrations - queries, indexes, joins, constraints, performance. Use for any database schema or query task in Postgres, MySQL, SQLite or similar.
whenToUse: The task involves a relational database - writing a query, designing tables, or making a schema change.
metadata:
  category: engineering
  version: 1.0.0
  license: MIT
---

# SQL and schema work

## Look at the schema before writing the query

Read the table definitions, existing indexes and how neighbouring queries are
written. A query that ignores an existing index, or duplicates a view that
already exists, is a maintenance cost even when it returns the right rows.

## Schema

- **Constrain at the database.** `NOT NULL`, foreign keys, `UNIQUE`, `CHECK`.
  Application-level validation is a convenience; the database is the guarantee.
- **Pick honest types.** Money is `numeric`, never float. Timestamps are
  timezone-aware. An enum-like column gets a constraint, not a comment.
- **Name predictably** - the codebase's convention beats your preference.
- Nullable means "genuinely unknown". Do not use NULL as a flag.

## Queries

- Select the columns you need. `SELECT *` breaks when a column is added and
  hides which fields the code depends on.
- Know your join. A `LEFT JOIN` filtered in `WHERE` silently becomes an inner
  join - put the condition in `ON` if you meant to keep the unmatched rows.
- Aggregate carefully: joining then summing double-counts. Aggregate in a
  subquery, then join.
- Every unbounded query gets a `LIMIT`, including ad-hoc ones.

## Performance

Read the plan before optimising: `EXPLAIN ANALYZE`. Guessing wastes time.

- Index what you filter, join and sort on. A composite index only helps when the
  query uses its leading columns.
- A function on an indexed column (`WHERE lower(email) = ...`) discards the
  index unless the index matches the expression.
- More indexes mean slower writes. Do not add one without a query that needs it.

## Migrations

- Additive first: add nullable, backfill, then constrain. A single migration
  that adds a `NOT NULL` column to a large live table locks it.
- Every migration needs a tested rollback, or an explicit note that it is
  one-way and why.
- Never write a destructive statement against production data without an
  explicit confirmed instruction. `DELETE` and `UPDATE` without `WHERE` are
  incidents, not queries.

## Related

- `backend-api` for the service around it
- `data-analysis` to explore data outside the database
