# MONOLITH Code Workspace Plan

## Product outcome

The MONOLITH Code section becomes a browser-based IDE with the working model of VS Code:

- Users see the real workspace file tree.
- Users can create, open, edit, rename, move, delete, search, and download files.
- Users can edit code directly in a full editor, not only through chat.
- The agent can inspect and propose changes, but user edits and agent edits remain distinguishable.
- Every filesystem operation is scoped to the selected workspace, authorized, reversible where practical, and recorded in the task ledger.

This is an IDE for workspace files. It is not a browser that exposes arbitrary computer files.

## Scope and non-goals

In scope:

- Text/code editing for common source and configuration formats.
- File tree management inside a selected workspace.
- Search, diffs, problems, terminal output, Git status, and agent-assisted edits.
- Local/native workspaces first; remote/container workspaces through the same API later.

Not in the first release:

- Full VS Code extension compatibility.
- Arbitrary local computer access outside the selected workspace.
- Collaborative cursor editing. Add this only after single-user correctness is stable.
- A replacement for the OpenCode engine. MONOLITH remains the UI/policy layer.

## Existing integration points

| Existing area | Use in the IDE |
| --- | --- |
| `openwork/apps/app/src/` | Code mode layout, file tree, tabs, editor, diff panels, terminal/task UX |
| `native/serve-ui.mjs` | Native-only workspace picker and secure local filesystem bridge |
| `monolith-server/` | Workspace authorization, file-operation API, task ledger, Git/terminal policy |
| `native/start.mjs` | Native runtime/process lifecycle |
| OpenCode/OpenWork session APIs | Agent code tasks, tool execution, permission approval, tool timeline |
| Supabase | User/org/workspace metadata and authorization; not the local disk itself |

## UI plan

### Layout

Use a dense three-region IDE layout that works with the current MONOLITH Code tab.

```text
+--------------------------------------------------------------------------------+
| Workspace name | branch/status | model | task mode | Run | Search | settings |
+----------------------+-------------------------------+-------------------------+
| Explorer             | Editor tabs                   | Agent / Inspector       |
| Search               | Breadcrumbs                   | Chat / plan / tools     |
| Source control       | Monaco editor                 | Files changed           |
|                       |                               | Diff / approvals        |
+----------------------+-------------------------------+-------------------------+
| Problems | Output | Terminal | Tests | Git | Background task status             |
+--------------------------------------------------------------------------------+
```

Desktop behavior:

- Explorer defaults to 260px wide, resizable, collapsible.
- Editor fills remaining width; tabs wrap only in compact view.
- Agent/Inspector rail is resizable and can be hidden.
- Bottom panel is collapsed by default and opens for tests/errors/terminal.

Mobile/tablet behavior:

- File tree, editor, and chat become switchable views; do not attempt a three-column layout.
- Use a persistent workspace/file breadcrumb and a visible unsaved-change indicator.

### Explorer

Required interactions:

- Expand/collapse directories with lazy loading.
- Open files in preview or pinned tabs.
- New file, new folder, rename, move, duplicate, delete, refresh, reveal containing folder.
- Context menu and keyboard shortcuts.
- Filename filter and full-text workspace search as separate modes.
- Git decorations: modified, added, deleted, untracked, conflict, ignored.
- Read-only/sensitive-file badges.
- Binary/large-file state rather than attempting to render unsupported content.

Delete UX:

- Move to workspace trash when supported; do not permanently delete by default.
- Show exact target path and affected file count.
- Require an explicit confirmation for directories or tracked files.
- Do not expose broad recursive deletion as a generic agent action.

### Editor

Use Monaco Editor. It provides VS Code-grade editing primitives without pretending to embed the entire VS Code application.

Required editor features:

- Syntax highlighting, minimap toggle, line numbers, bracket matching, folding, multi-cursor, find/replace.
- Language selection and automatic detection by file extension.
- Tabs, split editor, breadcrumbs, go-to-line, go-to-symbol where a language service is available.
- Dirty marker and explicit Save; optional autosave only after the user enables it.
- Read-only state for protected files, policies, generated files, or access-limited workspaces.
- File-size guard with a lightweight viewer for very large files.
- External-change detection with Reload / Compare / Keep-my-version choices.

Agent edits:

- Agent never silently overwrites an open dirty editor.
- Agent changes appear as a diff preview with file list, explanation, and Apply/Reject controls.
- Allow "apply all" only for a reviewed batch within one task.
- After apply, show a task-linked changed-file badge and allow rollback to pre-task content.

### Bottom panel

- **Problems:** parser/linter/test diagnostics grouped by file and severity.
- **Output:** build/test/model/tool output, redacted and searchable.
- **Terminal:** controlled terminal sessions scoped to workspace and task permissions.
- **Tests:** named test runs, pass/fail count, duration, rerun failed.
- **Git:** branch, staged/unstaged diff, commit action only after explicit user intent.

### Agent/Inspector rail

- Show the active plan, assumptions, tool timeline, approvals, and generated artifacts.
- Clicking an agent file change opens the diff in the editor.
- Tool calls show command/path, exit status, and concise output preview.
- Read-only and permission blocks are visible as first-class events.

## Frontend implementation

Suggested module structure under `openwork/apps/app/src/`:

```text
features/code/
  components/
    code-workbench.tsx
    explorer-tree.tsx
    editor-tabs.tsx
    monaco-editor-pane.tsx
    diff-review-pane.tsx
    bottom-panel.tsx
    terminal-panel.tsx
    git-panel.tsx
    agent-inspector.tsx
  hooks/
    use-workspace-tree.ts
    use-file-buffer.ts
    use-file-search.ts
    use-workspace-events.ts
  stores/
    code-workbench-store.ts
  lib/
    file-api.ts
    editor-models.ts
    path-utils.ts
```

State model:

- `workspaceId`, root display name, capability policy, connection state.
- Tree nodes keyed by normalized workspace-relative path.
- Open tabs keyed by path, with buffer content, revision, dirty flag, language, and view state.
- Separate persisted UI state from file content: panel sizes, open folders, tabs, selected file, cursor positions.
- Server revision/ETag on every loaded text file to prevent accidental overwrites.

Use optimistic UI only for safe metadata interactions. For file writes, the source of truth is the server response with updated revision/hash.

## Backend and filesystem design

### Workspace File Service

Create a small service boundary in `monolith-server` for hosted mode and an equivalent native adapter in `native/serve-ui.mjs`:

```text
WorkspaceFileService
  listTree(workspaceId, path, depth)
  readText(workspaceId, path, revision?)
  writeText(workspaceId, path, content, expectedRevision)
  createFile(workspaceId, path, content?)
  createDirectory(workspaceId, path)
  rename(workspaceId, from, to)
  moveToTrash(workspaceId, path)
  restoreFromTrash(workspaceId, trashId)
  search(workspaceId, query, options)
  getDiff(workspaceId, path, baseRevision)
  watch(workspaceId)
```

Every method must:

1. Authenticate the user.
2. Resolve organization/workspace membership.
3. Check task/workspace capability policy.
4. Normalize the path and verify it remains inside workspace root after resolving symlinks/junctions.
5. Enforce allow/deny patterns for sensitive runtime files.
6. Append an event to the task ledger for write/delete/rename actions.
7. Return the new revision/hash so the client can detect conflicts.

### API contract

Suggested endpoints under `/__monolith/workspaces/:workspaceId`:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/tree?path=&depth=` | Lazy file tree |
| `GET` | `/file?path=` | Text file plus revision/hash |
| `PUT` | `/file?path=` | Write file with `If-Match` revision |
| `POST` | `/files` | Create file/folder |
| `POST` | `/move` | Rename/move |
| `POST` | `/trash` | Move one target to trash |
| `POST` | `/restore` | Restore trashed item |
| `GET` | `/search?q=` | Filename/content search |
| `GET` | `/events` | Server-sent workspace/file events |
| `POST` | `/terminal/sessions` | Create permission-scoped terminal |
| `POST` | `/git/status` | Obtain normalized Git status |

Use JSON for metadata. Send large file content only through a dedicated text endpoint with file-size limits and content type.

### Conflict handling

1. Client opens file with `revision=A`.
2. Another process changes file to `revision=B`.
3. Client save uses `If-Match: A`.
4. Server returns `409 conflict` with current revision/hash, never overwriting automatically.
5. UI offers compare, merge, reload, or save-as-copy.

### File watching

- Native mode: watch workspace root with debouncing and overflow recovery scan.
- Hosted mode: watch inside the sandbox/container, publish normalized events to the sidecar.
- Never trust raw watcher paths without reapplying workspace-root checks.
- Suppress self-generated events by correlating write operation IDs, but still update revision state.

### Terminal policy

- Terminal is a task capability, not a raw browser shell.
- Sessions run with workspace cwd only and inherit a minimal allowlisted environment.
- Read-only tasks cannot open mutable terminal sessions.
- Commands are streamed to the bottom panel and recorded in the execution ledger.
- Block redirects/writes in read-only mode and surface clear policy errors.
- Require explicit approval for network, package installation, Git commits, process control, and operations outside workspace.

## Git workflow

First release:

- Read status, diff, branches, and history.
- Stage/unstage individual files after explicit click.
- Commit through a review dialog with user-written message.
- No automatic push, force operations, resets, rebases, or hard checkouts.

Later:

- Pull request integration, worktrees, conflict resolution, blame, and change review.

All Git operations need exact repository root verification. A workspace may not be a Git repository; show that state clearly rather than failing.

## Permissions and sensitive files

Default protected patterns:

- `.env`, `.env.*`, `*.pem`, `*.key`, `id_rsa`, credential/config files with secret fields.
- Runtime configuration that includes provider credentials.
- Files outside workspace root.

Policy outcomes:

- User may read redacted metadata for sensitive files.
- Direct content viewing requires an explicit elevated permission and is logged.
- Agent gets redacted content by default and cannot exfiltrate it through messages/artifacts.
- Delete/move of sensitive or hidden files requires an elevated approval.

## End-to-end workflows

### User edits code

1. User selects a workspace and opens Code mode.
2. UI loads tree and capability policy.
3. User opens `src/app.ts`; server returns text and revision.
4. User edits; tab becomes dirty.
5. User saves; UI sends content with expected revision.
6. File service validates authorization/path/revision, writes atomically, emits event, and records ledger entry.
7. UI clears dirty state and updates Git decoration.

### User creates or deletes a file

1. User chooses New File/Folder or Delete in Explorer.
2. UI validates relative path and shows target preview.
3. Server authorizes operation and writes/moves to trash atomically.
4. Explorer updates from response/event; task ledger records actor and path.
5. Delete can be restored from workspace trash if enabled.

### Agent proposes a code fix

1. User asks agent to fix an issue from Chat/Cowork/Code.
2. Agent reads files under task policy and prepares a patch set.
3. UI opens the Diff Review pane with file-by-file changes.
4. User applies/rejects specific files, or grants a scoped task-level write approval.
5. File service applies each patch using expected revisions.
6. Agent runs approved verification commands; output appears in Tests/Output panel.
7. Final summary is generated from ledger events and linked diffs.

## Delivery phases

### Code P0: Safe read/write foundation

- WorkspaceFileService, path normalization, capability checks, revisions, read-only enforcement.
- Explorer read, open file, direct editor save, atomic create/rename/trash.
- Basic ledger events.

Acceptance: user can safely manage text files only inside selected workspace; read-only tasks cannot write anywhere.

### Code P1: Usable IDE

- Monaco editor, tabs, dirty state, find/replace, search, file watch, conflict UX.
- Problems/Output/Test panels.
- Agent diff review and apply/reject flow.

Acceptance: user can complete normal edit-test-debug loop without leaving MONOLITH.

### Code P2: Developer workflow

- Controlled terminal, Git status/diff/stage/commit, language tooling adapters, command presets.
- Workspace trash/restore and large-file handling.

Acceptance: common Node/Python/web project workflows are practical and traceable.

### Code P3: Advanced capabilities

- Split editors, symbols/references, code actions, worktrees, collaborative editing, remote containers.

Acceptance: advanced features do not weaken workspace isolation or task auditability.

## Test plan

- Path traversal: `..`, symlink/junction, UNC paths, case changes, encoded separators.
- Conflict test: two clients save same file; no silent overwrite.
- Read-only test: direct editor, agent patch, shell redirect, temp-file write, and delete are all blocked.
- Delete test: file restore works; directory deletion requires exact confirmation.
- Sensitive-file test: no secret value reaches browser logs, model context, or artifacts.
- File-watch test: external change updates UI without losing dirty user buffer.
- Performance test: 10k-file tree uses lazy loading and search remains responsive.
- Accessibility test: keyboard navigation, focus order, screen reader labels, contrast.

## Definition of done

The Code section is ready when a user can safely edit and manage a real workspace with a VS Code-like workflow, while every agent/user write is scoped, reviewable, reversible where possible, and evidenced by the MONOLITH execution ledger.
