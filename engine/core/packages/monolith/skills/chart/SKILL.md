---
name: chart
description: Render a chart to PNG or SVG for a slide, document or report - bar, line, pie, scatter, stacked. Colour-blind-safe palette. Use whenever numbers would land better as a picture than a table.
whenToUse: You have figures to show and the deliverable is a deck, document or report rather than an interactive page.
metadata:
  category: data
  version: 1.0.0
  license: MIT
---

# Charts

```bash
python "{{SKILL_DIR}}/scripts/chart.py" - revenue.png <<'JSON'
{"type": "bar",
 "title": "Revenue by region",
 "labels": ["North", "South", "East"],
 "ylabel": "USD (k)",
 "annotate": true,
 "series": [{"name": "Q2", "values": [135, 110, 82]}]}
JSON
```

That path is absolute and already correct - **use it exactly as written**.

## Pick the form from the question

| The question | Chart |
|---|---|
| How do these compare? | `bar` (`barh` when labels are long) |
| How did it change over time? | `line` |
| What is it made of? | `stacked_bar`, or `pie` for 2-4 slices only |
| Are these two things related? | `scatter` |

**One chart, one message.** Five series with no clear question is a table
wearing a costume. If the reader has to hunt for the point, split it or use a
table instead.

Avoid pie charts beyond four slices - people cannot compare angles. A bar chart
is almost always the more honest choice.

## What the tool handles

- Okabe-Ito palette, readable with common forms of colour blindness
- Gridlines behind the data, top and right spines removed
- Legend only when there is more than one series
- `annotate: true` prints values above single-series bars
- Label/value count mismatch is a hard error, not a silently short chart

## Placing it

Charts are PNGs. Put one on a slide or in a document by referencing the file
path from the `powerpoint`, `docx` or `pdf` skill. Render at `dpi: 160` or
higher for print; the default suits both screen and page.

## Titles do the work

Title the finding, not the axes. "Revenue grew 14% in the North" tells the
reader what to see; "Revenue by region" makes them work it out.

## Related

- `data-analysis` to find the numbers worth charting
- `powerpoint`, `docx`, `pdf` to place the result
