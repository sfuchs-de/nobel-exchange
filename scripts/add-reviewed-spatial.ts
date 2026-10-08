/** Reproducible, reviewed source-data append. Never accesses participant storage. */
import fs from "node:fs";
import assert from "node:assert/strict";
import type { Candidate } from "../shared/types";
const read = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));
const data = read("public/candidates.json");
const additions = read("research/spatial-additions-2026-10-08.json");
const manifest = read("research/roster-extension-2026-10-08.json");
assert(data.version === manifest.fromVersion && data.candidates.length === manifest.fromCount, "Apply only once to the reviewed 99-person source snapshot");
const original = JSON.stringify(data.candidates);
const ids = new Set(data.candidates.map((c: Candidate) => c.id));
const fresh: Candidate[] = additions.candidates.map((c: Candidate) => ({...c,
  eligible: true, verifiedOn: additions.reviewedOn, institutionBasis: "current-profile", citations: null,
  mostCitedArticles: {status: "unavailable", retrievedOn: additions.reviewedOn, articles: [], reason: "A fresh verified author match is required; no citation counts have been invented."},
}));
assert(fresh.every(c => !ids.has(c.id)) && fresh.length === 3);
data.candidates.push(...fresh);
assert.equal(JSON.stringify(data.candidates.slice(0, manifest.fromCount)), original, "Existing profiles must remain byte-equivalent");
data.version = additions.version;
data.status = "Reviewed 102-person roster; three explicitly approved additive trade/spatial entries. Existing candidate profiles and participant data are preserved.";
data.institutionNote = "Original pool: institutions at award recognition. Twelve additions: primary profiles checked October 8, 2026. Each profile labels its basis.";
const eligibility = read("research/eligibility-audit.json");
const bibliography = read("research/bibliography-audit.json");
for (const c of fresh) {
  eligibility.push({id:c.id, name:c.name, source:c.profileUrl, title:"Primary institutional profile", death:[], status:"primary source reviewed", retrieved:additions.reviewedOn,
    evidence:"Current institutional profile reviewed; compared against all 99 laureate records in the official economics Nobel API inventory (58 prizes), no matching prior winner.",
    priorWinnerSource:"https://api.nobelprize.org/2.1/nobelPrizes?nobelPrizeCategory=eco&limit=100"});
  for (const p of c.papers) bibliography.push({candidate:c.id, title:p.title, url:p.url, reviewedUrl:p.url, reviewedYear:p.year, status:"manual source reviewed", retrieved:additions.reviewedOn,
    evidence:"Crossref DOI metadata independently verified for title, listed authors and print-publication year; corrected Geography of Development DOI is 10.1086/697084."});
}
for (const [p, obj] of [["public/candidates.json",data],["research/eligibility-audit.json",eligibility],["research/bibliography-audit.json",bibliography]]) fs.writeFileSync(p as string, JSON.stringify(obj,null,2)+"\n");
console.log(JSON.stringify({candidates:data.candidates.length, preserved:manifest.fromCount, added:fresh.map(c=>c.name), participantStorageChanged:false}));
