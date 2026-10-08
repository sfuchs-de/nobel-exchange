import fs from "node:fs";
import assert from "node:assert/strict";
const c = JSON.parse(fs.readFileSync("wrangler.production.jsonc", "utf8"));
assert.equal(c.name, "nobel-exchange-api");
assert.equal(c.main, "worker/index.ts");
assert.equal(c.vars.ALLOWED_ORIGINS, "https://sfuchs-de.github.io");
assert.equal(c.vars.MARKET_CLOSE, "2026-10-12T00:00:00Z");
assert.equal(c.vars.ANNOUNCEMENT, "2026-10-12T09:45:00Z");
for (const key of ["DEV_AUTH", "ADMIN_SUB", "SESSION_SECRET"]) assert(!(key in c.vars), `${key} must not be a public production variable`);
assert.deepEqual(c.durable_objects.bindings, [{name:"MARKET", class_name:"Market"}]);
assert.deepEqual(c.migrations, [{tag:"v1", new_sqlite_classes:["Market"]}]);
const api = process.env.VITE_API_URL;
if (process.argv.includes("--live")) {
  assert.equal(api, "https://nobel-exchange-api.sfuchs-de.workers.dev", "Wrong production API target");
  const config = await fetch(api + "/api/config").then(r => {assert(r.ok); return r.json();});
  assert(config.authReady && !config.development, "Production sign-in is not ready or development auth is enabled");
  const market = await fetch(api + "/api/market").then(r => {assert(r.ok); return r.json();});
  assert.equal(market.closesAt, c.vars.MARKET_CLOSE);
  assert.equal(market.announcement, c.vars.ANNOUNCEMENT);
  assert(["setup", "open", "paused", "closed", "settled"].includes(market.phase));
  if (["setup", "open", "paused"].includes(market.phase)) assert(!market.entries, "Private portfolios leaked");
}
console.log("Production configuration checks passed" + (process.argv.includes("--live") ? "; HTTPS API and sign-in ready." : "; live service not checked."));
