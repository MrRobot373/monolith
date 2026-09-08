---
name: research-report
description: Turn findings into a structured, cited written report or briefing. Use when the deliverable is a document that others will read and act on, rather than a chat answer.
whenToUse: The user asked for a report, briefing, summary document, literature review or written analysis.
metadata:
  category: research
  version: 1.0.0
  license: MIT
---

# Writing a report

## Structure that survives a busy reader

1. **The answer, in three sentences.** What you found, how confident you are,
   what it means. A reader who stops here should still have the finding.
2. **What the evidence says.** Grouped by theme, not by source. One section per
   claim, with the support underneath it.
3. **What is uncertain.** Named explicitly - gaps, contradictions, thin
   sourcing.
4. **What to do next**, if the user asked for a recommendation. Not otherwise.
5. **Sources**, with dates.

Never open with methodology. Nobody reads a report to learn how you searched.

## Confidence, marked

Tag every material claim so the reader can weigh it:

| Mark | Means |
|---|---|
| verified | corroborated by a primary source you read |
| likely | one credible source, uncontradicted |
| unclear | sources disagree, or the evidence is thin |

Do not smooth these into uniform prose. A report where everything sounds equally
certain is less useful than one that admits its soft spots.

## Writing rules

- Lead each section with its conclusion, then support it.
- Specific beats hedged. "Adoption tripled between 2024 and 2026" not
  "adoption has grown considerably".
- Cut every sentence that only restates the heading.
- No filler openers. Delete "In today's rapidly evolving landscape".
- Tables for comparisons, prose for arguments.

## Producing the file

A report is usually a **document**, not a chat message:

- `docx` - the default; the user can keep editing it
- `pdf` - final, print-ready, not to be edited
- `powerpoint` - only if they asked to present it

Include charts via the `chart` skill where a figure carries the point.

## Honesty

If the research did not support a conclusion, say so and stop. A report that
manufactures a confident answer from thin evidence is worse than a short one
that names the gap.

## Related

- `web-research` to gather and cite, `data-analysis` for numbers
- `docx`, `pdf`, `powerpoint` to produce the artifact
