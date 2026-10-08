import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";

// Pages needs a real HTML file at this path; a development SPA fallback alone
// would pass local checks but produce a 404 after publication.
const html = readFileSync("dist/index.html", "utf8");
assert(html.includes('/nobel-exchange/assets/'), "Built assets must use the shared absolute base path");
mkdirSync("dist/public", { recursive: true });
writeFileSync("dist/public/index.html", html);
console.log("Built original and /public/ entry pages with shared assets.");
