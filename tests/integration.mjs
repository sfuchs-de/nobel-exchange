import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { randomBytes } from "node:crypto";
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
// A small read-only WebSocket probe: no credentials or third-party dependency.
// Read server frames (unmasked); the test never sends commands to the feed.
const feed = (prefix) => new Promise((resolve, reject) => {
  const messages = [];
  const req = http.request("http://127.0.0.1:8797/api" + prefix + "/live", {
    headers: { Origin: "http://127.0.0.1:4196", Upgrade: "websocket", Connection: "Upgrade",
      "Sec-WebSocket-Key": randomBytes(16).toString("base64"), "Sec-WebSocket-Version": "13" },
  });
  const timer = setTimeout(() => { req.destroy(); reject(Error("WebSocket probe timed out")); }, 4000);
  req.on("error", reject);
  req.on("response", r => { clearTimeout(timer); reject(Error("Expected WebSocket upgrade, got " + r.statusCode)); });
  req.on("upgrade", (_r, socket, head) => {
    let buffer = Buffer.alloc(0);
    const parse = chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 2) {
        let size = buffer[1] & 127, offset = 2;
        if (size === 126) { if (buffer.length < 4) return; size = buffer.readUInt16BE(2); offset = 4; }
        else if (size === 127) { if (buffer.length < 10) return; size = Number(buffer.readBigUInt64BE(2)); offset = 10; }
        if (buffer.length < offset + size) return;
        const opcode = buffer[0] & 15, data = buffer.subarray(offset, offset + size);
        buffer = buffer.subarray(offset + size);
        if (opcode === 1) messages.push(JSON.parse(data.toString()));
        if (messages.length === 1) { clearTimeout(timer); resolve({messages, close: () => socket.destroy()}); }
      }
    };
    socket.on("data", parse);
    if (head.length) parse(head);
  });
  req.end();
});
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
  // Second user base: deliberately reuse Alice's identity, version and receipt
  // identifiers. These must be independent, not aliases of the existing room.
  const originalExport = JSON.stringify(exported);
  const pubConfig = (await request("/public/config")).body;
  const originalConfig = (await request("/config")).body;
  check("Config identifies the selected original/public group", pubConfig.marketId === "public" && originalConfig.marketId === "original");
  let publicMarket = (await request("/public/market")).body;
  check("Public market starts empty and open with the same roster/deadline", publicMarket.marketId === "public" && publicMarket.phase === "open" && publicMarket.participants === 0 && publicMarket.pool === 0 && publicMarket.closesAt === market.closesAt && publicMarket.rosterVersion === market.rosterVersion);
  check("Public creation leaves the original export unchanged", JSON.stringify((await request("/admin/export", "GET", undefined, "admin")).body, (key, value) => key === "serverTime" ? undefined : value) === JSON.stringify(JSON.parse(originalExport), (key, value) => key === "serverTime" ? undefined : value));
  check("Public rejects unsigned saves", (await request("/public/portfolio", "PUT", {})).status === 401);
  check("Public rejects non-admin control", (await request("/public/admin/state", "POST", {phase:"closed"}, "alice")).status === 403);
  check("Public rejects untrusted origins", (await request("/public/portfolio", "PUT", {}, "alice", "https://untrusted.example")).status === 403);
  check("Same account initially has no public portfolio", (await request("/public/me", "GET", undefined, "alice")).body.entry === null);
  const originalFeed = await feed("");
  const publicFeed = await feed("/public");
  try {
    const originalMessages = originalFeed.messages.length;
    const publicSave = await request("/public/portfolio", "PUT", {
      allocation: {"ariel-pakes":100}, version:0, requestId:id, displayName:"Public Alice",
      marketId: "original", objectName:"economics-2026", // ignored: routing is server-owned
    }, "alice");
    check("Same Google identity can save an independent public portfolio", publicSave.status === 200 && publicSave.body.entry.version === 1 && publicSave.body.entry.id !== before.id);
    const publicRetry = await request("/public/portfolio", "PUT", {
      allocation:{"ariel-pakes":100},version:0,requestId:id,displayName:"Public Alice",
    }, "alice");
    check("Same request ID has an independent public save receipt", publicRetry.status === 200 && JSON.stringify(publicRetry.body) === JSON.stringify(publicSave.body));
    await new Promise(r => setTimeout(r, 200));
    check("Public live feed updates only its own group", publicFeed.messages.some(m => m.pool === 100) && publicFeed.messages.every(m => m.marketId === "public") && originalFeed.messages.length === originalMessages && originalFeed.messages.every(m => m.marketId === "original"));
    publicMarket = (await request("/public/market")).body;
    check("Public aggregates are independent and portfolios private", publicMarket.pool === 100 && publicMarket.participants === 1 && publicMarket.totals["ariel-pakes"] === 100 && !publicMarket.entries);
    check("Original saved portfolio and full audit remain unchanged", JSON.stringify((await request("/me", "GET", undefined, "alice")).body.entry) === JSON.stringify(after) && JSON.stringify((await request("/admin/export", "GET", undefined, "admin")).body, (key,value) => key === "serverTime" ? undefined : value) === JSON.stringify(JSON.parse(originalExport), (key,value) => key === "serverTime" ? undefined : value));
  } finally {
    originalFeed.close(); publicFeed.close();
  }
  const publicBeforeRestart = (await request("/public/me", "GET", undefined, "alice")).body.entry;
  await stop(); await start();
  check("Restart preserves both independent portfolios", JSON.stringify((await request("/public/me", "GET", undefined, "alice")).body.entry) === JSON.stringify(publicBeforeRestart) && JSON.stringify((await request("/me", "GET", undefined, "alice")).body.entry) === JSON.stringify(after));
  const publicExport = (await request("/public/admin/export", "GET", undefined, "admin")).body;
  check("Bootstrap is audited exactly once and export stays within public group", publicExport.entries.length === 1 && publicExport.entries[0].displayName === "Public Alice" && publicExport.audit.filter(e => e.action === "public-market-created").length === 1 && publicExport.snapshot.marketId === "public");
  await request("/public/admin/state", "POST", {phase:"paused"}, "admin");
  check("Public pauses without auto-reopening on refresh", (await request("/public/market")).body.phase === "paused");
  check("Public paused save rejected", (await request("/public/portfolio", "PUT", {allocation:{"ariel-pakes":100},version:1,requestId:crypto.randomUUID(),displayName:"Public Alice"}, "alice")).status === 409);
  await stop(); await start();
  check("Public pause persists across restart", (await request("/public/market")).body.phase === "paused");
  await request("/public/admin/state", "POST", {phase:"open"}, "admin");
  const parallelPublic = await Promise.all([1,2].map(() => request("/public/portfolio", "PUT", {allocation:{"hal-varian":100},version:1,requestId:crypto.randomUUID(),displayName:"Public Alice"}, "alice")));
  check("Public concurrent same-version writes cannot lose or multiply credits", parallelPublic.filter(r => r.status === 200).length === 1 && parallelPublic.filter(r => r.status === 409).length === 1 && (await request("/public/market")).body.pool === 100);
  check("Public deadline frozen after entry", (await request("/public/admin/state", "POST", {phase:"open",closesAt:"2026-10-13T00:00:00Z"}, "admin")).status === 409);
  await request("/public/admin/state", "POST", {phase:"closed"}, "admin");
  publicMarket = (await request("/public/market")).body;
  check("Public closing exposes only public final entries", publicMarket.entries.length === 1 && publicMarket.entries[0].displayName === "Public Alice");
  check("Public close cannot be undone by bootstrap or admin", (await request("/public/admin/state", "POST", {phase:"open"}, "admin")).status === 409 && (await request("/public/market")).body.phase === "closed");
  const publicPreview = (await request("/public/admin/settlement-preview", "POST", {winners:[{candidateId:"hal-varian",share:1}]}, "admin")).body;
  check("Public settlement uses only its own 100-point pool", publicPreview.rows.length === 1 && publicPreview.rows[0].points === 100);
  const publicSettled = await request("/public/admin/settle", "POST", {
    winners:[{candidateId:"hal-varian",share:1}],source:"https://www.nobelprize.org/prizes/economic-sciences/2026/summary/",
    reason:"Separate synthetic public settlement",expectedRevision:publicPreview.revision,
  }, "admin");
  check("Public settlement is independent of original settlement", publicSettled.status === 200 && publicSettled.body.settlement.revision === 1 && (await request("/market")).body.settlement.revision === 2);
  check("Unknown markets cannot create arbitrary objects", (await request("/other/market")).status === 404 && (await request("/publicity/market")).status === 404);
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
