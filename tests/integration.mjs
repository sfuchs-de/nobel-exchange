import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
let state = fs.mkdtempSync(path.join(os.tmpdir(), "nobel-test-"));
let server;
const start = async (config) => {
  server = spawn(
    process.execPath,
    [
      "node_modules/wrangler/bin/wrangler.js",
      "dev",
      ...(config ? ["--config", config] : []),
      "--ip",
      "127.0.0.1",
      "--port",
      "8797",
      "--inspector-port",
      "9297",
      "--persist-to",
      state,
      "--var",
      "DEV_AUTH:local-only",
    ],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    },
  );
  let log = "";
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null || server.signalCode !== null)
      throw Error("Local test server exited before becoming ready: " + log.slice(-1800));
    try {
      const r = await fetch("http://127.0.0.1:8797/api/config");
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw Error("Local test server did not start: " + log.slice(-1200));
};
const stop = async () => {
  if (!server || server.exitCode !== null || server.signalCode !== null) return;
  const exited = new Promise((r) => server.once("exit", r));
  server.kill("SIGTERM");
  await exited;
};
const request = async (
  p,
  method = "GET",
  body,
  token,
  origin = "http://127.0.0.1:4196",
) => {
  const r = await fetch("http://127.0.0.1:8797/api" + p, {
    method,
    headers: {
      Origin: origin,
      ...(token ? { Authorization: "Bearer dev-" + token } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, body: await r.json() };
};
const save = (
  person,
  allocation,
  version = 0,
  requestId = crypto.randomUUID(),
) =>
  request(
    "/portfolio",
    "PUT",
    { allocation, version, requestId, displayName: "Test " + person },
    person,
  );
const checks = [];
const check = (name, truth) => {
  assert.ok(truth, name);
  checks.push(name);
};
try {
  // Reproduce an already-open 99-person market without touching the preview.
  const fixture = path.resolve("worker/.migration-fixture.ts");
  const legacy = JSON.parse(fs.readFileSync("public/candidates.json", "utf8"));
  const additions = new Set(["stephen-redding", "esteban-rossi-hansberg", "costas-arkolakis"]);
  legacy.candidates = legacy.candidates.filter(c => !additions.has(c.id));
  legacy.version = "economics-2026.3";
  fs.writeFileSync(fixture, fs.readFileSync("worker/index.ts", "utf8").replace('import roster from "../public/candidates.json";', `const roster = ${JSON.stringify(legacy)};`));
  const config = path.join(state, "legacy.json");
  fs.writeFileSync(config, JSON.stringify({ ...JSON.parse(fs.readFileSync("wrangler.jsonc", "utf8")), main: fixture }));
  await start(config);
  await request("/admin/state", "POST", { phase: "open" }, "admin");
  const original = await save("alice", { "ariel-pakes": 100 });
  check("Legacy market accepts a saved portfolio", original.status === 200);
  const oldMarket = (await request("/market")).body;
  await stop();
  fs.unlinkSync(fixture);
  await start();
  const migrated = (await request("/market")).body;
  check("Open legacy market records exactly three approved additions", migrated.rosterUpdates?.length === 1 && migrated.rosterUpdates[0].additions.length === 3);
  check("Migration preserves the complete saved entry", JSON.stringify((await request("/me", "GET", undefined, "alice")).body.entry) === JSON.stringify(original.body.entry));
  check("Migration preserves pool, deadline and participant count", migrated.pool === oldMarket.pool && typeof migrated.closesAt === "string" && migrated.closesAt === oldMarket.closesAt && migrated.participants === oldMarket.participants);
  await stop();
  await start();
  check("Restart does not repeat roster migration", (await request("/market")).body.rosterUpdates.length === 1);
  await stop();
  fs.rmSync(state, { recursive: true, force: true });
  state = fs.mkdtempSync(path.join(os.tmpdir(), "nobel-test-"));
  await start();
  check(
    "Unauthenticated portfolio rejected",
    (await request("/portfolio", "PUT", {})).status === 401,
  );
  check(
    "Non-admin control rejected",
    (await request("/admin/state", "POST", { phase: "open" }, "alice"))
      .status === 403,
  );
  check(
    "Foreign origin rejected",
    (
      await request(
        "/admin/state",
        "POST",
        { phase: "open" },
        "admin",
        "https://untrusted.example",
      )
    ).status === 403,
  );
  check(
    "New market has no public portfolios",
    !(await request("/market")).body.entries,
  );
  check(
    "Open market",
    (await request("/admin/state", "POST", { phase: "open" }, "admin"))
      .status === 200,
  );
  check(
    "Invalid budget rejected",
    (await save("invalid", { "hal-varian": 101 })).status === 400,
  );
  check(
    "Unknown candidate rejected",
    (await save("invalid", { "not-a-candidate": 100 })).status === 400,
  );
  const id = crypto.randomUUID();
  let a = await save("alice", { "hal-varian": 60, "susan-athey": 40 }, 0, id);
  check(
    "First valid portfolio saved",
    a.status === 200 && a.body.entry.version === 1,
  );
  const retry = await save(
    "alice",
    { "hal-varian": 60, "susan-athey": 40 },
    0,
    id,
  );
  check(
    "Retry returns original entry",
    retry.status === 200 &&
      retry.body.entry.id === a.body.entry.id &&
      retry.body.entry.version === 1,
  );
  check(
    "Reused id cannot change allocation",
    (await save("alice", { "hal-varian": 100 }, 0, id)).status === 409,
  );
  check(
    "Parallel different users save successfully",
    (
      await Promise.all([
        save("bob", { "hal-varian": 50, "susan-athey": 50 }),
        save("charlie", { "hal-varian": 50, "susan-athey": 50 }),
      ])
    ).every((r) => r.status === 200),
  );
  let market = (await request("/market")).body;
  check(
    "100 credits per participant",
    market.pool === 300 &&
      market.participants === 3 &&
      Object.values(market.totals).reduce((a, b) => a + b, 0) === 300,
  );
  check(
    "Private names and individual allocations absent before closing",
    !market.entries && !JSON.stringify(market).includes("Test alice"),
  );
  check(
    "Deadline frozen after entries",
    (
      await request(
        "/admin/state",
        "POST",
        { phase: "open", closesAt: "2026-10-13T00:00:00Z" },
        "admin",
      )
    ).status === 409,
  );
  await new Promise((r) => setTimeout(r, 650));
  const clash = await Promise.all([
    save("alice", { "hal-varian": 80, "susan-athey": 20 }, 1),
    save("alice", { "hal-varian": 90, "susan-athey": 10 }, 1),
  ]);
  check(
    "Concurrent same-version edits: one success and one conflict",
    clash.filter((r) => r.status === 200).length === 1 &&
      clash.filter((r) => r.status === 409).length === 1,
  );
  const prior = (await request("/me", "GET", undefined, "alice")).body.entry;
  let nextVersion = prior.version;
  for (const candidateId of ["timothy-bresnahan", "samuel-kortum", "whitney-newey", "drew-fudenberg", "matthew-jackson", "andreu-mas-colell", "victor-chernozhukov", "luigi-zingales", "john-haltiwanger", "stephen-redding", "esteban-rossi-hansberg", "costas-arkolakis"]) {
    // Exercise normal saves without bypassing the server's 600ms anti-spam interval.
    await new Promise((r) => setTimeout(r, 650));
    const saved = await save("alice", { [candidateId]: 100 }, nextVersion);
    check("Reviewed addition is backable: " + candidateId,
      saved.status === 200 && saved.body.entry.allocation[candidateId] === 100);
    nextVersion = saved.body.entry.version;
  }
  await new Promise((r) => setTimeout(r, 650));
  const restored = await save("alice", prior.allocation, nextVersion);
  const afterAdditions = (await request("/market")).body;
  check("Addition tests preserve exactly 100 credits per participant",
    restored.status === 200 && afterAdditions.pool === 300 && afterAdditions.participants === 3 &&
    Object.values(afterAdditions.totals).reduce((a, b) => a + b, 0) === 300);
  const before = (await request("/me", "GET", undefined, "alice")).body.entry;
  await stop();
  await start();
  const after = (await request("/me", "GET", undefined, "alice")).body.entry;
  check(
    "Restart preserves id/version/allocation",
    JSON.stringify(before) === JSON.stringify(after),
  );
  check(
    "Pause accepted",
    (await request("/admin/state", "POST", { phase: "paused" }, "admin"))
      .status === 200,
  );
  check(
    "Paused market rejects save",
    (await save("alice", { "hal-varian": 100 }, 2)).status === 409,
  );
  await request("/admin/state", "POST", { phase: "open" }, "admin");
  await request("/admin/state", "POST", { phase: "closed" }, "admin");
  market = (await request("/market")).body;
  check(
    "Closing publishes final portfolios",
    market.phase === "closed" && market.entries.length === 3,
  );
  check(
    "Closed market rejects save",
    (await save("alice", { "hal-varian": 100 }, 2)).status === 409,
  );
  check(
    "Closed market cannot reopen",
    (await request("/admin/state", "POST", { phase: "open" }, "admin"))
      .status === 409,
  );
  check(
    "Cannot bypass closed state via pause",
    (await request("/admin/state", "POST", { phase: "paused" }, "admin"))
      .status === 409,
  );
  check(
    "Outside-roster laureate needs a name",
    (
      await request(
        "/admin/settlement-preview",
        "POST",
        { winners: [{ candidateId: "outside-roster", share: 1 }] },
        "admin",
      )
    ).status === 400,
  );
  const winners = [
    { candidateId: "hal-varian", share: 0.5 },
    { candidateId: "outside-roster", name: "Unbacked laureate", share: 0.5 },
  ];
  check("Null laureate returns a validation response", (await request("/admin/settlement-preview", "POST", { winners: [null] }, "admin")).status === 400);
  const preview = (
    await request("/admin/settlement-preview", "POST", { winners }, "admin")
  ).body;
  check(
    "Unequal backed/unbacked settlement preview",
    preview.unawarded === 150 &&
      Math.abs(preview.rows.reduce((s, r) => s + r.points, 0) - 150) < 1e-8,
  );
  check(
    "Settlement requires official source",
    (
      await request(
        "/admin/settle",
        "POST",
        {
          winners,
          source: "https://example.com",
          reason: "Testing official settlement",
          expectedRevision: preview.revision,
        },
        "admin",
      )
    ).status === 400,
  );
  let settlement = await request(
    "/admin/settle",
    "POST",
    {
      winners,
      source:
        "https://www.nobelprize.org/prizes/economic-sciences/2026/summary/",
      reason: "Synthetic settlement test only",
      expectedRevision: preview.revision,
    },
    "admin",
  );
  check(
    "Official-format settlement published",
    settlement.status === 200 && settlement.body.phase === "settled",
  );
  check(
    "Stale settlement correction rejected",
    (
      await request(
        "/admin/settle",
        "POST",
        {
          winners,
          source:
            "https://www.nobelprize.org/prizes/economic-sciences/2026/summary/",
          reason: "Synthetic stale correction",
          expectedRevision: preview.revision,
        },
        "admin",
      )
    ).status === 409,
  );
  const p2 = (
    await request(
      "/admin/settlement-preview",
      "POST",
      { winners: [{ candidateId: "hal-varian", share: 1 }] },
      "admin",
    )
  ).body;
  settlement = await request(
    "/admin/settle",
    "POST",
    {
      winners: [{ candidateId: "hal-varian", share: 1 }],
      source:
        "https://www.nobelprize.org/prizes/economic-sciences/2026/summary/",
      reason: "Synthetic corrected shares",
      expectedRevision: p2.revision,
    },
    "admin",
  );
  check(
    "Corrections increment settlement revision",
    settlement.body.settlement.revision === 2,
  );
  const exported = (await request("/admin/export", "GET", undefined, "admin"))
    .body;
  check(
    "Original and correction retained in audit",
    exported.audit.filter((e) => e.action === "settlement").length === 2,
  );
  check(
    "Export omits Google identity fields",
    !JSON.stringify(exported).includes("dev-alice"),
  );
  await stop();
  state = fs.mkdtempSync(path.join(os.tmpdir(), "nobel-deadline-test-"));
  await start();
  const close = new Date(Date.now() + 2000).toISOString();
  await request(
    "/admin/state",
    "POST",
    { phase: "open", closesAt: close },
    "admin",
  );
  check(
    "Portfolio accepted before timed deadline",
    (await save("alice", { "hal-varian": 100 })).status === 200,
  );
  await new Promise((r) => setTimeout(r, 2200));
  check(
    "Server clock closes market without admin action",
    (await request("/market")).body.phase === "closed",
  );
  check(
    "Late save rejected by server clock",
    (await save("bob", { "hal-varian": 100 })).status === 409,
  );
  const malformed = await fetch("http://127.0.0.1:8797/api/portfolio", {
    method: "PUT",
    headers: {
      Origin: "http://127.0.0.1:4196",
      Authorization: "Bearer dev-alice",
      "Content-Type": "application/json",
    },
    body: "null",
  });
  check("Malformed JSON shape rejected safely", malformed.status === 400);
  const oversized = await fetch("http://127.0.0.1:8797/api/portfolio", {
    method: "PUT",
    headers: {
      Origin: "http://127.0.0.1:4196",
      Authorization: "Bearer dev-alice",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ padding: "x".repeat(13000) }),
  });
  check(
    "Oversized request rejected before unbounded buffering",
    oversized.status === 413,
  );
  fs.mkdirSync("test-results", { recursive: true });
  fs.writeFileSync(
    "test-results/integration.json",
    JSON.stringify(
      { passed: checks.length, checks, at: new Date().toISOString() },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
} finally {
  await stop();
  fs.rmSync(path.resolve("worker/.migration-fixture.ts"), { force: true });
}
