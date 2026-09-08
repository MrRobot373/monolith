# packages/monolith — the MONOLITH product delta

Everything the product layer changes about the engine lives here. `engine/core` is otherwise
vendored upstream, so a version bump is a merge of that directory alone.

| Package | Role |
|---|---|
| [`bundle/`](bundle/) | `@monolith/bundle` — the patch layer over `monolith-base` + `monolith-web-app`, and the dependency anchor that makes MONOLITH plugins resolvable to a profile |
| [`skills/`](skills/) | MONOLITH's skill library — 22 bundles across documents, data and engineering; see below |
| [`ui-brand/`](ui-brand/) | `@monolith/client-ui-brand` — MONOLITH occupants for the sidebar brand and conversation-hero slots |

## Why a bundle rather than `--patch`

A `--patch` overlay can *name* a plugin package, but it cannot make one resolvable. The Loader
imports plugin packages from the profile directory (`$MONOLITH_HOME/profiles/<name>/`), and
`healProfileModuleFallback` links only the packages inside a selected **bundle's dependency
closure** into that directory. A `--patch` row naming `@monolith/client-ui-brand` therefore
fails with `ERR_MODULE_NOT_FOUND`. A deployment plugin has to ship as a dependency of a bundle
package — the same shape `monolith-web-app` uses for the `ui-*` rows it rosters.

## Wiring, in the two places it takes

1. **The profile** names the bundle layers in order. MONOLITH's layer comes last so its rows
   override the web surface beneath it:

   ```json
   { "monolith": { "profile": { "bundles": [
     "@monolith/base", "@monolith/web-app", "@monolith/bundle"
   ] } } }
   ```

2. **The installation** must be able to resolve that bundle. `resolveBundleDir` tries the
   installation anchor (`apps/cli/package.json`) before the profile directory, which is why
   `@monolith/bundle` is a dependency of `apps/cli` exactly as `@monolith/web-app` is.
   That one line in `apps/cli/package.json` is the only edit MONOLITH makes to a vendored file.

Then:

```
monolith --profile monolith --no-open --port 3080
```

## Verified behavior

Booted against this overlay, the served browser roster contains `@monolith/client-ui-brand`,
no longer contains `@monolith/client-ui-brand-official`, and carries
`@monolith/client-ui-schedule`. `--dump-config` shows the LiteLLM route on `llm-pi-ai`,
`llm-deepseek` disabled, and the host `schedule` + `time-context` rows present.

## Launcher environment

Two overlay rows read paths from the environment, because `require` is not
available in the Loader's `!!js` sandbox (only `process` and the harness-home
resolver). A launcher must set both, or they fall back to container paths:

| Variable | Points at | Fallback |
|---|---|---|
| `MONOLITH_MCP_WEB` | `native/mcp/web-tools.mjs` | `/opt/monolith/mcp/web-tools.mjs` |

`SEARXNG_URL` is passed through to the web MCP server; unset, it falls back to
DuckDuckGo, so search works with no API key either way.

## Installing the skills

Skills are **installed**, not scanned from source:

```
node packages/monolith/skills/install.mjs "$MONOLITH_HOME/skills"
```

`$MONOLITH_HOME/skills` is already a default skill root, so no `customSkillDirs`
entry is needed. Installing copies each bundle and resolves its `{{SKILL_DIR}}`
placeholder to the installed absolute path.

That substitution is the whole point. A skill that ships an executable has to
name where that executable *is*. monolith does give the model a `Base directory for
this skill:` line and asks it to resolve relative paths against it — but a 9B
model ignored that, ran `python scripts/build_deck.py` against its own working
directory, and failed with `No such file or directory` through several turns
before concluding it was "blocked by an environmental dependency". Baking the
absolute path in removes the arithmetic rather than trusting the model to do it.

Never point `customSkillDirs` at the source tree: that serves the unresolved
placeholder and brings the bug straight back.

## The skill library

22 bundles. Nine ship a working Python tool; the rest are judgement skills.

**Documents** — monolith ships no document production at all, so this is the whole
capability, not an improvement on one. Each format tool does create / edit /
inspect / validate, and edits mutate the loaded file so the user's styles,
themes and formulas survive.

| Skill | Tool | Does |
|---|---|---|
| `powerpoint` | `pptx_tool.py` | decks: create, edit, inspect, validate |
| `docx` | `docx_tool.py` | Word: create, edit (formatting-preserving), inspect, validate |
| `xlsx` | `xlsx_tool.py` | Excel: create, edit, inspect, validate; formulas stay live |
| `pdf` | `pdf_tool.py` | create, extract, tables, merge, split, validate |
| `office-inspect` | `inspect_file.py` | identify any file from its bytes; catches extension lies |
| `office-repair` | `repair_office.py` | diagnose, recover text/sheets, rezip damaged files |

**Data and visuals**

| Skill | Tool | Does |
|---|---|---|
| `chart` | `chart.py` | bar/line/pie/scatter/stacked PNG, colour-blind-safe |
| `data-analysis` | `analyze.py` | profile, head, column, query, agg, export |
| `image-edit` | `image_tool.py` | info, convert, resize, thumbnail, crop, contact sheet |

**Engineering** (judgement, no scripts): `tech-plan`, `frontend`, `ux-review`,
`backend-api`, `sql`, `testing`, `debugging`, `code-review`, `refactor`, `ai-ml`.

**Research and comms**: `web-research`, `research-report`, `meeting-notes`.

### Requirements

The tools need `python-docx`, `openpyxl`, `python-pptx`, `pypdf`, `reportlab`,
`matplotlib`, `pandas` and `Pillow`. Each script fails with the exact
`pip install` line if its library is absent, rather than a traceback.
