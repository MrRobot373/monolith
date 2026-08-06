// Ownership scoping for scheduled tasks: before this, the store was a flat
// { schedules: [] } with no owner field, so on any shared deployment every
// user could list, edit, run and delete everyone else's automation.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import { createMonolithScheduler } from "./index.mjs";

function makeScheduler() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "monolith-sched-"));
  return createMonolithScheduler({ dataDir, openworkUrl: "http://127.0.0.1:1", log: () => {} });
}

/** Drives scheduler.handle() with a fake req/res and resolves the JSON reply. */
function call(scheduler, { method, urlPath, user, body }) {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  req.method = method;
  req.url = urlPath;
  req.headers = {};
  if (user) req.monolithUser = user; // what auth.mjs attaches after verifying a token

  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 0,
      setHeader() {},
      writeHead(status) { this.statusCode = status; },
      end(payload) {
        try {
          resolve({ status: this.statusCode, body: payload ? JSON.parse(payload) : {} });
        } catch (error) { reject(error); }
      },
    };
    if (!scheduler.handle(req, res, urlPath)) reject(new Error(`unhandled: ${urlPath}`));
  });
}

const alice = { email: "alice@example.com" };
const bob = { email: "bob@example.com" };
const newSchedule = { prompt: "do a thing", workspaceId: "ws-1", cadence: { kind: "daily", hour: 9, minute: 0 } };

async function createFor(scheduler, user, overrides = {}) {
  const created = await call(scheduler, {
    method: "POST", urlPath: "/__monolith/schedules", user, body: { ...newSchedule, ...overrides },
  });
  assert.equal(created.status, 201);
  return created.body.schedule;
}

test("a created schedule records its owner", async () => {
  const scheduler = makeScheduler();
  const schedule = await createFor(scheduler, alice);
  assert.equal(schedule.createdBy, "alice@example.com");
});

test("listing only returns your own schedules", async () => {
  const scheduler = makeScheduler();
  await createFor(scheduler, alice, { name: "alice task" });
  await createFor(scheduler, bob, { name: "bob task" });

  const asAlice = await call(scheduler, { method: "GET", urlPath: "/__monolith/schedules", user: alice });
  assert.deepEqual(asAlice.body.schedules.map((s) => s.name), ["alice task"]);

  const asBob = await call(scheduler, { method: "GET", urlPath: "/__monolith/schedules", user: bob });
  assert.deepEqual(asBob.body.schedules.map((s) => s.name), ["bob task"]);
});

test("another user's schedule is 404 on read, edit, run and delete", async () => {
  const scheduler = makeScheduler();
  const aliceSchedule = await createFor(scheduler, alice);
  const url = `/__monolith/schedules/${aliceSchedule.id}`;

  for (const [method, urlPath, body] of [
    ["PATCH", url, { name: "hijacked" }],
    ["DELETE", url, undefined],
    ["POST", `${url}/run`, undefined],
  ]) {
    const result = await call(scheduler, { method, urlPath, user: bob, body });
    assert.equal(result.status, 404, `${method} ${urlPath} must not expose another user's schedule`);
  }

  // ...and it survived every attempt.
  const stillThere = await call(scheduler, { method: "GET", urlPath: "/__monolith/schedules", user: alice });
  assert.equal(stillThere.body.schedules.length, 1);
  assert.equal(stillThere.body.schedules[0].name, "Scheduled task");
});

test("a client cannot forge ownership by sending createdBy", async () => {
  const scheduler = makeScheduler();
  const schedule = await createFor(scheduler, bob, { createdBy: "alice@example.com" });
  assert.equal(schedule.createdBy, "bob@example.com", "createdBy must come from the verified user, not the payload");
});

test("editing preserves ownership (PATCH must not orphan a schedule)", async () => {
  const scheduler = makeScheduler();
  const schedule = await createFor(scheduler, alice);
  const patched = await call(scheduler, {
    method: "PATCH", urlPath: `/__monolith/schedules/${schedule.id}`, user: alice, body: { name: "renamed" },
  });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.schedule.name, "renamed");
  assert.equal(patched.body.schedule.createdBy, "alice@example.com");

  // If ownership were wiped, bob would suddenly gain access to it.
  const asBob = await call(scheduler, { method: "GET", urlPath: "/__monolith/schedules", user: bob });
  assert.equal(asBob.body.schedules.length, 0);
});

test("legacy ownerless schedules stay visible to everyone (no orphaned automation)", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "monolith-sched-legacy-"));
  fs.writeFileSync(
    path.join(dataDir, "schedules.json"),
    JSON.stringify({ schedules: [{ id: "legacy1", name: "pre-ownership task", ...newSchedule, runs: [] }] }),
  );
  const scheduler = createMonolithScheduler({ dataDir, openworkUrl: "http://127.0.0.1:1", log: () => {} });

  for (const user of [alice, bob]) {
    const listed = await call(scheduler, { method: "GET", urlPath: "/__monolith/schedules", user });
    assert.equal(listed.body.schedules.length, 1, "a legacy schedule must not vanish for any user");
  }
});

test("with auth off (native single-user) every caller is the same owner", async () => {
  const scheduler = makeScheduler();
  // No monolithUser -> actorOf() falls back to "local".
  const created = await call(scheduler, { method: "POST", urlPath: "/__monolith/schedules", body: newSchedule });
  assert.equal(created.body.schedule.createdBy, "local");
  const listed = await call(scheduler, { method: "GET", urlPath: "/__monolith/schedules" });
  assert.equal(listed.body.schedules.length, 1, "the single local user must still see their own schedules");
});
