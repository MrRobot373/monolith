# MONOLITH whole-project master plan

Build one dependable, customizable agent platform for Cowork, Code and subject-matter workflows.
Consolidate on the existing Cordis harness, add a coherent product layer, and ship complete workflows in measured stages.
The largest risk is migration and execution correctness—not drawing the interface; verify the target launch path and enforcement before expanding the product.

Prepared 8 September 2026. This supersedes the earlier UI-oriented plan as the implementation roadmap. The earlier `MONOLITH_HARNESS_PRODUCT_PLAN.md` remains a design reference. Proposed types, packages, operations and targets below are recommendations, not claims of existing implementation.

## 1. Decisions that determine the project

| Decision | Recommendation | Alternative | Consequence of changing later |
|---|---|---|---|
| Runtime | Use `engine/core` and its Cordis plugin composition | Continue investing in OpenCode/OpenWork orchestration | High: incompatible session/API and deployment work |
| Frontend | Extend the newer React web client through product plugins | Rewrite from zero, or retain OpenWork permanently | High: duplicate session behavior and UI maintenance |
| Product model | Two modes, independent expert packs, shared projects | Separate applications for each domain | High: repeated integrations, memory and authorization |
| First delivery | Local Windows/browser developer preview; then reproducible Docker pilot | Multi-tenant SaaS and desktop packaging immediately | Medium/high: extra operations before workflows are dependable |
| Code UX | Agent-first by default; focused editor/diff workspace on demand | Full IDE-first experience immediately | Medium: editor breadth consumes the first release |
| Persistence | Keep engine session persistence; SQLite product metadata locally; portable source files | Replace all storage with a cloud database immediately | High if domain logic assumes one storage engine |
| Team deployment | Add verified identity, membership and isolation as a distinct gate | Treat shared tokens as sufficient user identity | High: affects every data and execution operation |
| First specialist | DOC-AI, using an adapter around its Python pipeline | Build all expert products at once | Low early, high after UI/backend duplication |
| Memory | Source-linked knowledge and editable memory before graph | Graph-first storage and interface | Medium: graph alone does not solve retrieval accuracy |
| Customization | Safe configuration over trusted registered plugins | Allow end users to import arbitrary Cordis executable config | High: execution privilege and distribution model |

Default audience: you and a small technical pilot team first. This plan supports a future organizational product, but does not assume an immediate public SaaS launch. If shared deployment is required in the first release, move the organization gate ahead of all pilot access.

## 2. Current project analysis: evidence and implications

This review covered deployment files, both frontend generations, product-sidecar modules, engine architecture and capability documentation, selected source implementations, existing roadmaps/evaluations and DOC-AI source entry points. It was a cross-system architecture review with focused tests, not an exhaustive security audit or every-file review. No live app UI, real provider workflow, Docker build or remote database was exercised in this planning pass.

### 2.1 There are two product generations

**Older path:** `hub` → OpenWork React app → `monolith-server/orchestrator` → OpenCode, with sidecar features and native/Docker wrappers. `native/start.mjs`, `native/setup.mjs`, `webui/Dockerfile` and the root Compose file still describe this route. The native supervisor expects an OpenCode source directory; `native/setup.mjs` can clone it. The inspected `engine/` directory currently contains `core`, so an unconfigured native start requires setup or an override. This is not proof that all deployments are broken: Docker clones OpenCode independently and environment overrides can select another directory.

**Newer path:** `engine/core` contains a plugin-based agent runtime, a React web frontend, typed controllers, SDK surfaces, tools and persistence. `packages/monolith/bundle` provides the product overlay. This is a strong architectural match for the intended configurable harness, but its existence does not prove product parity or launcher migration.

**Action:** choose the newer path as the target and maintain a capability-by-capability migration checklist. Avoid a third frontend or a second new agent loop. Stop adding features to the older path except blockers needed for safe migration.

### 2.2 What to retain, adapt and replace

| Area | Current evidence | Decision |
|---|---|---|
| Agent execution | `engine/core/packages/core`: session, tools, agent, loop, scope | Retain; domain behavior uses extension points |
| Composition | Profiles, bundles and `preset/agent-presets` support per-session plugin composition | Retain; add a safe expert-pack resolver above raw presets |
| Frontend | Client packages cover layout, conversations, workspace, plans, approvals, settings and deliverables | Retain components and event semantics; redesign navigation and task UX |
| Branding | MONOLITH-owned `ui-brand` plugin and theme infrastructure | Extend; brand slots alone cannot implement the whole product shell |
| Cowork tools | MONOLITH skills include document/data scripts and engineering instructions | Reuse, package dependencies, test representative outputs |
| Files | Older `workspace-files.mjs` includes revision checks, protected paths, trash/restore and audit records | Preserve behavior and test cases when adapting to new engine FS services |
| Model routing | Older router plus engine provider adapters, token metering and gateway overlay | Converge configuration and reporting; do not stack independent hidden routers |
| MCP | Older catalog/seeding; newer tool bridge | Reuse catalog metadata; migrate enable/config lifecycle to engine composition |
| Scheduling | Older scheduled-task sidecar; new session-reminder capability | Preserve semantics explicitly; new reminder capability does not replace unattended jobs |
| Storage | Sidecar JSON; newer SQLite domain backend and session log backend | Keep engine log source of truth; move mutable product records through storage services |
| Auth | Basic auth, engine tokens and Supabase request authentication coexist | Separate deployment profiles; unify identity and ownership for team access |
| Evaluation | Manual benchmark scaffolding and large engine test infrastructure | Retain engine tests; automate product and domain scenarios |
| Operations | Native supervisor, Docker, Caddy, backup/restore scripts | Consolidate launch and backup manifests around the target runtime |

### 2.3 Specific findings to turn into work

| Priority | Finding and source | Why it matters | Required action |
|---|---|---|---|
| P0 | Native start/build target older paths; `engine/core` is a separate runtime | Developers can build the wrong product | Establish one target dev command, profile, port and build manifest |
| P0 for shared use | `monolith-server/auth.mjs:isAdminUser` returns true when the admin-email set is empty | Authenticated users can receive admin status under that configuration | Explicit roles; default-deny admin policy; negative tests |
| P0 for shared use | `index.mjs:canAccess` permits ownerless schedules; tests deliberately preserve this | Legacy records are shared, including access through mutations using that check | Quarantine/import ownership before organization rollout |
| P0 for shared use | `webui/Dockerfile` includes a host-token build argument/environment | Browser build inputs must not carry privileged server credentials | Audit generated assets and usage; remove host secret from client build contract |
| P0 for remote claims | Windows sandbox documentation reports partial write restriction, not read/network confinement | A workspace-write badge cannot promise complete machine isolation | Display actual capability and use a stronger execution boundary where required |
| P1 | `scripts/backup.sh` enumerates volumes without `monolith_sidecar`, present in Compose | Scheduled tasks/product state can be omitted from backup | Inventory all stores; consistency-aware backup and restore drill |
| P1 | `jobs-local` explicitly keeps in-memory records and jobs die with the process | Long-running work is not automatically restartable | Persistent run registry, worker leases and explicit interrupted state |
| P1 | New `schedule` delivers to live sessions; cold sessions remain overdue | “Runs every day” would overpromise current behavior | Build durable scheduler/worker service for unattended workflows |
| P1 | New MCP bridge supports tools, not resources/prompts | A connector can connect while expected capabilities are unavailable | Expose compatibility and implement extra faces only when needed |
| P1 | Deliverable UI focuses on host file opening | A remote browser needs authorized preview/download | Artifact service and supported viewer registry |
| P1 | Old roadmap assumes OpenCode and a second ledger | Blindly executing it duplicates features now owned by the new engine | Retire conflicting instructions; one current roadmap with supersession links |
| P2 | No `.github` directory at inspected root or engine root | Hosted CI wiring was not established by this survey | Add CI workflow or document the actual external CI provider |

These findings have different scopes. The default-admin behavior is an inspected authorization rule; actual internet exposure was not established. The host-token item identifies a build contract requiring investigation, not a claim that a deployed bundle was inspected and found to contain a secret.

### 2.4 Checks executed during this review

Environment: Node `v24.15.0`; `pnpm.cmd` `11.4.0`. PowerShell rejected `pnpm.ps1` due to execution policy; using `pnpm.cmd` worked without changing that policy.

```powershell
node --test monolith-server/workspace-files.test.mjs monolith-server/router.test.mjs monolith-server/schedules.ownership.test.mjs monolith-server/orchestrator/auth.test.mjs
# 36 passed, 0 failed

# Working directory: engine/core
pnpm.cmd exec vitest run packages/interaction/permission-presets/tests/permission-presets.spec.ts packages/monolith/ui-brand/tests/browser-plugin.client.spec.tsx
# 2 files, 31 tests passed
```

Total: 67 focused tests passed. This does not validate launchers, sandbox confinement across every tool, document fidelity or all authorization paths. One passing test explicitly preserves the ownerless-schedule behavior that must change for team use. Vite emitted a non-failing tsconfig-paths plugin warning; handle it separately from product-critical work.

The historical `41/90` evaluation is a July result with provider/model unrecorded. It cannot be used as the current engine score. Retain its failure scenarios and establish a fresh baseline.

## 3. Product scope and vocabulary

The product should let a user give an outcome, provide relevant context, watch understandable progress, review consequential changes, and receive usable verified outputs. It should also let an administrator package repeatable domain workflows without forking the application.

| Concept | Meaning | Example |
|---|---|---|
| Mode | How the user works | Cowork or Code |
| Expert | Domain capabilities and workflow defaults | DOC-AI, MR.LAW, DR.AI |
| Project | User-facing container for related work | Website, contract matter, technical specification |
| Workspace | Execution location and access scope | Local directory or isolated remote filesystem |
| Task | Requested outcome and review history | Fix failing tests |
| Run | One execution attempt for a task | First attempt, retry after interruption |
| Artifact | Versioned output with evidence | DOCX, spreadsheet, patch, report |
| Knowledge | Source material the agent can retrieve | Standards, manuals, case materials |
| Memory | Reusable preference, fact or decision | Approved terminology for this project |
| Workflow | Repeatable steps with typed inputs/outputs | Verify technical document |

Initially a project maps to one workspace, but use distinct IDs so future remote workspaces do not force a domain rewrite. A project may hold many tasks. Runs link to engine sessions; do not create a competing conversation persistence system.

Release boundaries:

- **Developer preview:** target launcher, trustworthy task lifecycle, basic Cowork and Code, artifacts and scoped access.
- **Pilot release:** expert registry, DOC-AI workflow, knowledge search and feedback, installation/backup checks. Team access requires the separate organization gate.
- **Platform release:** durable automations, reviewed expert builder, organization administration, MR.LAW/DR.AI pilots and optional graph.

## 4. Target architecture and ownership

```text
Browser: shared React shell
  Cowork / Code · Projects · Tasks · Knowledge · Customize
                         |
Typed product controllers + authorization + projections
                         |
Cordis harness
  Session log · tools · approvals · models · filesystem · jobs
        |                   |                    |
Expert resolver      Knowledge services      Domain adapters
        |                   |                    |
Trusted presets      Vault and indexes      DOC-AI Python worker
        |                                        |
Capability policy                          Versioned artifacts

Deployment: launcher/profile · credentials · diagnostics · backup
Team deployment adds: identity/membership · isolated execution · shared storage
```

**Runtime owns** agent execution, tool events, conversation history, model requests, approval hooks and cancellation. **Product services own** task identity, expert versions, artifact review, project metadata and user-facing configuration. **Domain adapters own** technical checking/formatting and source-specific logic. **UI owns** rendering and interaction, never authority to approve its own operations.

Use the existing typed controller/RPC and projection system. Introduce a new HTTP API only for a specific external integration. Every model-visible expert instruction or retrieved source must be reconstructable from the session log, following the existing engine invariant. Projections are derived views and can be rebuilt.

Suggested product modules under `engine/core/packages/monolith/`:

| Proposed module | Responsibility | Existing integration |
|---|---|---|
| `product-workspace` | Project/task/run records and controllers | Workspace, session and storage services |
| `ui-workbench` | Navigation, task header and work panels | Client slots, layout, conversation and theme |
| `expert-packs` | Manifest validation, versioning and safe preset resolution | Agent presets, persona, skills and tool registry |
| `artifacts` | Output registration, versions, preview/download and review | Tool metadata, filesystem and session events |
| `knowledge` | Ingest/search/citations/memory lifecycle | Storage, jobs, context injection and tools |
| `docai-adapter` | Python job protocol and finding results | Jobs, subprocess/MCP and artifacts |
| `automation` | Durable schedules and workflow runs | Schedule/job capabilities and session creation |
| `access` | Product ownership and role enforcement | Verified identity and capability policy |

These are responsibility groups, not a requirement to generate eight empty packages immediately. Add a module when its first complete workflow needs it; follow the repository's Service Definition/Provider/Consumer conventions and package dependency gates. Do not directly edit vendored agent-loop code for domain behavior.

## 5. UI and UX plan

### 5.1 Navigation and visual direction

Use a calm desktop workbench: approximately 240px sidebar, flexible central task area, optional 360–480px results pane. Warm neutral light theme and equivalent dark theme; restrained accent; 8px spacing rhythm; readable body text; existing tokens and locale system. Keep tool internals collapsed and make status text explicit.

Sidebar: New task, Search, Projects, recent tasks, Knowledge, Customize and Settings. Automations appears once that feature is real. Admin appears only for authorized roles. Avoid a launcher site followed by a second workspace site; land directly in the app and preserve old links through redirects where practical.

Header: Project → task title, Cowork / Code, Expert selector, task status. Composer: request, attachments, context, access and model. Put provider URLs, JSON configuration and token breakdowns in Settings/details.

Home shows one request box and up to four starters based on mode/expert. Ordinary chat and research are supported workflows, not extra top-level modes. Users can start a general question without choosing a specialist.

### 5.2 Essential screens and their states

| Screen | Main content | Required non-happy paths |
|---|---|---|
| Setup | Runtime/model health, workspace selection, optional account | Missing runtime, unavailable model, invalid credentials, inaccessible folder |
| Home | Composer, mode/expert, recent work | No project, no tools, offline |
| Project | Tasks, files, knowledge and instructions | Missing directory, permission revoked, archived project |
| Task | Plan, conversation, activity, review and results | Reconnect, interruption, partial success, failed tool, cancellation |
| Code workbench | Changes, Files, Terminal, Tests, Preview | Dirty editor, revision conflict, large/binary file, failed build |
| Artifact viewer | Preview, versions, download and sources | Unsupported format, missing artifact, expired access |
| Knowledge | Collections, ingest status, search, notes and optional graph | Extraction failure, stale sources, no evidence, deletion pending |
| Customize | Experts, workflows, skills, connections | Missing dependency, incompatible version, failed connection |
| Settings/Admin | Models, access, budgets, storage, diagnostics | Provider outage, exhausted budget, insufficient role |

### 5.3 Cowork interaction

Choose files/folder → describe deliverable → inspect plan where helpful → run → review → download. Task progress reports actual steps, not a fabricated percentage. Result panel shows the output early and keeps source references nearby. For file organization, display a proposed move list before applying. For spreadsheets, show affected sheets/ranges and formula checks. For reports, distinguish source-backed facts from analysis.

Separate “generate a new copy” from “modify original.” Default to versioned copies for document workflows. Allow meaningful undo only when the underlying operation can actually be reversed. An email sent through a connector is not undoable merely because a UI toast says Undo.

### 5.4 Code interaction

Start with conversation plus Changes panel. Clicking a file opens an editor/diff, expanding the workspace. Provide manual file editing, lazy file tree, full-text search, git status, controlled terminal and captured test output. Full editor mode is optional rather than forced for every task.

Manual and agent edits share revision checks. Never overwrite a dirty editor silently. Keep an agent change proposal tied to a base revision; stale proposals require rebase or regeneration. Introduce isolated Git worktrees for concurrent coding tasks where supported, with explicit branch ownership. Do not auto-stage, commit or discard pre-existing user changes.

Use the existing editor/rendering components if adequate; if a richer editor is required, evaluate an established embeddable editor in a time-boxed spike. Full VS Code extension compatibility, debugger integration and collaborative cursors are later features.

### 5.5 Review, status and accessibility

States: Draft, Queued, Running, Waiting for input, Waiting for review, Completed, Failed, Cancelled and Interrupted. A plan describes intentions; activity shows execution; results show verified outputs. Do not collapse all three into a stream of chat messages.

Stop stays visible while running. Switching tabs preserves drafts. Reconnect shows recovery state and replays events without duplicating execution. Retry identifies which actions already completed. Make partial success explicit with recoverable outputs.

Support keyboard navigation, focus restoration after dialogs, accessible resize controls, screen-reader status announcements, reduced motion, contrast checks and non-color status cues. At 390px use one pane and drawers; do not compress three columns. Test 1440px and 1024px desktop widths as well.

## 6. Shared harness features and implementation

### 6.1 Task/run lifecycle

Wrap the existing session lifecycle in a product Task service. Pin mode, expert version, workspace, effective tool access, model policy and source revisions at run start. Map engine events to product status. Use compare-and-set revisions on user decisions and idempotency keys on task-start/retry commands.

Proposed command vocabulary: `startTask`, `cancelRun`, `resumeTask`, `submitDecision`, `inspectTask`. These are planned operations to fit the existing typed system, not current API signatures. Distinguish resuming an engine session from resuming an external long-running job.

Acceptance: reload does not lose the task; double-submit starts one run; cancellation remains visible; failed tools cannot be presented as successful actions; expert/access changes cannot affect an in-flight run silently.

### 6.2 Tools and policy

Classify operations as read, workspace mutation, external mutation, process execution and network access. Resolve policy on the host. A friendly preset bundles policy settings but cannot replace enforcement. File checks alone cannot contain a shell process; MCP processes must receive equivalent deployment-level isolation.

“Review changes” requires staging/proposals before applying, not merely showing a diff after a write. For workflows unable to stage arbitrary shell effects, clearly scope what requires approval. Enforce explicit read-only restrictions without relying on shell-string keyword filters as the security boundary.

Acceptance: test path traversal, junction escape, outside-workspace writes, shell writes and connector external writes independently. Report unsupported confinement and fail closed for workflows that require it.

### 6.3 Artifact service

Register output only after verifying file existence, size, checksum and MIME/content type. Store ArtifactVersion records tied to run and tool evidence. Provide authorized streaming downloads and format-specific preview. Escape HTML and isolate active previews; do not execute generated scripts under the app's authenticated origin.

Artifact previews should support text, images and PDF first, then rendered office documents. For code, a patch/diff is a review artifact. For technical review, findings and corrected document are separate artifacts. Track source and output versions so an old review cannot apply to a new document accidentally.

### 6.4 Model and context management

Retain provider adapters and credential references. Establish one model catalog with capabilities, availability, context limits, vision/tool support and deployment-approved routes. Local-only must forbid cloud fallback. A budget cap must not cause an undisclosed switch to an unapproved provider.

Log routing decisions and actual provider-reported usage; label heuristic token/cost estimates. Fix the older router's disabled semantics during consolidation: its current disabled path still uses heuristic routing. Define whether disabled means fixed model or explicit user selection, and test it.

Use model capability tests before offering a route for DOC-AI vision or tool-heavy Code tasks. Add cancellation/timeouts, bounded retries, provider-health diagnostics and configurable per-task budgets. Do not retry an external mutation merely because the model request failed afterward.

### 6.5 Integrations and skills

Move the catalog from OpenCode-shaped config seeding to the target engine's connection lifecycle. Show Connected, Needs credentials, Unavailable and Unsupported capability. Pin server/package versions and preserve credential references. Apply tool scoping so every installed server does not add its complete schema to every model request.

Distinguish an instructional skill from an executable connector and from an expert pack. Package the Python dependencies for shipped document skills reproducibly. Make installation version-aware so product updates do not overwrite user-edited skills without an explicit conflict strategy.

## 7. Customizable expert platform

The same runtime should support all domains through a safe manifest and registered capabilities.

```text
ExpertPackVersion
  id, version, name, purpose, supportedModes
  instructionsRef, skillRefs
  requiredCapabilities, optionalCapabilities, credentialRefs
  workflowRefs, knowledgeCollectionRefs, memoryPolicy
  inputSchemaRef, resultSchemaRef, rendererIds, evaluationSuiteRef
```

The raw engine preset is privileged: its documentation compares authored presets to shell access. Therefore the end-user builder must compile safe choices into trusted presets. Ordinary users cannot import arbitrary executable Cordis configuration or remote renderer code. Trusted administrators install executable extensions; experts select among them.

Builder UX: Duplicate template → define purpose → select tools/access → attach knowledge → define starters/output → run sample → save version. Start with a basic form and templates; visual workflow graphs can follow after real repeatable workflows exist.

Version expert instructions, workflows and retrieval configuration. A task pins its version. Validate required tools before running. Domain-specific result renderers consume typed, validated results. General chat remains the fallback presentation, not the only output format.

A new expert is considered successful when it can be created without changing the agent loop, passes its sample evaluation, retrieves only its authorized knowledge, and exposes a meaningful result for its domain.

## 8. DOC-AI implementation plan

Use DOC-AI as the first specialist because the supplied repository already contains a parser, deterministic and LLM review passes, standards checks, finding grounding, selected fixes and tracked DOCX edits. This is source-observed capability, not a tested integration guarantee. Reference: [DOC-AI source](https://github.com/MrRobot373/DOC-AI-).

### User workflow

Upload DOCX/PDF → choose document type and standard edition → review extraction → run checks → inspect anchored findings → accept/reject proposed changes → create reviewed copy → rerun relevant validation → export original, corrected copy and review report.

Support DOCX fixing first. PDF review does not imply reliable PDF editing; initially export a findings report and, when available, modify the original editable source. Exact printed-page positioning may require a rendering engine; paragraph/table anchors are a truthful fallback.

### Adapter design

Wrap Python functions through a versioned worker protocol. Begin with a supervised subprocess job adapter; use service/MCP transport if deployment needs isolation across machines. Do not import DOC-AI's frontend, authentication, account store or provider-key pool into MONOLITH.

Proposed operations: parse, review, poll/cancel, list findings, propose fixes, apply selected fixes to a copy, validate and export. Each job uses an owner-scoped working directory, bounded time/output and artifact IDs. Avoid global mutable settings across users. Prefer the harness model gateway through a small client adapter where compatible.

Finding fields: stable ID, category, severity, source version, location, quoted evidence, explanation, suggestion, fix type, checker/model provenance and review state. Use source revision and exact anchor checks before applying. Preserve comments, tables, numbering, runs and formatting where supported; explicitly report unsupported transformations.

### Integration gates

1. Pin reference commit and establish reuse/license permission.
2. Exercise an unchanged backend on representative documents; record runtime and dependency requirements.
3. Compare extracted locations and proposed fixes with a human-annotated fixture set.
4. Validate tracked edits in a compatible document reader and inspect rendered pages.
5. Test duplicate apply, stale review, worker crash, cancellation, mixed-language text and malformed input.
6. Measure false positives and missed findings; never call standards checks certification.

Pilot output: one complete review-and-fix workflow, not every DOC-AI feature at once. Cross-document consistency, batch processing, OCR and advanced standard packs follow measured demand.

## 9. MR.LAW, DR.AI and other specialists

### MR.LAW

Start with legal research and document review assistance. Require a selected jurisdiction and relevant date when material. Knowledge collections distinguish legislation, decisions, official guidance, secondary commentary and private matter documents. Results retain exact citations, source dates and limitations in the available corpus.

First workflow: contract → issues and source evidence → proposed clause revisions → reviewer decision → versioned draft. A later workflow can build a matter chronology and cited research memo. Do not present a generated citation as verified until retrieval establishes that it exists and supports the claim. Professional review precedes use of consequential output.

Implementation needs source adapters, source-version/edition metadata, jurisdiction filters, citation resolution, clause anchors and a dedicated evaluation set. It cannot be delivered merely by adding “you are a lawyer” to a prompt.

### DR.AI

Start with explaining supplied reports and preparing basic general guidance and questions for a clinician. Preserve patient/context separation, dates, units, report-provided reference ranges and extraction confidence. Ask the user to confirm uncertain OCR values before interpreting them. Distinguish a report's own abnormal flag from an agent inference.

First workflow: report → structured extracted values → user confirmation → source-linked explanation → questions for follow-up. No autonomous diagnosis, prescribing, treatment changes or broad urgency conclusions from isolated values. Qualified reviewers define and validate escalation behavior before patient-facing rollout.

Implementation needs structured extraction, unit/range provenance, privacy-aware memory defaults, viewer support and domain evaluation. Avoid a global patient-memory collection; one authorized patient context per task.

### Any other subject expert

Use the same recipe: narrow workflow, trusted knowledge, tool set, typed result and evaluation. Example packs: technical writer, finance analyst, education tutor or procurement reviewer. Domain output and evaluations vary; sessions, permissions, artifacts and memory lifecycle stay shared.

## 10. Knowledge, memory and an Obsidian-style graph

### Storage and retrieval

Separate source documents, extracted text, derived indexes, task history and memory. A local vault can use Markdown notes with stable IDs and attachment files; product metadata/indexes live in SQLite through storage abstractions. Treat the vault as portable source records and the search/graph as rebuildable views. Do not force a graph database into the first release.

Ingest: validate file → hash/version → extract text and anchors → flag uncertain OCR → chunk by document structure → index → publish collection revision. Start with full-text search plus metadata filters. Add embeddings/hybrid ranking when a gold-set evaluation demonstrates improvement; external embeddings count as sending source content to a provider and must obey data-routing policy.

Retrieval: authorize collection → query → rank → return bounded passages with source/anchor → log used evidence → render citations. Apply authorization before ranking, graph traversal and cache hits. Avoid revealing forbidden source titles, counts or snippets. Documents and web content are data, not new system instructions.

### Memory lifecycle

Scopes: personal preferences, project decisions and domain-case facts. Each memory has provenance, verification state, created/reviewed date, optional expiry and user-edit history. Suggest memories; do not silently promote all chat summaries to durable facts. Require explicit selection for sensitive personal/client/health information.

Users can inspect “what this task used,” correct an entry, resolve contradictory notes and forget data. Edits/deletions invalidate dependent chunks, embeddings, caches and graph edges. Backups have a documented retention period; deletion from live retrieval does not falsely promise immediate removal from every backup.

### Graph phase

First ship backlinks and a list of related records. Then add an optional graph: Source supports Claim, Decision based-on Source, Document revises Document, Case cites Authority. Every edge has provenance and distinguishes inferred from confirmed relationships. Open a local neighborhood rather than thousands of nodes. Filters include project, relation, source type and verification state.

Keep a list/table alternative for accessibility and practical search. Import/export Obsidian-compatible Markdown and links where feasible; avoid depending on private Obsidian internals. A graph visualizes stored relationships—it does not make the harness reason like a human brain.

## 11. Data model, storage and migration

Proposed records:

| Record | Important fields / rules |
|---|---|
| Principal / membership | Stable user ID, organization ID, role; no email as canonical ownership key |
| Project | Owner/organization, title, workspace reference, instructions revision |
| Workspace | Execution location, filesystem root reference, provider and policy |
| Task | Project, mode, title, expert version, status projection, session references |
| Run | Task, attempt, model/access snapshot, start/end, error, idempotency key |
| ArtifactVersion | Run, content hash, MIME, size, storage reference, parent/source version |
| ExpertPackVersion | Immutable manifest and resolved dependency versions |
| KnowledgeCollection / SourceVersion | Ownership, source URI/file, revision, extraction state and anchors |
| MemoryRecord | Scope, statement, evidence, verification, expiry and edit history |
| Finding / ReviewDecision | Source revision, location, suggested change, reviewer and decision revision |
| Automation / Job | Workflow version, schedule/timezone, lease, attempts, next run and outcome |
| Audit record | Actor, action, target, decision, run linkage and timestamp; redacted values |

Retain engine session log formats and crash-recovery behavior. Do not convert them into ad hoc JSON chats. Task status can be a projection, while task ownership and expert versions are product records. New durable model-visible facts use engine session events.

For local mode, prefer existing SQLite domain storage for frequently updated records and file-backed artifacts. Keep document extraction and large indexing work off the UI/server's critical request path; the current SQLite backend uses synchronous statements, which needs profiling under load.

For team mode, use a shared relational metadata provider and authorized object/file storage. Supabase is an available direction given existing auth code; implementing it requires separate migrations, ownership policies and tests. Do not assume the engine already has a suitable product Postgres provider. Keep local storage supported through a small explicit provider interface, not a generalized database framework.

Migration procedure: inventory → snapshot/export → import into a new store with format/version checks → compare counts/hashes → run ownership and sample-open checks → switch target launcher → retain old store read-only for rollback. Do not dual-write incompatible chat formats or run both schedulers for the same automation. Ownerless data requires explicit assignment, not public fallback.

## 12. Security, identity and deployment profiles

This is necessary product engineering for a harness that can edit files and use credentials. Prioritize actual findings, not a generic compliance checklist.

**Local trusted mode:** bind to loopback; no public account required; verify origin/host handling and protect local control endpoints from hostile web pages. The user chooses accessible workspaces. Credential storage and logs stay outside model-readable workspaces where possible. Local-only data routing forbids remote model/embedding calls.

**Team mode:** verified identity at the server; organization membership; project/workspace ownership on every controller, artifact download, job, websocket/event stream and retrieval request. A shared engine token is service authentication, not an end-user role. Keep privileged host and provider keys out of browser bundles.

Supabase-backed shared tables need both grants and row policies; authenticated status alone does not establish ownership. Keep secret/service-role credentials server-side. Use trusted role/membership records, not user-editable metadata, and test access after revocation. Sources: [RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security), [JWT documentation](https://supabase.com/docs/guides/auth/jwts).

**Execution boundary:** use workspace policies plus process isolation appropriate to the deployment. The Windows ACL backend documents partial write restriction and no general read/network confinement. Remote untrusted/team work requires a validated stronger boundary; containerization alone still needs mount, user, secret and network policy. Never advertise a sandbox guarantee the active provider does not supply.

**Content and integrations:** defend against archive/path traversal and oversized uploads, isolate previews, redact logs and avoid sending secrets in error details. Test document prompt injection against tool policy. Connector authorization cannot be expanded by an expert's instructions.

## 13. Automations, workflows and background execution

Treat session reminders and unattended automations as different products. Keep reminders for a live conversation. For automations, implement durable schedules that create owned workflow runs independently of whether a browser or session is open.

Required behavior: timezone-aware schedule, daylight-saving policy, missed-run policy, concurrency cap, worker lease/heartbeat, retry limit, cancellation, timeout and audit. Recheck credentials and permissions at execution time. A workflow waiting for human review pauses and becomes visible; it must not convert a missing reviewer into automatic approval.

Use at-least-once delivery with operation idempotency and reconciliation, rather than promising exactly-once external effects. A worker crash after an external write may leave an unknown result; query the external system before replaying it. Record run IDs on supported remote operations.

Begin with one worker process and a durable local queue appropriate to the local storage provider. Add a shared queue provider for team deployment only after worker semantics are stable. Do not build an arbitrary visual workflow orchestrator in the first sprint.

## 14. Operations, diagnostics and developer experience

- **One supported launch path:** the `monolith` CLI with a named product profile. Native and Docker select the same bundles/configuration concepts; wrappers only supply paths, credentials and process supervision.
- **Setup/doctor:** verify Node/package manager, installed bundles, Python tools, model reachability, writable directories and active confinement. Report actionable fixes and distinguish optional from required tools. Do not silently install everything or perform paid probes by default.
- **Reproducible builds:** pin dependencies and lockfiles, record runtime/bundle versions, package Python requirements and avoid unpinned best-effort installs for required capabilities.
- **Configuration:** validate at startup; redact secret fields; provide a configuration example and migration notes. Keep separate local/staging/team profiles.
- **Diagnostics:** health for process liveness; readiness for required dependencies; structured errors for provider, permissions, tools and storage. A redacted support bundle includes versions, selected config and recent failure IDs.
- **Observability:** correlate task/run/session/tool/job IDs. Measure first response, tool latency, failure rate, cancellations, context pressure, queue delay and artifact completion. Avoid storing raw sensitive prompts as default analytics.
- **Backups:** enumerate metadata, sessions, artifacts, knowledge and configuration from the active profile. Use SQLite/database-consistent methods; do not tar a live database blindly. Protect credential backups and test restoration into a separate instance.
- **Release process:** build, focused tests, snapshots, clean-install smoke, upgrade/import test and restore drill. Record known limitations; keep a rollback path with compatible artifact versions.
- **Documentation:** make this roadmap current authority; mark older OpenCode-specific plans superseded where they conflict. Keep implementation notes during each build phase and update actual verified status.

## 15. Quality plan and measurable targets

Targets below are proposed acceptance goals, not measured performance claims. Adjust after collecting baseline data on specified hardware and corpus size.

| Area | Gate |
|---|---|
| Task lifecycle | Create/stream/stop/reload/reconnect/failure/approval all pass; double-submit creates one run |
| Execution access | Negative tests for FS, shell, MCP and external mutations; no critical policy bypass in release fixtures |
| File concurrency | Stale writes rejected; dirty editor protected; unrelated user edits preserved |
| Artifacts | Every result chip resolves to an authorized verified artifact or explicit missing state |
| Domain findings | Human-labeled precision/recall and anchor fidelity reported; thresholds set with domain reviewer |
| Retrieval | Gold set covering direct answer, contradictory sources and no-answer cases; unauthorized retrieval always denied |
| Memory | Correct scope, provenance, correction, expiry and derived-data deletion verified |
| Automation | Restart/missed schedule/duplicate delivery/revoked credentials/unknown external outcome covered |
| UI | Keyboard and screen-reader smoke; 390/1024/1440px layouts; no hidden critical status |
| Performance | Initial target: common local navigation/search feels immediate; measure p50/p95 and set numeric budgets after baseline |
| Operations | Clean install, health failure, backup and restore tested on the supported profile |

Testing layers: pure unit tests for resolution/validation; integration tests for capability seams and persistence; recorded-session snapshots for user/model-visible behavior; E2E for complete workflows; domain evaluations for output quality. Existing engine instructions require relevant SDK fixtures if session/lifecycle changes affect them. Run targeted local gates; let CI own exhaustive/platform matrices.

Product evaluation fixtures should include: read-only task, generated document, spreadsheet with formulas, bug fix with tests, dirty-repo patch, document with planted issues, adversarial source instructions, unavailable provider, cancelled tool, stale review and cross-project retrieval. Retain original historical scenarios while recording current provider/model/version and actual tool evidence.

## 16. Implementation phases and dependency gates

Effort ranges are planning estimates for experienced full-time implementation, excluding external domain review and unexpected upstream repair. They are not promised completion dates. Re-estimate after Phase 0. Two engineers can split UI and services after interfaces are agreed; a solo developer should complete each vertical slice sequentially.

| Phase | Work and affected areas | Depends on | Acceptance / output | Rough effort |
|---|---|---|---|---|
| 0: Baseline and decisions | Launch inventory, preserve working tree, target profile, capability map, fresh smoke fixtures | None | A reproducible new-engine dev session; explicit old/new parity gaps | 3–5 developer-days |
| 1: Runtime/product foundation | Task/run ownership, event projections, policy mapping, artifact identity, model config | 0 | One request runs, cancels, reloads and returns a verified artifact | 8–12 developer-days |
| 2: Shared UI and Cowork | Shell, onboarding, task/review states, files, preview/download, document workflow | 1 | Nontechnical user completes one real file task without Settings | 8–12 developer-days |
| 3: Code workbench | Tree/search, editor/diff, revision handling, terminal/test output, git context | 1–2 | Bug fix preserves user changes and shows actual test evidence | 8–12 developer-days |
| 4: Expert packs and DOC-AI | Safe manifests, templates, worker adapter, findings and reviewed DOCX export | 1–3; adapter spike can begin in 0 | Expert version pinned; selected fixes validated end to end | 10–16 developer-days |
| 5: Knowledge and memory | Ingest, source anchors, retrieval, citations, memory editor and deletion | 1, 4 | Grounded answers and isolation tests on an agreed corpus | 10–15 developer-days |
| 6: Organization/deployment gate | Identity/roles, shared storage provider, isolation, native/Docker consolidation, backup/restore | 1; before any shared pilot | Unauthorized operations denied; clean install/restore work | 10–18 developer-days |
| 7: Automation | Durable scheduler/worker, workflow versions, retries and review waiting | 1, 4; 6 for team execution | Closed-browser run and crash recovery without duplicate effects | 8–12 developer-days |
| 8: Additional domains and graph | Reviewed law/health packs, source adapters, backlinks/graph | 4–6 | Domain evaluation accepted; graph preserves source permissions | Estimate after domain scope |

Phases 0–4 define the first useful product milestone; Phase 6 moves earlier if users will share the service. Do not wait for graph or every specialist to release a dependable developer preview.

## 17. Start here: the first ten working days

This is a sequencing guide, not a requirement to fit uncertain work into a calendar deadline.

| Days | Concrete work | Deliverable |
|---|---|---|
| 1–2 | Review existing migration changes; document target runtime; reproduce a model-free test and one explicit provider smoke in an isolated workspace | Baseline report and launch instructions |
| 3 | Compare old/new capabilities; resolve task/project/session and ownership model | Small ADR plus typed design sketch |
| 4 | Verify bundle composition and product shell extension points | New-engine product shell mounting existing conversation |
| 5 | Implement one task-start/status projection and reload behavior | Task survives navigation and reload |
| 6 | Add host policy mapping and negative mutation tests | Effective access visible and enforced for the chosen tools |
| 7 | Add artifact registration and authorized download | Generated text/document result opens from browser |
| 8 | Implement compact activity and failure/cancel UI | Actual tool failure and stop remain visible |
| 9 | Run DOC-AI adapter spike on representative DOCX | Grounding/formatting findings and integration estimate |
| 10 | End-to-end review of one Cowork and one Code fixture; update backlog | Evidence-based next sprint and documented blockers |

If the target runtime does not boot reproducibly by Day 2, spend the next days fixing that rather than starting decorative UI. Do not repair the old launcher by cloning another engine merely to avoid making the target decision.

## 18. Prioritized implementation backlog

Each item should become a reviewable ticket with a fixture and acceptance evidence. IDs are proposed tracking IDs, not existing issues. S: roughly 1–2 days; M: 3–5; L: 6–10; split an item that grows beyond its estimate. These are overlapping work packages within the phase estimates, not additional time.

| ID | Priority | Ticket / acceptance | Dependencies | Size |
|---|---|---|---|---|
| F01 | P0 | Reproduce target profile; document one launch command and required environment | — | M |
| F02 | P0 | Build old/new capability and data migration matrix | F01 | S |
| F03 | P0 | Define project/task/run ownership and controller operations | F02 | M |
| F04 | P0 | Map task status from durable events; reload and double-submit checks | F03 | M |
| F05 | P0 | Host access presets with effective-capability reporting and negative tests | F01,F03 | L |
| F06 | P0 shared | Default-deny admin and migrate ownerless schedules; stable owner IDs | F03 | M |
| F07 | P0 shared | Remove privileged credentials from client build inputs; bundle scan | F01 | M |
| F08 | P1 | Artifact version registry plus authorized inspect/download | F03,F05 | M |
| U01 | P1 | Shared navigation and Cowork/Code header on existing shell | F01,F03 | M |
| U02 | P1 | Setup health and provider/workspace selection | F01 | M |
| U03 | P1 | Task activity, review, stop/retry and interrupted UI | F04,U01 | M |
| U04 | P1 | Artifact previews and versions with unsupported-format state | F08,U03 | M |
| C01 | P1 | File tree/search/editor with protected and large-file states | F05,U01 | L |
| C02 | P1 | Revision-safe diff review and dirty editor conflict workflow | C01,F08 | L |
| C03 | P1 | Terminal/test/Git evidence panel; preserve existing changes | C02 | M |
| E01 | P1 | Expert manifest registry, validation and version pinning | F03,F05 | M |
| E02 | P1 | Safe template duplication and expert configuration form | E01,U01 | M |
| D01 | P1 | Pin and evaluate DOC-AI worker adapter on fixture documents | F01 | M |
| D02 | P1 | Findings/anchors/review decisions and selected-fix export | D01,E01,F08 | L |
| K01 | P1 | Scoped source ingest/versioning with extraction failure recovery | F03,F08 | L |
| K02 | P1 | Full-text retrieval, source links and evidence logging | K01 | M |
| K03 | P1 | Editable memory, provenance, expiry and deletion invalidation | K02,E01 | M |
| M01 | P1 | Unify model/connection catalog, explicit routing and local-only policy | F01,F05 | M |
| O01 | P0 shared | Organization ownership across APIs/streams/artifacts/retrieval | F03,F06,F07 | L |
| O02 | P1 | Target native/Docker builds and clean-install smoke | F01,F02 | L |
| O03 | P1 | Complete backup inventory and isolated restore drill | F08,O02 | M |
| Q01 | P1 | Automate product smoke fixtures and wire CI gates | F04,F05,F08 | M |
| A01 | P2 | Durable workflow queue with leases and interrupted recovery | F04,E01 | L |
| A02 | P2 | Timezone-aware schedules and review-aware automation UI | A01,U03 | M |
| S01 | P2 | MR.LAW scoped workflow, source resolver and reviewed evaluation | E01,K02,O01 for shared use | L |
| S02 | P2 | DR.AI extraction confirmation and reviewed explanation workflow | E01,K02,O01 for shared use | L |
| G01 | P3 | Backlinks and optional provenance-aware local graph | K03 | M |

## 19. Open questions, defaults and pivot conditions

| Unknown | Working default | What would change the plan |
|---|---|---|
| Your daily runtime and must-keep workflows | Treat both old and new paths as migration inputs | A required older workflow changes parity priority |
| Solo or team deployment first | Local preview before shared pilot | Immediate team use moves O01/F06/F07 forward |
| Code editor depth | Agent-first with a usable focused editor | Heavy manual coding justifies deeper IDE investment |
| Knowledge size/languages | Modest corpus with full-text baseline | OCR-heavy/multilingual/large corpus changes extraction/ranking choices |
| Law jurisdiction and source licensing | Unspecified, so no broad legal-expert release claim | Target jurisdiction determines adapters and evaluation |
| DR.AI audience | Report explanation only | Clinical/patient-facing use requires a separately reviewed scope |
| DOC-AI redistribution and fidelity | Adapter spike and license/ownership confirmation | Missing rights or broken formatting require a different integration approach |
| Production isolation requirements | Do not claim complete native isolation | Untrusted tenants require validated remote execution design |

Defaults are sufficient to begin Phase 0. The expensive choices to review before broad implementation are runtime target, local/team priority, Code editor depth and DOC-AI-first sequencing. No additional permission is needed to read this plan; application implementation has not been performed in this planning task.

## 20. Completion criteria and source map

The intended project is ready for a useful pilot when a user can install it, start Cowork or Code, choose an expert, use authorized files, interrupt/reload work, inspect actual results, and export a verified deliverable. A specialist can be added without modifying the loop. Shared deployment additionally requires verified ownership, credential separation and execution isolation. Automations and graph have their own gates and do not block a focused initial release.

Local evidence: `native/start.mjs`, `native/setup.mjs`, `webui/Dockerfile`, `workspace-image/Dockerfile`, `docker-compose.yml`, `caddy/Caddyfile`, `monolith-server/auth.mjs`, `monolith-server/index.mjs`, `monolith-server/router.mjs`, `monolith-server/workspace-files.mjs`, `monolith-server/orchestrator/*`, `scripts/backup.sh`, `evals/README.md`, `evals/BASELINE.md`, `engine/core/docs/architecture.md`, `engine/core/packages/monolith/*`, and the client/preset/storage/sandbox/jobs/schedule/MCP capability READMEs cited by path throughout.

External references: [DOC-AI review pipeline](https://github.com/MrRobot373/DOC-AI-/blob/main/backend/review_engine.py), [DOC-AI document fixer](https://github.com/MrRobot373/DOC-AI-/blob/main/backend/doc_fixer.py), [DOC-AI app](https://github.com/MrRobot373/DOC-AI-/blob/main/backend/app.py), [Claude Cowork](https://claude.com/product/cowork), [Claude Code](https://code.claude.com/docs/en/overview), and the official Supabase sources in Section 12. Claude products are behavioral references; the MONOLITH features and delivery targets are proposed here.
