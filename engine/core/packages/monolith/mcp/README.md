# packages/monolith/mcp — the MONOLITH MCP library

External tool servers MONOLITH can connect, classified against **this engine's**
real contract rather than a vendor list, plus a generator that turns a chosen
set into the patch rows the engine actually mounts.

| | |
|---|---|
| [`catalog.mjs`](catalog.mjs) | 59 servers, each with transport, required environment variables, and a `status` |
| [`generate.mjs`](generate.mjs) | Emits a `cordis` patch layer for the servers you name |

## What this engine can reach

The MCP client (`@monolith/mcp-client`) is narrower than the clients most of
these servers advertise support for. Three limits decide the whole catalog:

- **Transports: `stdio` and `streamable-http` only.** The legacy **SSE**
  transport is not implemented.
- **Auth: static headers only.** There is no interactive **OAuth** flow, so a
  remote server that signs in through a browser cannot be reached at all — no
  token can be supplied in its place.
- **Tools only.** MCP *resources* and *prompts* are not bridged.

Against those limits:

| Status | Count | Meaning |
|---|---|---|
| `ready` | 26 | Connects with no credential |
| `needs-secret` | 26 | Connects once its environment variables are set |
| `built-in` | 1 | Already mounted by the product overlay (`monolithweb`) |
| `unsupported` | 6 | **This engine cannot reach it** — reason in `blocked` |

### The six that cannot connect

Kept in the catalog on purpose: a server that is absent looks like an oversight,
and someone re-adds it and debugs a silent failure. Each carries the reason.

| Server | Blocked by |
|---|---|
| Linear, Sentry, Vercel | `oauth` — browser sign-in, no token header accepted |
| Asana, Cloudflare Docs, PayPal | `sse` — legacy transport, endpoint is `…/sse` |

Both groups become reachable if upstream ships a streamable-http endpoint that
takes a bearer token, or if the engine grows an OAuth flow. Neither is a
MONOLITH change.

## Verification

Every package name was resolved against npm and PyPI on **2026-09-05**;
`registry: 'verified'` records that. Two entries in the source list were wrong:

- `sequential-thinking` — the published name is
  `@modelcontextprotocol/server-sequential-thinking` (hyphenated). **Corrected.**
- `whatsapp` — `@green-api/whatsapp-mcp-server` is unpublished, and every
  surviving alternative drives WhatsApp through unofficial Web
  reverse-engineering, which risks the account. **Dropped** rather than
  substituted.

`stdio` entries run through `npx` (38) or `uvx` (12), so a host needs Node and,
for the Python ones, [uv](https://docs.astral.sh/uv/).

## Use it

```bash
node packages/monolith/mcp/generate.mjs --list          # what exists, and what each needs
node packages/monolith/mcp/generate.mjs --ready         # everything that needs no secret
node packages/monolith/mcp/generate.mjs github notion   # just these
```

Then mount the layer:

```bash
monolith --profile monolith --patch ./monolith-mcp.patch.yml
```

The generator refuses `unsupported` entries by name and reports required
variables that are unset **before** you boot — the engine defaults
`failOnStartupError: false`, so an unreachable server otherwise goes missing
with no error and the model simply never sees those tools.

Secrets are read from the environment through `!!js process.env.*`, never
written into the generated file, so the output is safe to commit.

## How a row reaches the model

One row mounts one server. Its tools are namespaced `mcp__<serverName>__<tool>`,
so they cannot collide with the native toolset or with each other:

```yaml
- insert:
    - id: mcp-memory
      name: '@monolith/mcp-client'
      config:
        serverName: memory
        transport: stdio
        command: 'npx'
        args: ['-y', '@modelcontextprotocol/server-memory']
        cwd: !!js process.env.MONOLITH_CWD ?? process.cwd()
        toolCallTimeoutMs: 60000
        failOnStartupError: false
```

`failOnStartupError` is left `false` deliberately: one unreachable third-party
server should not stop the workspace from booting. The trade is that failures
are quiet, which is why the generator front-loads the environment check.

## The cost nobody mentions

Every mounted server's tool definitions are added to **every model request** for
the life of the session. A dozen servers is a large permanent context tax, and
on a small local model it measurably degrades tool selection. Mount what a
deployment actually uses, not the whole catalog — `--all` exists for testing,
not for production.
