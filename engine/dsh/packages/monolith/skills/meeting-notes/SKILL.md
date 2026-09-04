---
name: meeting-notes
description: Turn a transcript, recording notes or raw discussion into structured minutes with decisions, owners and action items. Use for meeting notes, standups, interviews and call summaries.
whenToUse: The user has raw discussion content and wants usable notes, minutes or a summary out of it.
metadata:
  category: productivity
  version: 1.0.0
  license: MIT
---

# Meeting notes

## What notes are for

Someone who missed the meeting should learn, in under a minute: what was
decided, what they owe, and by when. Everything else is optional.

## Structure

```
## Decisions
- <decision> - <who decided> - <date if given>

## Actions
| Owner | Action | Due |
|---|---|---|

## Discussion
- <topic>: <the substance, not the play-by-play>

## Open questions
- <question> - <who can answer>
```

Put decisions and actions **first**. A chronological retelling buries them.

## Extraction rules

- **An action needs an owner.** No owner means it is not an action - list it
  under Open questions as "unassigned".
- **Distinguish decided from discussed.** "We should probably migrate" is not a
  decision. Do not promote speculation to commitment.
- **Attribute where it matters** - decisions and commitments - and not where it
  does not. Notes are not a transcript.
- **Keep the actual numbers, dates and names.** Those are what people come back
  for.

## What not to do

- Do not invent an owner or a deadline that was never stated. Write `unassigned`
  or `no date`. A fabricated due date is worse than a blank one.
- Do not smooth over disagreement. If two people disagreed and nothing was
  settled, that is the note.
- Do not summarise away the reasoning behind a contentious decision - that is
  exactly what gets re-litigated later.

## When the input is thin

Say what is missing. "No owner was named for the migration work" is useful.
Silently omitting it is not.

## Producing the file

Short notes belong in chat. A record that will be circulated or filed belongs in
a document - use `docx`. A recurring format is worth a template the user keeps.

## Related

- `research-report` for analysis rather than minutes
- `docx` to produce a circulated record
