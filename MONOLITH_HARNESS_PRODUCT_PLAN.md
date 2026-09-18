# MONOLITH: one harness, two modes, many experts

Build a clean workspace for Cowork and Code, with reusable specialist packs.
Extend the Cordis engine and its React web client through MONOLITH-owned plugins; consolidate the older launch paths in stages.
Riskiest assumption: the newer engine can replace the older product without losing required workflows; prove that before switching the default launcher.

Planning baseline: 8 September 2026. This is a product and architecture plan, not an implementation or a claim that the current app passes runtime checks.

## 1. Decisions to settle first

| Decision | Recommended choice | Alternative | Cost of changing later |
|---|---|---|---|
| Product foundation | `engine/core` plus its React web client; product additions in `packages/monolith` | Continue extending OpenWork | High: duplicate session, UI and integration work |
| Primary navigation | Exactly two modes: Cowork and Code | Separate Chat, Research, Agent and every specialist as modes | Medium: navigation, onboarding and saved task migration |
| Specialization | Versioned expert packs, selected independently from mode | A separate app/backend per domain | High: permissions, memory and tool integrations diverge |
| Code experience | Agent-first conversation with files, diffs and terminal available on demand | A full IDE as the default screen | Medium: significant editor and layout scope |
| Memory | Scoped, editable records with citations; searchable vault; optional graph | Graph database and graph home screen immediately | Medium/high: indexing and permissions become coupled to graph storage |
| Initial delivery | Browser UI, local Windows development first, Docker parity before migration completion | Desktop packaging and organization deployment simultaneously | Medium: packaging distracts from workflow validation |

Research is a Cowork workflow. Ordinary questions work in either mode. DOC-AI, MR.LAW and DR.AI are experts. A Project holds files, task history and knowledge. These concepts must remain distinct in the UI and data model.

## 2. What the project already contains

This review surveyed top-level systems, deployment wiring, previous plans, engine extension documentation, representative UI source, and DOC-AI backend entry points. It is not a line-by-line audit of every vendored package. Historical verification claims were not rerun.

| Area / source | Observed foundation | Planning consequence |
|---|---|---|
| `README.md`, `hub/`, `openwork/apps/app/src/react-app/domains/home/monolith-home.tsx` | Existing branded launcher, task composer and starter cards | Reuse interaction ideas; simplify entry into one workspace |
| `native/start.mjs`, `webui/Dockerfile`, `docker-compose.yml` | Default launcher/build paths still reference OpenWork and the older orchestration stack | New engine presence does not mean migration is complete |
| `monolith-server/` | Chat, schedules, workspace-file APIs, MCP catalog and orchestration modules, with focused test files | Inventory behavior and port only missing capabilities; avoid a second task history or scheduler |
| `engine/core/docs/architecture.md` | Cordis composition, scoped tools, append-only session events, presets, providers, SDKs and extension points | Strong fit for a configurable harness; keep domain behavior outside the agent loop |
| `engine/core/packages/monolith/bundle/cordis.patch.yml` | Product branding, skills, web MCP, schedule and model-gateway composition | Extend the product bundle and declare plugin dependencies |
| `engine/core/packages/client/` | Layout, sidebar, workspace, conversation, approvals, plans, tools, attachments, deliverables and theme packages | Evolve the existing shell rather than introduce a third frontend |
| `ui-layout`, `ui-deliverables` package documentation | Resizable three-column shell; deliverables derived from mutation metadata | Preserve event-driven rendering; add remote-safe preview/download because host-open behavior alone is insufficient |
| `engine/core/packages/monolith/skills/` | Document/data tools and engineering skills | Cowork already has useful tool building blocks; validate document fidelity before promising it |
| Root status/planning documents and `evals/` | Earlier roadmap and benchmark infrastructure refer largely to the older stack | Treat as historical requirements and test ideas, not current pass/fail evidence |
| Repository working tree | Large existing migration/deletion changes, including old `engine/dsh` paths | Preserve current work; establish a reviewed migration baseline before code changes |

The missing product layer is a unified task experience, expert-pack lifecycle, trustworthy knowledge retrieval, domain review surfaces, and deployment consolidation. A production-ready memory graph was not established by this survey.

## 3. Proposed interface

Use warm off-white surfaces, dark neutral text, one restrained terracotta accent, fine borders and generous spacing. Prefer readable text labels and familiar icons. Keep tools, token statistics and plugin internals inside expandable details. Support dark mode using existing theme tokens.

Desktop layout: approximately 240px navigation; flexible main area; optional 360–480px result panel. Conversation text stays about 720–800px wide. Resize the result panel for documents or diffs. On narrow screens use one main pane with navigation and results in drawers.

```text
┌──────────────────┬──────────────────────────────────────┬───────────────────────┐
│ MONOLITH         │ Project / Technical review          │ Results               │
│                  │ [ Cowork | Code ]  Expert: DOC-AI ▾ │                       │
│ + New task       ├──────────────────────────────────────┤ Findings  Document    │
│ Search           │ Verify this requirements document   │                       │
│                  │                                      │ 3 need review         │
│ Projects         │ Plan: inspect → verify → propose     │ 8 suggested fixes     │
│   Product spec   │                                      │                       │
│   Website        │ Reading requirements.docx            │ Finding + source      │
│                  │ Checking selected standard           │ Before / After        │
│ Recent tasks     │                                      │                       │
│   Review spec    │ [ Expand activity ]                  │ [Accept] [Reject]     │
│   Fix tests      │                                      │                       │
│                  │ Ask a follow-up…                     │ [Export reviewed copy]│
│ Knowledge        │ + Files   Tools   Access: Review ▾   │                       │
│ Customize        │                         [Stop/Send]  │                       │
│ Settings         │                                      │                       │
└──────────────────┴──────────────────────────────────────┴───────────────────────┘
```

### Home and navigation

- Home asks “What would you like to get done?” with Cowork / Code above the composer.
- Show a project selector and expert selector: General, DOC-AI, MR.LAW, DR.AI, Create expert.
- Show up to four contextual starters, such as Organize files, Analyze data, Review a document, or Fix a bug. Starters prefill an editable request.
- Keep Projects and recent tasks in the sidebar. Put scheduling under task actions initially, with an Automations page when there are active schedules.
- A task is the user's unit of work. Technical session/run identifiers belong in details, not navigation.
- Model choice is available in the composer footer; advanced provider configuration stays in Settings.

### Cowork

Attach files or choose an accessible folder, describe the result, then start. Present a compact plan when useful, actual progress and result cards. The right panel supports document preview, tables, charts and source citations. Provide download/export and version history. A completed task must show a verified output or explicitly state that no output was produced.

### Code

Use the same navigation, composer and task lifecycle. Show repository and branch in the header. The work panel has Changes, Files, Terminal and Preview tabs. Diff review is the default when files change; a file editor opens only when requested. Start with reliable search, diff, terminal streaming and test results before adding breakpoints, extension marketplaces or a full IDE. A terminal error remains visible even if the model's final prose sounds successful.

### Task controls and states

States: Draft → Queued → Running → Waiting for input / Waiting for review → Completed, Failed or Cancelled. Also represent Interrupted after a restart without a safe resume point. Derive these from durable events and backend state.

Always offer Stop while running and keep the draft when switching views. Reconnection replays events without duplicating actions. Retry shows what already succeeded. If work stops during an external action, mark its outcome unknown until reconciled. Switching mode/expert during a run is deferred until completion or starts a new task; it never silently broadens permissions.

Access choices should be plain language: View only, Review changes, Allow workspace edits. Enforce them on the host, including shell and MCP execution. The mode/expert dropdown is not an authorization mechanism. A review control must pause before the mutation it purports to approve; document findings and generated patch proposals can be reviewed before application.

### Usability acceptance

A first-time user can choose files, start a task and find its result without opening Settings. Include keyboard navigation, visible focus, descriptive icon labels, non-color status cues, adequate contrast, reduced motion and accessible resizing. Test at 1440px, 1024px and 390px. A source citation opens the exact supporting location where available; otherwise explain the weaker location, rather than fabricate a page number.

## 4. Expert packs: configuration plus real capabilities

An expert pack contains instructions, permitted modes, tool requirements, workflows, knowledge collections, memory rules, output schemas, UI renderers and evaluation fixtures. It is more than a system prompt. Keep credential values in the credential provider; packs contain references only.

Proposed versioned manifest fields:

```text
id, version, displayName, description
supportedModes, instructionsRef, skillRefs
requiredCapabilities, optionalCapabilities, credentialRefs
workflowRefs, knowledgeCollectionRefs, memoryPolicy
resultSchemaRef, rendererIds, evaluationSuiteRef
```

Only installed, trusted plugins can provide executable renderers or tools. A user-created pack selects registered capabilities; importing a manifest must not execute arbitrary configuration. Validate required capabilities before starting. Optional failures appear clearly. Pin pack version and resolved configuration to each task for reproducibility.

Customize flow: name and purpose → instructions → tools and access → knowledge → starter workflows → test task → save version. Provide Duplicate expert. Advanced YAML can come later. Existing task runs retain their original pack version when a pack is edited.

| Pack | First workflow | Main output | Domain-specific requirement |
|---|---|---|---|
| General | Files, research, analysis and writing | Files plus concise completion report | Sources and verified artifacts |
| Engineering | Investigate → patch → test → review | Diff and test evidence | Repository scope and reproducible checks |
| DOC-AI | Parse → select standard → verify → review findings → apply selected fixes → validate | Findings, tracked DOCX copy, review report | Exact anchors, original preserved, standard edition recorded |
| MR.LAW | Select jurisdiction/date → research or review → inspect evidence → draft | Cited memo, issue list or proposed clause edits | Separate binding authority from commentary; validate citation existence and applicability |
| DR.AI | Import report → confirm extracted values → explain → prepare follow-up questions | Source-linked report explanation and basic general guidance | Preserve units, report reference ranges and dates; missing context remains explicit |
| Custom expert | Choose an existing workflow and specialize it | A registered result format | Own quality fixtures and access limits |

MR.LAW begins as research and drafting support with professional review before use. DR.AI begins with report explanation and general education, not autonomous diagnosis, prescribing or treatment changes. Do not infer medical urgency solely from an isolated flagged value. Domain reviewers must define and validate escalation behavior before clinical use. These are proposed product limits, not legal or medical advice.

### DOC-AI reference semantics and integration

Source inspection found deterministic checks, multipass LLM review, finding grounding/deduplication, cross-document review, standards inputs, selected-finding fixes, tracked insertions/deletions and comments. Its app supports background processing with Redis/RQ when available and a threading fallback. These are code observations, not verified execution guarantees.

Preserve that workflow through a Python capability adapter rather than copy its frontend, login and storage stack. Proposed operations: parse, start review, inspect progress, retrieve findings, propose selected fixes, apply to a new version, validate, export. Long operations return a job ID and persist ownership, progress and artifact IDs. Add cancellation and idempotency explicitly where the adapter cannot establish support.

First spike: run a small representative DOCX through the existing backend, compare anchors and rendered formatting before/after, and validate tracked changes in a compatible reader. Assess standards coverage as check assistance, not certification. Confirm repository ownership/license and pin a commit before redistribution; no source copying is included in this plan.

## 5. Memory, knowledge and the optional graph

Keep three things separate: task history (what happened), knowledge (source material), and memory (reusable facts/preferences/decisions). Compacted conversation is not automatically verified memory.

Start with an editable vault and a rebuildable search index. A possible local layout is `knowledge/`, `notes/`, `decisions/`, `sources/`, and `attachments/`, with Markdown metadata and stable record IDs. Markdown and attachments are portable source records; search indexes and graph edges are derived views. Use the existing storage abstractions and prototype local full-text search before selecting a vector store. This layout can be compatible with an Obsidian-style vault without requiring Obsidian or its plugin API.

Pipeline: ingest → validate/extract → retain source anchors → chunk → index → retrieve → cite. Apply owner/project/collection access filters before retrieval, including graph traversal and cached results. Add embeddings and reranking only when a retrieval evaluation demonstrates a benefit. Uploaded documents are untrusted evidence, never authority to alter tools or permissions.

Memory records need scope, source, verification status, created/reviewed time and optional expiry. Users can inspect, edit, pin and forget them. Suggest new memories after a task; require explicit selection for sensitive personal, client or health facts. Default isolation is per project/case/patient, with no automatic cross-context recall. Deletion removes derived chunks, embeddings, caches and graph edges under a documented retention policy.

The graph is an optional Knowledge view: Document → supports → Claim; Decision → based on → Source; Case → cites → Authority. Edges retain provenance and distinguish extracted suggestions from user-confirmed links. Begin with backlinks and a local neighborhood, then add filters and expansion. Offer an equivalent searchable list. Graph layout does not provide reasoning or truth by itself.

## 6. Architecture and proposed data ownership

```text
One React workspace: Cowork / Code + Expert + Project
                         ↓
Existing typed controller / projection layer
                         ↓
Shared harness: sessions · tools · approvals · jobs · models
            ↙              ↓                  ↘
    Expert resolver   Knowledge provider   Domain adapters
            ↓              ↓                  ↓
     Scoped presets   Vault + indexes     DOC-AI / connectors
```

Extend the product bundle with focused plugins for workspace UX, expert resolution, knowledge and domain review. Use existing layout slots and controllers where supported; add narrowly scoped extension points where needed. Do not assume every navigation change fits an existing brand slot. Keep the runtime's Service Definition / Provider / Consumer organization and locale-owned UI copy.

Proposed entities: ExpertPackVersion, Task, Run, ArtifactVersion, KnowledgeCollection, SourceDocument, MemoryRecord, Finding and Relation. Task links to existing session IDs; a Run denotes an execution attempt and pins expert/configuration versions. Avoid duplicating the session log as another chat store. Persist model-visible retrieval context and expert changes through session events. Result cards derive from tool evidence, not generated prose.

Host operations should cover expert list/resolve, task start/control, artifact inspect/download, finding review/apply and knowledge search/ingest/forget. Fit these into the existing typed RPC/controller system; do not add parallel REST endpoints without an integration requirement. Mutations validate ownership, input version and idempotency at external boundaries. Domain adapters use credential references and scoped artifact handles, not arbitrary client-supplied host paths.

Organization auth and tenancy require a separate verified deployment gate. The engine's anonymous identity capability is not organizational authorization. Reuse the surrounding auth integration only after verifying server-side workspace, artifact, job and knowledge ownership. No shared organizational rollout before isolation tests pass.

## 7. Known unknowns and how to handle them

| Unknown | Default | Evidence that changes the plan |
|---|---|---|
| Which installation is actually used daily? | Preserve older path while developing new shell separately | Runtime inventory shows workflows unique to that path |
| New-engine parity | Require an explicit capability matrix and smoke tests | Missing critical operations delay launcher switch |
| DOC-AI fidelity and cancellation | Adapter spike before integration commitment | Anchor corruption, formatting loss or unsafe retries require backend work |
| Team size / deployment | Local project isolation first; no multi-tenant promise | Shared deployment becomes first-release requirement |
| MR.LAW jurisdiction and DR.AI audience | Keep packs provisional until defined | Target jurisdiction, clinician review or patient-facing use changes sources and validation |
| Knowledge scale and formats | Small vault, extraction and full-text baseline | Measured retrieval misses or corpus growth justify vector search |
| Graph value | Deferred, derived and optional | Users repeatedly need relationship navigation in real tasks |

## 8. Mechanical work and delivery gates

1. **Baseline and migration map.** Inventory launchers, session formats, tools and important old workflows. Record build commands that actually pass. Preserve existing working-tree changes. Gate: one documented target path and a parity checklist; no default launcher change yet.
2. **Shared shell.** Implement navigation, modes, task header, composer and results panel with real session events. Gate: keyboard/viewport checks plus create, stream, stop, reload, fail and approval snapshots.
3. **Cowork and Code vertical slices.** Produce/download a document; modify a repository and inspect diff/test results. Gate: real artifacts, filesystem scope enforcement and interrupted-run behavior.
4. **Expert registry and builder.** Resolve/version packs into scoped presets, tools and workflows. Gate: a new expert can be saved and run without editing the agent loop; missing tools and invalid packs fail clearly.
5. **DOC-AI pilot.** Wrap Python pipeline, introduce finding cards and apply selected fixes to a new copy. Gate: source anchors, revision conflict checks, document fidelity, repeat-apply behavior and export all validated.
6. **Knowledge and memory.** Add scoped ingest/search/citations and editable memories. Gate: retrieval gold set, cross-project isolation, provenance and complete deletion of derived data. Then pilot MR.LAW and DR.AI with domain reviewers and targeted fixtures.
7. **Optional graph and automations.** Build graph from proven records; converge scheduler ownership and safe resumption. Gate: no duplicate external effects on retry; graph access matches document access.
8. **Deployment consolidation.** Switch native/Docker builds after parity; retain a documented rollback window and read-only export/import path for old sessions. Never reinterpret incompatible session logs in place. Gate: clean install, restart, backup/restore, authentication and ownership tests on target deployments.

First usable release should include the shared shell, Cowork, Code, a basic expert registry and one DOC-AI workflow. Defer full IDE features, graph database, autonomous medical/legal actions and public expert marketplace. Estimate delivery only after baseline and DOC-AI spikes; migration uncertainty dominates visual implementation effort.

Validation uses focused unit and integration tests, user-visible recorded-session snapshots and targeted end-to-end workflows, following the engine's existing testing policy. Domain evaluations measure false positives, missed issues, unsupported claims and source fidelity, not just plausible text. Existing historical benchmark scores must be rerun on the selected runtime before being used as release evidence.

## 9. Review choices before implementation

Recommended defaults to review: (1) newer Cordis engine as the target, (2) two modes with separate expert packs, (3) DOC-AI as the first specialist, (4) vault/search before graph. This planning deliverable does not require a permission pause; implementation is a subsequent task.

## References

- [MONOLITH architecture](engine/core/docs/architecture.md), [product bundle](engine/core/packages/monolith/README.md), [existing platform status](MONOLITH_PLATFORM_STATUS.md) — local sources, with historical status distinguished from inspected code.
- [Claude Cowork](https://claude.com/product/cowork) — reference for handing off tasks over selected files; MONOLITH design above is a proposal, not a parity claim.
- [Claude Code overview](https://code.claude.com/docs/en/overview) — reference for an agent that works with repository tools and development workflows.
- [DOC-AI repository](https://github.com/MrRobot373/DOC-AI-), [review pipeline](https://github.com/MrRobot373/DOC-AI-/blob/main/backend/review_engine.py), [document fixer](https://github.com/MrRobot373/DOC-AI-/blob/main/backend/doc_fixer.py), [app entry](https://github.com/MrRobot373/DOC-AI-/blob/main/backend/app.py) — source inspected for adapter planning; execution not tested here.
