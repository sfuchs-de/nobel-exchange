/** Deterministic, local draft-only editorial migration. Does not access participant storage. */
import fs from "node:fs";
import assert from "node:assert/strict";
import type { Candidate, CandidateEvidence, ContenderGroup } from "../shared/types";

const reviewedOn = "2026-10-08";
const read = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));
const data = read("public/candidates.json");
assert(process.argv.includes("--draft") && data.launchReady === false, "Only apply to an unopened draft; never modify a frozen live roster.");
const additions = read("research/roster-additions.json");
const review = fs.readFileSync("research/candidate-review-2026-10-08.md", "utf8").split("## Missing candidates")[0];
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
const groups: Record<string, ContenderGroup> = { Core: "established", Plausible: "broad", Future: "future", Speculative: "outsider" };
const source = (kind: CandidateEvidence["kind"], label: string, url: string, dateLabel: string, note: string, targetYear?: number): CandidateEvidence =>
  ({ kind, label, url, dateLabel, retrievedOn: reviewedOn, note, ...(targetYear ? { targetYear } : {}) });
const predictionUrl = "https://nicholasdecker.substack.com/p/berry-hausman-pakes-should-win-the";
const catalog: Record<string, CandidateEvidence> = {
  N26: source("preview", "NPR", "https://www.nprillinois.org/2026-10-07/who-will-win-the-2026-nobel-prize-in-economics", "Oct 7, 2026", "Discussed in a public 2026 preview, not an official shortlist.", 2026),
  P26: source("market", "Polymarket", "https://polymarket.com/event/nobel-economics-prize-winner-2026", "checked Oct 8, 2026", "Listed in the public 2026 market when checked. Listing is not expert endorsement; no odds or prices are reproduced.", 2026),
  T26: source("forecast", "Tol", "https://richardtol.substack.com/p/2026-nobel-memorial-prize", "Sep 20, 2026", "On the principal ten-name list in one model-based 2026 forecast, not a consensus ranking.", 2026),
  M23: source("forecast", "Cowen", "https://marginalrevolution.com/marginalrevolution/2023/10/who-will-win-the-next-nobel-prize-in-economics-2.html", "Oct 8, 2023", "An explicit historical prediction alongside Pakes/Bresnahan; not a new 2026 forecast.", 2023),
  M24: source("forecast", "Cowen", "https://marginalrevolution.com/marginalrevolution/2024/10/tomorrows-nobel.html", "2024", "An explicit historical prediction; not a new 2026 forecast.", 2024),
  E24: source("forecast", "Trade prediction", "https://eco.nomie.nl/2024/10/nobelprognose-2024/", "2024", "Discussed in a historical trade-prize prediction, not a current annual call.", 2024),
  D25: source("forecast", "Decker · IO", predictionUrl, "2025", "Explicit advocacy for an empirical-IO prize in 2025; historical rather than a 2026 annual prediction.", 2025),
  D26: source("forecast", "Decker · 2026 trade", predictionUrl, "2025", "A 2025 essay's explicit forward prediction for a 2026 trade prize. One commentator's view.", 2026),
  DL: source("longlist", "Decker longlist", predictionUrl, "2025", "An exceptionally broad future longlist, not an annual shortlist or a leading 2026 prediction."),
  S19: source("advocacy", "Econ Journal Watch", "https://econjwatch.org/articles/lawrence-summers-deserves-a-nobel-prize-for-reviving-the-theory-of-secular-stagnation", "2019", "Historical published advocacy for Summers, not a current annual forecast."),
  H24: source("advocacy", "Cowen & Tabarrok", "https://www.mercatus.org/marginal-revolution-podcast/economics-nobel-predictions-2024-missed-opportunities", "Oct 8, 2024", "Historical podcast advocacy for recognizing data builders, explicitly including Haltiwanger. Not a 2026 forecast or an official nomination."),
};
function evidence(c: Candidate, codes: string[], context = "", award?: any): CandidateEvidence[] {
  const rows = codes.map((code) => ({ ...catalog[code] }));
  const tol = rows.find((r) => r.label === "Tol");
  if (tol && /partner/i.test(context)) {
    tol.label = "Tol · possible partner";
    tol.note = "Named as a possible co-recipient, not on Tol's principal ten-name list. One forecast, not consensus.";
  } else if (tol && !/principal/i.test(context)) {
    tol.kind = "preview";
    tol.label = "Tol · discussion";
    tol.note = /Cunningham/.test(context) ? "A secondhand report of Cunningham's pick in Tol's discussion; the original forecast has not been independently read." : "Mentioned in the forecast's discussion, not on its principal ten-name list.";
  }
  if (rows.find((r) => r.label === "NPR") && context.includes("BLP")) {
    rows.find((r) => r.label === "NPR")!.note = "The preview discusses the coauthored BLP contribution; this is not a separate annual prediction for each coauthor.";
  }
  if (c.id === "edward-glaeser") {
    const row = rows.find((r) => r.label === "Trade prediction");
    if (row) { row.kind = "preview"; row.note = "This 2024 post recalls an earlier urban-economics prediction, rather than newly predicting Glaeser."; }
  }
  const honor = c.honors.find((h) => h.includes("Clarivate")) || c.honors.find((h) => h.includes("Clark"));
  if (honor) {
    const clarivate = honor.includes("Clarivate");
    rows.push(source("award", clarivate ? "Clarivate" : "Clark Medal", clarivate ? "https://clarivate.com/citation-laureates/hall-of-citation-laureates/" : "https://www.aeaweb.org/about-aea/honors-awards/bates-clark", honor.split("·")[1]?.trim() || String(c.year), clarivate ? "Recognition of Nobel-class research. Clarivate explicitly does not predict winners in a particular year." : "A research medal, not evidence of an imminent Nobel prize."));
  } else if (award) {
    rows.push(source("award", award.label, award.url, award.dateLabel, "A major research award supports inclusion, not an annual Nobel forecast."));
  }
  assert(rows.length && rows.every((row) => row.label && row.url && row.note), "Every candidate needs dated inclusion evidence: " + c.id);
  return rows;
}
const priority = ["ariel-pakes", "susan-athey", "robert-barro", "hal-varian", "michael-dean-woodford", "sidney-g-winter", "steven-t-berry", "james-a-levinsohn", "timothy-bresnahan", "marc-melitz", "samuel-kortum", "elhanan-helpman", "gene-grossman", "avinash-dixit", "sanford-j-grossman", "kenneth-french", "kevin-m-murphy", "drew-fudenberg", "whitney-newey", "raj-chetty", "janet-currie", "david-autor", "emmanuel-saez"];
const overrides: Record<string, Partial<Candidate>> = {
  "ariel-pakes": { name: "Ariel Pakes", field: "IO & digital", tags: ["Empirical IO", "Demand", "Productivity", "Dynamic IO"] },
  "michael-dean-woodford": { name: "Michael Woodford" },
  "anne-osborn-krueger": { name: "Anne Krueger" },
  "david-forbes-hendry": { name: "David Hendry" },
  "katarina-juselius-johansen": { name: "Katarina Juselius" },
  "james-a-levinsohn": { field: "IO & digital", tags: ["Empirical IO", "BLP", "Trade"] },
  "steven-t-berry": { field: "IO & digital", tags: ["Empirical IO", "BLP", "Demand"] },
  "susan-athey": { field: "IO & digital", tags: ["Digital economics", "Causal machine learning", "Market design"] },
  "hal-varian": { field: "IO & digital", tags: ["Digital economics", "Information"] },
  "sam-peltzman": { field: "IO & digital", tags: ["Regulation", "Incentives"] },
  "jonathan-levin": { field: "IO & digital", tags: ["Market design", "IO"] },
  "matthew-gentzkow": { field: "IO & digital", tags: ["Media", "Information"] },
  "john-h-moore": { field: "Macro & growth", tags: ["Credit cycles", "Collateral", "Contracts"] },
  "nobuhiro-kiyotaki": { tags: ["Credit cycles", "Collateral"] },
  "kenneth-rogoff": { field: "Finance" },
  "yuliy-sannikov": { field: "Finance", tags: ["Dynamic contracting", "Financial theory"] },
  "edward-glaeser": { field: "Urban & spatial", tags: ["Cities", "Agglomeration"] },
  "paolo-mauro": { field: "Political economy", tags: ["Development", "Corruption"] },
  "parag-pathak": { tags: ["Market design", "School choice"] },
  "janet-currie": { tags: ["Health", "Childhood", "Public economics"] },
  "amy-finkelstein": { tags: ["Health insurance", "Public economics"] },
  "thomas-piketty": { tags: ["Inequality", "Wealth measurement"] },
  "emmanuel-saez": { tags: ["Optimal taxation", "Inequality"] },
  "gabriel-zucman": { tags: ["Wealth measurement", "Taxation"] },
};
const reasonOverrides: Record<string, string> = {
  "ariel-pakes": "A mature empirical-IO case spanning demand, productivity and dynamic industry models, with explicit predictions and current public attention. BLP is one part of the contribution, not the whole case.",
  "susan-athey": "Digital economics, theory and causal machine learning offer related but distinct prize cases. Current public attention and fresh Clarivate recognition support prominence, without implying an official shortlist.",
  "robert-barro": "Government debt, expectations and long-run growth offer a mature macroeconomic case, with several independent current public mentions. The rationale is broader than cross-country growth regressions.",
  "steven-t-berry": "Demand estimation and empirical industrial organization provide a distinct prize case. Decker explicitly advocated an IO prize; NPR discusses the coauthored BLP contribution, not a separate forecast for each author.",
  "james-a-levinsohn": "The BLP contribution makes a coherent empirical-IO co-recipient case. NPR discusses that coauthored work; this does not establish a separate annual prediction for each author.",
};
const existing = data.candidates.filter((c: Candidate) => !additions.candidates.some((a: any) => a.id === c.id)) as Candidate[];
assert.equal(existing.length, 90, "Preserve the complete original 90-person pool");
const seen = new Set<string>();
for (const line of review.split("\n")) {
  const row = line.match(/^\| ([^|]+) \| ([^|]+) \| \*\*(Core|Plausible|Future|Speculative)\.\*\* (.+) \|$/);
  if (!row) continue;
  const [, name, inclusion, assessment, fullReason] = row;
  const c = existing.find((x) => [x.name, ...(x.aliases || [])].some((n) => norm(n) === norm(name)));
  assert(c && !seen.has(c.id), "Unmatched or duplicated audit row: " + name);
  seen.add(c.id);
  // The first sentence gives the research case, without stale implementation instructions.
  const reason = fullReason.match(/^.+?[.!?](?: |$)/)?.[0].trim() || fullReason;
  const codes = [...inclusion.matchAll(/\b(N26|P26|T26|M23|M24|E24|D25|D26|DL|S19)\b/g)].map((m) => m[1]);
  c.editorial = { group: groups[assessment], reason, reviewedOn, evidence: evidence(c, codes, inclusion) };
  if (reasonOverrides[c.id]) c.editorial.reason = reasonOverrides[c.id];
  c.institutionBasis = "award-time";
}
assert.equal(seen.size, 90, "All original candidates receive a disposition");
const newCards: Candidate[] = additions.candidates.map((a: any) => {
  const { group, reason, evidenceCodes, award, tolRole, ...card } = a;
  const c: Candidate = { ...card, eligible: true, verifiedOn: reviewedOn, institutionBasis: "current-profile", citations: null,
    editorial: { group, reason, reviewedOn, evidence: [] } };
  c.editorial.evidence = evidence(c, evidenceCodes, tolRole === "partner" ? "partner" : "principal", award);
  return c;
});
data.candidates = [...existing, ...newCards];
for (const c of data.candidates as Candidate[]) {
  const change = overrides[c.id];
  if (change?.name && change.name !== c.name) c.aliases = [...new Set([...(c.aliases || []), c.name])];
  Object.assign(c, change);
  if (priority.includes(c.id)) c.editorial.priority = priority.indexOf(c.id);
  for (const e of c.editorial.evidence) if (!c.sources.some((s) => s.url === e.url)) c.sources.push({ label: `${e.label} · ${e.dateLabel}`, url: e.url });
}
data.version = additions.rosterVersion;
data.status = `Reviewed editorial draft: ${data.candidates.length} candidates; established, broad, future and outsider groups; dated evidence distinguishes awards from predictions.`;
data.institutionNote = `Original pool: institutions at award recognition. ${newCards.length} additions: primary profiles checked October 8, 2026. Each profile labels its basis.`;
data.editorialReviewedOn = reviewedOn;
const write = (p: string, x: unknown) => fs.writeFileSync(p, JSON.stringify(x, null, 2) + "\n");
write("public/candidates.json", data);
const eligibility = read("research/eligibility-audit.json").filter((x: any) => !newCards.some((c) => c.id === x.id));
for (const c of newCards) eligibility.push({ id: c.id, name: c.name, source: c.profileUrl, title: "Primary institutional profile", death: [], status: "primary source reviewed", retrieved: reviewedOn, evidence: additions.eligibilityNote, priorWinnerSource: additions.eligibilitySource });
write("research/eligibility-audit.json", eligibility);
const bibliography = read("research/bibliography-audit.json").filter((x: any) => !newCards.some((c) => c.id === x.candidate));
for (const c of newCards) for (const p of c.papers) bibliography.push({ candidate: c.id, title: p.title, url: p.url, reviewedUrl: p.url, reviewedYear: p.year, status: "manual source reviewed", retrieved: reviewedOn,
  evidence: p.url.includes("doi.org") ? "Crossref title, publication year and author names checked; print edition used where online-first year differs." : "Author/publisher book record checked for title, authorship and original edition year." });
write("research/bibliography-audit.json", bibliography);
console.log(JSON.stringify({ cards: data.candidates.length, retainedIds: existing.length, additions: newCards.length, groups: Object.fromEntries(Object.values(groups).map((g) => [g, data.candidates.filter((c: Candidate) => c.editorial.group === g).length])), participantStorageChanged: false }, null, 2));
