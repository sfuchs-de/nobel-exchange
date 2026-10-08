import fs from "node:fs";
import assert from "node:assert/strict";
import type { Candidate } from "../shared/types";
const data = JSON.parse(fs.readFileSync("public/candidates.json", "utf8"));
const inventory = JSON.parse(
  fs.readFileSync("research/clarivate-inventory.json", "utf8"),
);
const audit = JSON.parse(
  fs.readFileSync("research/eligibility-audit.json", "utf8"),
);
const bibliography = JSON.parse(
  fs.readFileSync("research/bibliography-audit.json", "utf8"),
);
const articleAudit=JSON.parse(fs.readFileSync("research/article-bibliography-audit.json","utf8"));
const articleAuthors=new Set<string>();
const ids = new Set<string>(),
  names = new Set<string>(),
  recognizedNames = new Set<string>(),
  authorIds = new Set<string>();
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
const excluded = new Set(
  inventory.entries
    .filter((x: any) => !x.eligible)
    .map((x: any) => norm(x.name)),
);
function url(s: string) {
  const u = new URL(s);
  assert.equal(u.protocol, "https:");
  assert(!u.username && !u.password, "No credentials in sources");
}
assert(
  data.candidates.length >= 80 && data.candidates.length <= 120,
  "Roster size",
);
for (const c of data.candidates as Candidate[]) {
  assert(
    !ids.has(c.id) && /^[a-z0-9-]+$/.test(c.id),
    "Unique stable slug: " + c.id,
  );
  ids.add(c.id);
  assert(
    !names.has(norm(c.name)) && !excluded.has(norm(c.name)),
    "Unique eligible person: " + c.name,
  );
  names.add(norm(c.name));
  [c.name, ...(c.aliases || [])].forEach((name) => {
    assert(!excluded.has(norm(name)), "Excluded alias: " + name);
    recognizedNames.add(norm(name));
  });
  assert(
    c.eligible &&
      c.name &&
      c.institution &&
      c.field &&
      c.summary.length > 25 &&
      c.honors.length,
    "Complete card: " + c.id,
  );
  assert.equal(c.papers.length, 2, "Two publication examples: " + c.id);
  const ranking=c.mostCitedArticles;
  assert(ranking && ["available","unavailable"].includes(ranking.status),"Article ranking status: "+c.id);
  assert(ranking.retrievedOn && ranking.articles.length<=5);
  if(ranking.status==="unavailable")assert(ranking.reason && ranking.articles.length===0);
  else {
    assert(ranking.articles.length>0 && ranking.authorId && ranking.queryUrl && ranking.matchEvidence);
    assert(!articleAuthors.has(ranking.authorId),"Shared article-ranking author: "+c.id);articleAuthors.add(ranking.authorId);
    url(ranking.authorId);url(ranking.queryUrl);
    if(c.citations)assert.equal(ranking.authorId,c.citations.openAlexId);
    assert(new Set(ranking.articles.map(w=>w.id)).size===ranking.articles.length);
    let previous=Infinity;
    for(const w of ranking.articles){
      assert(w.title && w.venue && Number.isInteger(w.year));url(w.id);url(w.url);
      assert(Number.isInteger(w.citations) && w.citations>=0 && w.citations<=previous);previous=w.citations;
      const row=articleAudit.find((a:any)=>a.id===c.id);
      assert(row?.articles.some((a:any)=>JSON.stringify(a)===JSON.stringify(w)),"Unaudited article: "+c.id);
      assert(["crossref","openalex"].includes(w.verification || ""));
    }
  }
  c.papers.forEach((p) => {
    assert(p.title && p.year);
    url(p.url);
  });
  assert(c.sources.length >= 2);
  c.sources.forEach((s) => url(s.url));
  url(c.profileUrl);
  assert(["established", "broad", "future", "outsider"].includes(c.editorial?.group), "Reviewed contender group: " + c.id);
  assert(c.editorial.reason.length > 20 && c.editorial.reviewedOn === "2026-10-08");
  assert(c.editorial.evidence.length, "Dated inclusion evidence: " + c.id);
  for (const e of c.editorial.evidence) {
    assert(["award", "forecast", "preview", "market", "longlist", "advocacy"].includes(e.kind));
    assert(e.label && e.dateLabel && e.retrievedOn && e.note.length > 20);
    url(e.url);
    if (e.kind === "award") assert(!e.targetYear, "Award is not an annual forecast");
    if (e.kind === "market") assert(e.note.includes("not expert endorsement"));
    if (e.kind === "longlist") assert(!e.targetYear, "Future longlist is not an annual prediction");
  }
  assert(audit.some((row: any) => row.id === c.id), "Individual identity check: " + c.id);
  if (c.portrait) {
    assert(c.portrait.license && c.portrait.author);
    url(c.portrait.source);
    url(c.portrait.url);
  }
  if (c.citations) {
    const x = c.citations;
    assert(Number.isInteger(x.total) && x.total >= 0);
    assert(!authorIds.has(x.openAlexId), "Shared author ID: " + c.id);
    authorIds.add(x.openAlexId);
    url(x.openAlexId);
    assert(x.matchEvidence && x.retrieved);
    assert(x.years.length === 0 || x.years.length === 5);
    if (x.years.length) {
      assert(x.trendScope.includes("Selected works"));
      assert.deepEqual(
        x.years.map((y) => y.year),
        [2021, 2022, 2023, 2024, 2025],
      );
      x.years.forEach((y) => assert(Number.isInteger(y.count) && y.count >= 0));
    }
  }
}
for (const e of inventory.entries.filter((x: any) => x.eligible))
  assert(
    recognizedNames.has(norm(e.name)),
    "Missing eligible Clarivate entry: " + e.name,
  );
const pending = audit
  .filter(
    (x: any) =>
      !["reviewed source", "primary source reviewed"].includes(x.status),
  )
  .map((x: any) => x.name);
const report = {
  cards: ids.size,
  citationTotals: authorIds.size,
  publicationExamples: ids.size * 2,
  articleRankings: articleAuthors.size,
  fiveArticleProfiles: data.candidates.filter((c:Candidate)=>c.mostCitedArticles?.articles.length===5).length,
  rankedArticles: data.candidates.reduce((n:number,c:Candidate)=>n+(c.mostCitedArticles?.articles.length||0),0),
  individualSourcesReviewed: audit.length - pending.length,
  pendingIndividualChecks: pending,
  launchReady: data.launchReady,
  contenderGroups: Object.fromEntries(["established", "broad", "future", "outsider"].map((group) => [group, data.candidates.filter((c: Candidate) => c.editorial.group === group).length])),
};
for (const c of data.candidates)
  for (const p of c.papers) {
    const row = bibliography.find(
      (x: any) => x.candidate === c.id && x.title === p.title,
    );
    assert(
      row && ["metadata agrees", "manual source reviewed"].includes(row.status),
      "Unreviewed bibliography: " + c.id + " / " + p.title,
    );
    assert.equal(
      row.reviewedYear ?? row.crossrefYear,
      p.year,
      "Bibliography year drift: " + c.id,
    );
    assert.equal(
      row.reviewedUrl ?? row.url,
      p.url,
      "Bibliography URL drift: " + c.id,
    );
  }
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes("--release")) {
  assert.equal(
    pending.length,
    0,
    "Finish every individual source check before release",
  );
  assert.equal(
    data.launchReady,
    true,
    "Complete the editorial launch review before release",
  );
}
