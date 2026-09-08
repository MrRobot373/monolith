---
name: web-research
description: Search the web and read sources to answer a question with citations. Use when the answer depends on current information, external facts, documentation or anything outside the workspace.
whenToUse: The question needs facts you do not have, or facts that may have changed since training.
metadata:
  category: research
  version: 1.0.0
  license: MIT
---

# Web research

## Tools

MONOLITH exposes two paths. Prefer whichever is present in your toolset:

- `web_search` and `web_fetch` - the harness's native pair
- `mcp__monolithweb__web_search` and `mcp__monolithweb__fetch_url` - MONOLITH's
  keyless server (DuckDuckGo, or a self-hosted SearXNG)

## Method

1. **Decide what would settle it.** Name the fact that would answer the
   question before searching. Searching first and deciding later is how you end
   up summarising whatever happened to rank highly.
2. **Search narrowly.** Distinctive nouns, error strings, version numbers. Two
   sharp queries beat six vague ones.
3. **Open the promising results.** Snippets are truncated and often stale.
   A claim that matters gets fetched and read.
4. **Corroborate anything surprising.** One source is a lead, not a fact.
5. **Prefer primary sources** - official docs, the changelog, the spec, the
   filing - over an article describing them.

## Citing

Cite as you write, not afterwards. Every non-obvious claim carries a link to the
page that supports it. If you could not verify something, say so in the sentence
where it appears rather than in a caveat at the end nobody reads.

## Honesty rules

- **Never present a search snippet as a verified fact.** Fetch it or flag it.
- **Report contradictions** rather than picking the convenient side.
- **Say when the search failed.** "I could not find a current figure for X" is a
  real answer. Filling the gap from memory and citing an unrelated page is not.
- Dates matter. Note when a source was published; "current" in a 2019 article is
  not current.

## Related

- `research-report` to turn findings into a written deliverable
- `data-analysis` when the answer is in a dataset, not on the web
