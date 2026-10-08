// Apply the explicitly reviewed exceptions after check-bibliography.ts.
// These are public bibliographic facts, not inferred author matches.
import fs from "node:fs";
const data = JSON.parse(fs.readFileSync("public/candidates.json", "utf8"));
const audit = JSON.parse(
  fs.readFileSync("research/bibliography-audit.json", "utf8"),
);
const fixes: [string, string, number, string, string, boolean?][] = [
  [
    "mark-gertler",
    "The financial accelerator",
    1999,
    "https://www.nber.org/papers/w6455",
    "NBER identifies Gertler as an author and lists the 1999 Handbook chapter.",
  ],
  [
    "nicholas-bloom",
    "The Impact of Uncertainty Shocks",
    2009,
    "https://nbloom.people.stanford.edu/research",
    "Author publication list identifies Econometrica, May 2009.",
  ],
  [
    "oleg-itskhoki",
    "Inequality and Unemployment",
    2010,
    "https://doi.org/10.3982/ecta8640",
    "Publisher citation identifies Helpman, Itskhoki and Redding, 2010.",
  ],
  [
    "melissa-dell",
    "The Persistent Effects",
    2010,
    "https://dell.scholars.harvard.edu/publications/persistent-effects-perus-mining-mita",
    "Author publication page identifies Econometrica 78(6), 2010.",
  ],
  [
    "george-loewenstein",
    "Time Discounting",
    2002,
    "https://www.aeaweb.org/articles?id=10.1257/002205102320161311",
    "AEA article record identifies Frederick, Loewenstein and O’Donoghue, 2002.",
  ],
  [
    "sanford-j-grossman",
    "On the Impossibility",
    1980,
    "https://www.aeaweb.org/aer/top20/70.3.393-408.pdf",
    "Original AER article identifies Grossman and Stiglitz, June 1980.",
  ],
  [
    "israel-m-kirzner",
    "Entrepreneurial Discovery",
    1997,
    "https://econfaculty.gmu.edu/pboettke/summer/summer%20docs/kirzner1997.pdf",
    "Original JEL article identifies Kirzner and March 1997.",
  ],
  [
    "israel-m-kirzner",
    "Competition and Entrepreneurship",
    1973,
    "https://search.worldcat.org/title/Competition-and-entrepreneurship/oclc/807936",
    "Library record confirms original 1973 book; OpenAlex/DOI entry described a 1978 edition.",
    true,
  ],
  [
    "colin-camerer",
    "Behavioral Game Theory",
    2003,
    "https://casbs.stanford.edu/behavioral-game-theory-experiments-strategic-interaction",
    "Stanford book record identifies Camerer, publisher and 2003.",
  ],
  [
    "andrew-oswald",
    "Well-Being Over Time",
    2004,
    "https://doi.org/10.1016/S0047-2727(02)00168-8",
    "Warwick repository links the published article; 2002 is the draft/online date, 2004 the volume year.",
    true,
  ],
  [
    "amy-finkelstein",
    "The Oregon Health",
    2012,
    "https://economics.mit.edu/people/faculty/amy-finkelstein/publications",
    "MIT author publication list.",
  ],
  [
    "amy-finkelstein",
    "The Aggregate Effects",
    2007,
    "https://economics.mit.edu/people/faculty/amy-finkelstein/publications",
    "MIT author publication list.",
  ],
  [
    "anne-osborn-krueger",
    "The Political Economy",
    1974,
    "https://gazette.jhu.edu/2011/02/28/sais-profs-article-lauded-as-one-of-journals-best-in-100-years/",
    "Johns Hopkins identifies original AER article as 1974; replaced 2008 reprint date.",
    true,
  ],
];
for (const [id, fragment, year, source, evidence, clearTrend] of fixes) {
  const c = data.candidates.find((x: any) => x.id === id);
  const p = c.papers.find((x: any) =>
    x.title.toLowerCase().includes(fragment.toLowerCase()),
  );
  if (!p) throw Error("Missing reviewed publication " + id + ": " + fragment);
  const a = audit.find((x: any) => x.candidate === id && x.title === p.title);
  if (!a) throw Error("Missing audit row " + id);
  a.status = "manual source reviewed";
  a.source = source;
  a.evidence = evidence;
  a.retrieved = "2026-10-08";
  a.reviewedYear = year;
  p.year = year;
  // Retain DOI links unless the source fixes a wrong-edition or indirect record.
  if (
    clearTrend ||
    p.url.includes("openalex.org") ||
    id === "sanford-j-grossman"
  )
    p.url = source;
  a.reviewedUrl = p.url;
  if (!c.sources.some((s: any) => s.url === source))
    c.sources.push({ label: "Bibliographic cross-check", url: source });
  if (clearTrend && c.citations) {
    c.citations.years = [];
    c.citations.trendScope =
      "Unavailable after correcting the publication edition; no substituted annual values.";
  }
}
data.status =
  "Reviewed draft: 90 award-based candidates, individual-source checks and 180 bibliographic checks recorded. Publication approval remains separate.";
// Do not open public entries or remove the final editorial approval gate here.
fs.writeFileSync(
  "public/candidates.json",
  JSON.stringify(data, null, 2) + "\n",
);
fs.writeFileSync(
  "research/bibliography-audit.json",
  JSON.stringify(audit, null, 2) + "\n",
);
const eligibility = JSON.parse(
  fs.readFileSync("research/eligibility-audit.json", "utf8"),
);
for (const row of eligibility) {
  if (row.biography_excerpt) {
    row.evidence =
      "Biographical page reviewed for identity and living-status indicators; no exclusion identified. Recheck immediately before opening.";
    delete row.biography_excerpt;
  }
  delete row.birth;
  delete row.description;
}
fs.writeFileSync(
  "research/eligibility-audit.json",
  JSON.stringify(eligibility, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      publications: audit.length,
      reviewed: audit.filter((x: any) =>
        ["metadata agrees", "manual source reviewed"].includes(x.status),
      ).length,
      launchReady: data.launchReady,
    },
    null,
    2,
  ),
);
