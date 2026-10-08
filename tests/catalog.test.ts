import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { catalogCandidates, contenderGroups, leadEvidence } from "../shared/catalog";
import type { Candidate } from "../shared/types";
const roster = JSON.parse(fs.readFileSync("public/candidates.json", "utf8"));
const candidates = roster.candidates as Candidate[];
const candidate = (id: string) => candidates.find((c) => c.id === id)!;

describe("reviewed candidate catalog", () => {
  it("finds names using ASCII spellings of non-decomposing letters", () => {
    expect(catalogCandidates(candidates, { query: "Soren Johansen" }).map(c => c.name)).toContain("Søren Johansen");
  });
  it("classifies all 99 candidates, without removing any of the audited 90 identities", () => {
    expect(candidates).toHaveLength(99);
    const review = fs.readFileSync("research/candidate-review-2026-10-08.md", "utf8").split("## Missing candidates")[0];
    const names = [...review.matchAll(/^\| ([^|]+) \| [^|]+ \| \*\*(Core|Plausible|Future|Speculative)\.\*\*/gm)].map((m) => m[1]);
    expect(names).toHaveLength(90);
    expect(names.every((name) => candidates.some((c) => c.name === name || c.aliases?.includes(name)))).toBe(true);
    expect(new Set(candidates.map((c) => c.id)).size).toBe(99);
    expect(Object.keys(contenderGroups).map((g) => candidates.filter((c) => c.editorial.group === g).length)).toEqual([46, 35, 11, 7]);
  });
  it("features established cases rather than the latest award year", () => {
    const sorted = catalogCandidates([...candidates].reverse());
    expect(sorted.slice(0, 3).map((c) => c.id)).toEqual(["ariel-pakes", "susan-athey", "robert-barro"]);
    expect(sorted.slice(0, 46).every((c) => c.editorial.group === "established")).toBe(true);
    expect(sorted.findIndex((c) => c.id === "ludwig-straub")).toBeGreaterThan(79);
    expect(candidate("robert-barro").year).toBeNull();
  });
  it("keeps recent award-based future picks distinct and outsiders accessible", () => {
    expect(catalogCandidates(candidates, { group: "future" })).toHaveLength(11);
    expect(catalogCandidates(candidates, { group: "future" }).some((c) => c.id === "philipp-strack")).toBe(true);
    expect(catalogCandidates(candidates, { group: "outsider" }).some((c) => c.id === "richard-posner")).toBe(true);
  });
  it("combines group, field and term filters and handles accents and old names", () => {
    expect(catalogCandidates(candidates, { query: "jordi gali" }).map((c) => c.id)).toEqual(["jordi-gali"]);
    expect(catalogCandidates(candidates, { query: "michael dean woodford" }).map((c) => c.name)).toEqual(["Michael Woodford"]);
    expect(catalogCandidates(candidates, { query: "learning", group: "established", field: "Econometrics" }).map((c) => c.id)).toContain("victor-chernozhukov");
    expect(catalogCandidates(candidates, { query: "woodford", group: "outsider" })).toEqual([]);
  });
  it("preserves alphabetical and public crowd sorts without changing data", () => {
    const before = JSON.stringify(candidates);
    expect(catalogCandidates(candidates, { sort: "Crowd backing", totals: { "samuel-kortum": 100 } })[0].id).toBe("samuel-kortum");
    const names = catalogCandidates(candidates, { sort: "Name" }).map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(JSON.stringify(candidates)).toBe(before);
  });
  it("leaves unmatched new citation totals unavailable and sorts them after measured totals", () => {
    const added = ["timothy-bresnahan", "samuel-kortum", "whitney-newey", "drew-fudenberg", "matthew-jackson", "andreu-mas-colell", "victor-chernozhukov", "luigi-zingales", "john-haltiwanger"];
    expect(added.every((id) => candidate(id).citations === null && candidate(id).papers.length === 2)).toBe(true);
    const sorted = catalogCandidates(candidates, { sort: "Citations" });
    expect(sorted.slice(89).every((c) => c.citations === null)).toBe(true);
  });
  it("does not relabel awards, historical forecasts or future longlists as 2026 predictions", () => {
    for (const c of candidates) for (const e of c.editorial.evidence) {
      if (["award", "longlist"].includes(e.kind)) expect(e.targetYear).toBeUndefined();
      expect(e.dateLabel).toBeTruthy();
    }
    const bresnahan = candidate("timothy-bresnahan").editorial.evidence.find((e) => e.label === "Cowen")!;
    expect(bresnahan.targetYear).toBe(2023);
    expect(candidate("whitney-newey").editorial.evidence.every((e) => e.kind === "award")).toBe(true);
    const kortum = leadEvidence(candidate("samuel-kortum"));
    expect(kortum.targetYear).toBe(2026);
    expect(kortum.dateLabel).toBe("2025");
  });
  it("keeps possible partners and discussion mentions distinct from principal picks", () => {
    const jackson = candidate("matthew-jackson").editorial.evidence.find((e) => e.label.startsWith("Tol"))!;
    expect(jackson.label).toBe("Tol · possible partner");
    expect(jackson.note).toContain("not on Tol's principal");
    const bhagwati = candidate("jagdish-bhagwati").editorial.evidence.find((e) => e.label.startsWith("Tol"))!;
    expect(bhagwati.kind).toBe("preview");
    expect(bhagwati.note).toContain("not on its principal");
  });
  it("includes Haltiwanger with historical advocacy, checked papers and searchable firm dynamics", () => {
    const h = candidate("john-haltiwanger");
    expect(h.institution).toBe("University of Maryland");
    expect(h.editorial.group).toBe("established");
    expect(h.papers.map((p) => p.year)).toEqual([2013, 2008]);
    expect(catalogCandidates(candidates, { query: "firm dynamics", group: "established" }).map((c) => c.id)).toContain(h.id);
    expect(catalogCandidates(candidates, { query: "John C. Haltiwanger" }).map((c) => c.id)).toEqual([h.id]);
    const advocacy = h.editorial.evidence.find((e) => e.kind === "advocacy")!;
    expect(advocacy.dateLabel).toBe("Oct 8, 2024");
    expect(advocacy.targetYear).toBeUndefined();
    expect(advocacy.note).toContain("Not a 2026 forecast");
  });
});
