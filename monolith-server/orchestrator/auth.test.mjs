import test from "node:test";
import assert from "node:assert/strict";

import { createOrchestratorAuth } from "./auth.mjs";

const req = (headers = {}, method = "GET") => ({ headers, method });

test("with no token configured, everything is allowed (native single-user parity)", () => {
  const auth = createOrchestratorAuth({ host: "127.0.0.1" });
  assert.equal(auth.enforced, false);
  assert.equal(auth.check(req(), "/workspaces").ok, true);
  assert.equal(auth.check(req(), "/workspace/x/opencode/session").ok, true);
});

test("loopback + no token boots; non-loopback + no token refuses to boot", () => {
  assert.equal(createOrchestratorAuth({ host: "127.0.0.1" }).exposureError(), null);
  const exposed = createOrchestratorAuth({ host: "0.0.0.0" }).exposureError();
  assert.ok(exposed, "0.0.0.0 with no token must refuse to start");
  assert.match(exposed, /refusing to start/);
  // The guard must not fire once a real token is configured.
  assert.equal(createOrchestratorAuth({ host: "0.0.0.0", clientToken: "real-token" }).exposureError(), null);
});

test(".env.example placeholders do not count as configured", () => {
  const auth = createOrchestratorAuth({
    host: "0.0.0.0",
    clientToken: "change-me-client-token",
    hostToken: "change-me-host-token",
  });
  assert.equal(auth.enforced, false, "placeholder secrets are public knowledge, not auth");
  assert.ok(auth.exposureError(), "placeholders must still trip the exposure guard");
});

test("when enforced, the agent surface requires a token", () => {
  const auth = createOrchestratorAuth({ host: "0.0.0.0", clientToken: "client-secret" });
  assert.equal(auth.enforced, true);

  const anonymous = auth.check(req(), "/workspaces");
  assert.equal(anonymous.ok, false);
  assert.equal(anonymous.status, 401);

  // This is the exact path Caddy routes around basic_auth.
  const proxy = auth.check(req(), "/workspace/ws-1/opencode/session");
  assert.equal(proxy.ok, false, "the opencode proxy must not be anonymously reachable");

  const wrong = auth.check(req({ authorization: "Bearer nope" }), "/workspaces");
  assert.equal(wrong.ok, false);
  assert.equal(wrong.status, 403, "a supplied-but-wrong token is 403, not 401");

  assert.equal(auth.check(req({ authorization: "Bearer client-secret" }), "/workspaces").ok, true);
});

test("/health stays public so start.mjs polling and Docker healthchecks keep working", () => {
  const auth = createOrchestratorAuth({ host: "0.0.0.0", clientToken: "client-secret" });
  assert.equal(auth.check(req(), "/health").ok, true);
  // ...but only /health, not anything merely starting with it.
  assert.equal(auth.check(req(), "/healthz-internal").ok, false);
});

test("CORS preflight passes without credentials", () => {
  const auth = createOrchestratorAuth({ host: "0.0.0.0", clientToken: "client-secret" });
  assert.equal(auth.check(req({}, "OPTIONS"), "/workspaces").ok, true);
});

test("host token works via its own header or as a bearer, and outranks the client token", () => {
  const auth = createOrchestratorAuth({
    host: "0.0.0.0",
    clientToken: "client-secret",
    hostToken: "host-secret",
  });
  // native/start.mjs replayPersistedLocalWorkspaces sends this header.
  assert.equal(auth.check(req({ "x-openwork-host-token": "host-secret" }), "/workspaces/local").ok, true);
  assert.equal(auth.check(req({ authorization: "Bearer host-secret" }), "/workspaces/local").ok, true);
  assert.equal(auth.check(req({ "x-openwork-host-token": "wrong" }), "/workspaces/local").ok, false);
});

test("a host-token-only deployment still rejects anonymous callers", () => {
  const auth = createOrchestratorAuth({ host: "0.0.0.0", hostToken: "host-secret" });
  assert.equal(auth.enforced, true);
  assert.equal(auth.check(req(), "/workspaces").ok, false);
  assert.equal(auth.check(req({ "x-openwork-host-token": "host-secret" }), "/workspaces").ok, true);
});

test("empty/malformed credentials never authenticate", () => {
  const auth = createOrchestratorAuth({ host: "0.0.0.0", clientToken: "client-secret" });
  for (const headers of [
    { authorization: "" },
    { authorization: "Bearer" },
    { authorization: "Bearer " },
    { authorization: "Basic client-secret" },
    { "x-openwork-host-token": "" },
  ]) {
    assert.equal(auth.check(req(headers), "/workspaces").ok, false, JSON.stringify(headers));
  }
});
