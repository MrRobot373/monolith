# MONOLITH Chat and RAG Plan

## Product outcome

The MONOLITH Chat section becomes a dependable ChatGPT/Claude-style conversational workspace:

- Fast streaming chat with persistent conversations.
- Clear model/provider selection and reliable fallbacks.
- Context built from recent messages, durable summaries, workspace files, and retrieved knowledge.
- RAG answers with source citations and access-controlled retrieval.
- Optional tools with visible approval, status, and evidence.
- Long conversations remain coherent through token budgets and a sliding-window mechanism, not uncontrolled prompt growth.

The system must not claim that it "remembered" information unless that information was included in the current context or retrieved from an authorized memory source.

## Scope and non-goals

In scope:

- One-to-one assistant chat, conversation history, uploads, workspace-aware chat, and RAG retrieval.
- Streaming text, tool status, citations, regeneration, branch/edit message, and export.
- Supabase-backed conversations and knowledge metadata with RLS.
- Local/native RAG option and hosted Supabase/pgvector option.

Not in first release:

- Hidden chain-of-thought display or storage.
- Cross-organization knowledge search.
- Autonomous tool actions without policy/approval.
- Training a custom foundation model.

## Existing integration points

| Existing area | Use in Chat |
| --- | --- |
| `openwork/apps/app/src/` | Chat UI, composer, session list, tool displays, model picker, artifacts |
| OpenCode/OpenWork sessions | Existing agent conversation/tool stream where appropriate |
| `monolith-server/` | Chat orchestration, retrieval API, context builder, auth, ledger, streaming proxy |
| `monolith-server/auth.mjs` | Supabase bearer-token verification for product APIs |
| `native/` | Local engine/provider bridge and optional local document indexer |
| Supabase Auth/Postgres/Storage | Identity, conversations, knowledge metadata, chunks, embeddings, artifacts |

## UI plan

### Chat layout

```text
+----------------------+--------------------------------------------------------------+
| Conversations        | Workspace / mode / model / context indicator / share        |
| New chat             +--------------------------------------------------------------+
| Search chats         | User and assistant message stream                            |
| Folders/projects     | - citations expandable                                       |
| Pinned chats         | - tool activity compact                                      |
|                      | - generated artifacts                                        |
|                      +--------------------------------------------------------------+
|                      | Attach | Context sources | Composer | Send/Stop             |
+----------------------+--------------------------------------------------------------+
```

Primary UI elements:

- Conversation sidebar with search, pinned chats, workspace/project grouping, delete/archive, and last activity.
- Header showing workspace scope, agent mode, selected model/provider, tool permission mode, and context health.
- Streaming message view with Markdown, code blocks, tables, attachments, citations, artifacts, and compact tool events.
- Composer with file attachment, mention/search sources, model selector, tool mode, send/stop, and draft persistence.
- Context drawer showing what will be sent: recent messages, summary, selected files, retrieved sources, attached files, and estimated token budget.
- Citation drawer with source filename/URL, chunk excerpt, score/relevance reason, and open location.

### Interaction behavior

- User messages may be edited and regenerated as a new branch; never mutate historical messages silently.
- The assistant streams tokens and shows a stop control immediately.
- Tool activity remains compact until opened. User sees tool name, target, status, and whether a write/approval is involved.
- When context is truncated, show a non-alarming indicator: "Earlier conversation summarized" and allow opening source messages.
- When RAG has weak evidence, say so and prefer a clarifying question over fabricated certainty.
- A user can pin a message, file, or source as persistent conversation context.

### Context controls

Use familiar controls, not explanatory blocks:

- Toggle: Include workspace files.
- Toggle: Search organization knowledge.
- Chips: selected documents/files.
- Dropdown: context profile (`Balanced`, `Conversation`, `Workspace`, `Research`).
- Details panel: retrieved sources, summary freshness, token allocation, and sources excluded for budget.

## Backend architecture

### Chat Orchestrator

Add a product-owned orchestration layer in `monolith-server` rather than sending browser prompts directly to model providers.

Responsibilities:

1. Authenticate and authorize user/workspace/org scope.
2. Persist user message before generation begins.
3. Assemble context according to token policy.
4. Run retrieval and optional reranking.
5. Call the selected provider/engine and stream events to client.
6. Enforce tool and workspace policies.
7. Persist assistant response, citations, tool events, artifacts, and usage metrics.
8. Generate/revise conversation summaries asynchronously after completion.

Suggested API surface:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/__monolith/chats` | Create conversation |
| `GET` | `/__monolith/chats` | List accessible conversations |
| `GET` | `/__monolith/chats/:id` | Conversation metadata/messages page |
| `POST` | `/__monolith/chats/:id/messages` | Submit message and open stream |
| `POST` | `/__monolith/chats/:id/regenerate` | Branch/regenerate assistant response |
| `POST` | `/__monolith/chats/:id/context` | Preview token/context selection |
| `POST` | `/__monolith/knowledge/ingest` | Upload/index document request |
| `GET` | `/__monolith/knowledge/search` | Authorized source search |
| `POST` | `/__monolith/chats/:id/stop` | Cancel active generation |

Use Server-Sent Events or a fetch streaming response for token, citation, tool, status, error, and usage events. The client should render structured events rather than parsing model text for tool state.

### Data model

Tenant-scoped tables in Supabase Postgres:

| Table | Key fields | Purpose |
| --- | --- | --- |
| `conversations` | id, organization_id, workspace_id, created_by, title, status | Chat metadata |
| `conversation_members` | conversation_id, user_id, role | Sharing/access |
| `messages` | id, conversation_id, parent_message_id, role, content, status, model_id | Immutable message history and branches |
| `message_citations` | message_id, knowledge_chunk_id, rank, excerpt | Answer provenance |
| `conversation_summaries` | conversation_id, covers_through_message_id, content, version | Rolling durable summary |
| `chat_runs` | message_id, provider, model, context_tokens, output_tokens, latency, status | Generation telemetry |
| `knowledge_sources` | org/workspace owner, filename/url, hash, mime, status, visibility | Ingested source metadata |
| `knowledge_documents` | source_id, extracted text/version/language | Parsed document version |
| `knowledge_chunks` | document_id, ordinal, text, token_count, embedding, metadata | Retrieval corpus |
| `retrieval_runs` | chat_run_id, query, profile, selected chunk IDs, scores | Retrieval observability |
| `chat_attachments` | message/source links, storage reference | Uploaded/user-selected files |

Indexes:

- Conversation list: `(organization_id, updated_at desc)`.
- Messages: `(conversation_id, created_at)` and `(parent_message_id)`.
- Knowledge filter: `(organization_id, workspace_id, status)`.
- Vector index for `knowledge_chunks.embedding`, chosen after measuring corpus size and query pattern.
- Text index for lexical search over chunk text/title/metadata.

### RLS and authorization

1. Enable RLS for all exposed tables.
2. Membership-based policy: access requires organization membership and, where applicable, workspace or conversation membership.
3. Retrieval queries must filter organization/workspace scope before similarity ranking.
4. Do not authorize from editable user metadata.
5. Use server-side service credentials only in `monolith-server`; browser uses a publishable/anon key and user access token.
6. Storage policies must match source visibility and ownership. Upload/replacement requires the required Storage permissions.
7. If sharing is introduced, membership table policies decide whether a user may read, comment, or administer a conversation.

## RAG ingestion pipeline

### Source lifecycle

```text
Upload/attach -> virus/type checks -> store original -> extract text -> normalize
-> chunk -> embed -> index -> ready -> retrieve/cite -> reindex or expire on new version
```

1. Accept only supported MIME types and configured size limits.
2. Compute content hash before extraction. Deduplicate identical content within the same authorized scope.
3. Store original attachment in Storage or controlled local artifact storage.
4. Extract text with format-specific parsers; preserve page/section metadata.
5. Normalize text without destroying source locations.
6. Chunk by semantic headings first, then token size. Initial target: 400-800 tokens with 10-15% overlap, adjusted after retrieval evaluation.
7. Store chunk ordinal, page/section, source offsets, hash, token count, and document version.
8. Create embeddings using a configured embedding provider. Keep embedding model/version with every chunk.
9. Mark source `ready` only when all chunks and embeddings are committed successfully.
10. On replacement, create a new document version; do not silently overwrite chunks cited by old conversations.

### Retrieval pipeline

1. Build query from latest user message plus compact conversation summary and explicit source filters.
2. Apply authorization filter first: organization, workspace, source visibility, and user permissions.
3. Run hybrid retrieval:
   - vector similarity for semantic relevance
   - lexical/full-text search for exact terms, file names, identifiers, and error codes
4. Merge and deduplicate candidates.
5. Optionally rerank the top candidates with a lightweight reranker or model-based scoring.
6. Select diverse chunks: prevent five adjacent chunks from one document unless the user explicitly requests deep reading.
7. Pass source excerpt, source ID, location, and citation marker to the model.
8. Persist the exact selected chunks/scores in `retrieval_runs` and link accepted citations to the assistant message.

### Retrieval quality rules

- Never retrieve across organization/workspace boundaries.
- Do not use a source if its embedding version is incompatible with the active index without reindexing.
- Keep citations only for chunks actually provided to the model or directly verified by a tool.
- If no source passes score/quality thresholds, say that no relevant indexed source was found.
- For code questions, favor exact file/line or symbol retrieval over generic semantic chunks.

## Sliding-window context mechanism

### Why it is needed

Long conversations eventually exceed a model context window. Sending all past messages is expensive, slow, and causes important recent instructions to be diluted. Removing old messages completely loses decisions and creates inconsistent behavior.

Use a budgeted context builder that combines recent turns with durable summaries and retrieved evidence.

### Context package order

The orchestrator builds each model request in this order:

1. System policy: safety, tool permission mode, current date, product behavior.
2. Organization/workspace instructions: `AGENTS.md`, user-approved workspace rules, task decisions.
3. Conversation facts: latest valid summary plus pinned facts/decisions.
4. Recent sliding window: most recent complete user/assistant/tool turns.
5. Current user message and explicit attachments/mentions.
6. Retrieved RAG chunks and selected workspace file excerpts.
7. Tool result excerpts, if a tool was used during this turn.
8. Response budget reserved for model output and tool calls.

### Token budgets

Do not use fixed message counts. Use model-specific token budgets.

Example for a model with a 32k input window:

| Context component | Budget target |
| --- | ---: |
| System/policy + workspace rules | 2k |
| Persistent conversation summary/pins | 3k |
| Recent turns | 8k |
| RAG and file retrieval | 8k |
| Tool results | 3k |
| Safety buffer | 2k |
| Reserved response/tool output | 6k |

The registry must set actual budgets per model. Smaller local models receive smaller retrieval and history windows; larger hosted models can receive richer context.

### Rolling summary algorithm

1. Keep the latest turns verbatim until the recent-turn budget is near limit.
2. Identify the oldest contiguous message range not yet covered by a summary.
3. Generate/update a structured summary containing:
   - user goals and constraints
   - confirmed decisions and values
   - completed work and verified results
   - unresolved questions and risks
   - references to important message IDs, files, artifacts, and sources
4. Store summary with `covers_through_message_id` and summary version.
5. In later requests, include only the newest valid summary plus the sliding window after it.
6. Never overwrite original messages; summaries are derived artifacts and can be regenerated.
7. If the user corrects a prior fact, mark the old summary fact superseded and include the latest correction.

### Context selection algorithm

```text
buildContext(conversation, userMessage, modelProfile):
  budget = modelProfile.inputBudget - modelProfile.reservedOutput
  fixed = systemPolicy + workspacePolicy + confirmedDecisions
  summary = newestValidSummary(conversation)
  recent = newestCompleteTurnsThatFit(budget - fixed - summary)
  retrievalQuery = buildQuery(userMessage, summary, recent)
  sources = retrieveAuthorizedSources(retrievalQuery, remainingBudget)
  tools = selectRelevantToolResults(remainingBudget)
  return trimByPriority(fixed, summary, recent, userMessage, sources, tools)
```

Priority rules:

1. Never drop current user message, active system policy, explicit user attachments, or confirmed material decisions.
2. Prefer recent complete turns over isolated assistant fragments.
3. Prefer source diversity and exact code/file evidence over many weak chunks.
4. Trim low-relevance retrieval before trimming confirmed decisions.
5. If budget is insufficient, reduce optional context and show a context-limit event rather than silently changing policy.

## Chat and tool workflow

### Normal chat

1. User sends a message.
2. API authenticates, checks conversation membership, persists user message.
3. Context builder estimates tokens, selects summary/recent history, then runs authorized retrieval.
4. Orchestrator streams assistant output.
5. Client renders content and citations as they arrive.
6. On completion, persist assistant message, citation links, run metrics, and summary update request.
7. UI shows a concise context/source indicator.

### Workspace-aware question

1. User asks about code or attaches/selects workspace files.
2. Context builder prioritizes exact file/symbol chunks and current file contents.
3. Model responds with file citations or requests permission to inspect more.
4. If it needs tools, the task policy applies. Read-only stays read-only.
5. Any change proposal goes to Code diff review, not a hidden write.

### Knowledge upload and query

1. User uploads a document to an organization/workspace knowledge collection.
2. Ingestion pipeline validates, extracts, chunks, embeds, and indexes it.
3. UI shows `processing`, `ready`, or `failed` with an actionable error.
4. Later chat retrieval selects only chunks the user is authorized to access.
5. Answer citations open the exact document/page/section excerpt.

## Provider and model behavior

- Keep Ollama and OpenRouter in the model registry.
- Model profile declares context limit, response reserve, streaming, tool-call capability, and embedding support.
- Use an embedding model independently of chat model; do not assume every chat model produces embeddings.
- Never send secrets, unredacted `.env` content, or unauthorized document chunks to a provider.
- Persist provider/model ID and token/latency metrics per `chat_run`.
- If a selected model is unavailable, show a visible retry/fallback choice. Do not silently substitute a model.

## Delivery phases

### Chat P0: Reliable persistent chat

- Conversation/message schema, RLS, streaming API, sidebar, composer, model picker, stop/retry.
- Persist exact messages and chat run metadata.

Acceptance: authenticated user can create, resume, rename, archive, and safely delete own conversations; streaming works with Ollama and OpenRouter.

### Chat P1: Sliding-window context

- Token counter, model profiles, recent-turn selector, structured summaries, context preview UI.
- Decision/pin support and summary refresh jobs.

Acceptance: long conversation remains coherent without exceeding context limits; user sees that older turns were summarized.

### Chat P2: RAG foundation

- Source upload, extraction, chunking, embeddings, pgvector/text retrieval, citations, source drawer.
- Strict org/workspace filtering and source lifecycle states.

Acceptance: answers cite real, authorized source chunks; unrelated or unauthorized documents never appear.

### Chat P3: Quality and tools

- Hybrid retrieval/reranking, retrieval diagnostics, workspace-aware file retrieval, agent/tool integration, artifact linking.

Acceptance: retrieval quality improves on a measured query set; tool actions remain permissioned and traceable.

### Chat P4: Scale and collaboration

- Shared chats, roles, collections, scheduled reindexing, ingestion queue, quotas, analytics, exports, retention controls.

Acceptance: concurrent users and large knowledge bases remain isolated, observable, and responsive.

## Test plan

### Correctness

- Short conversation retains exact prior constraints.
- Long conversation uses summary + window and preserves confirmed decisions.
- User correction supersedes a stale summary statement.
- Regeneration creates a branch without destroying historical messages.

### RAG quality

- Build a gold set of at least 50 real questions with expected source documents/chunks.
- Measure recall@k, citation precision, answer groundedness, latency, and empty-result correctness.
- Test exact code identifiers, near-duplicate documents, stale document versions, and contradictory sources.

### Security

- User A cannot retrieve User B's organization/workspace source through vector, lexical, citation, or direct ID queries.
- Sensitive-file ingestion is blocked or redacted by policy.
- Service-role secret never appears in browser bundle or stream.
- Deleted/revoked sources no longer appear in retrieval results.

### Resilience

- Provider stream interruption preserves partial state and offers retry.
- Embedding failure leaves source in `failed` with retry; it does not produce partial searchable chunks.
- Queue retry is idempotent and does not duplicate embeddings/chunks.
- Large conversations remain within model budget and complete with usable latency.

## Definition of done

The Chat section is ready when users can have long, evidence-backed, permission-safe conversations with visible context and citations; model responses use a controlled sliding-window/RAG context package; and no user can retrieve another organization or workspace's conversations, files, or knowledge.
