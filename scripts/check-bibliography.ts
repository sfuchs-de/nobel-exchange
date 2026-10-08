// Public Crossref metadata is an independent check on OpenAlex publication dates.
// Never silently change titles/authors. Identity/title mismatches remain review items.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const path = "public/candidates.json";
const data = JSON.parse(fs.readFileSync(path, "utf8"));
const out: any[] = [];
const norm = (s: string) =>
  s
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
for (const c of data.candidates) {
  for (const p of c.papers) {
    if (!p.url.startsWith("https://doi.org/")) {
      out.push({
        candidate: c.id,
        title: p.title,
        status: "author or repository source",
        url: p.url,
      });
      continue;
    }
    const doi = p.url.slice("https://doi.org/".length),
      cache =
        "research/raw/crossref-" + Buffer.from(doi).toString("hex") + ".json";
    try {
      if (!fs.existsSync(cache)) {
        await new Promise((r) => setTimeout(r, 900));
        const result = execFileSync(
          "curl",
          [
            "--fail",
            "--silent",
            "--show-error",
            "--max-time",
            "20",
            "https://api.crossref.org/works/" + encodeURIComponent(doi),
          ],
          { encoding: "utf8", maxBuffer: 4e6 },
        );
        fs.writeFileSync(cache, result);
      }
      const m = JSON.parse(fs.readFileSync(cache, "utf8")).message;
      const title = m.title?.[0] || "";
      const titleOK =
        norm(title) === norm(p.title) ||
        norm(title).includes(norm(p.title)) ||
        norm(p.title).includes(norm(title));
      const surname = norm(
        c.name.split(" ").at(-1)!.replace("Juselius-Johansen", "Juselius"),
      );
      const authorOK = (m.author || []).some(
        (a: any) =>
          norm(a.family || "") === surname ||
          (c.id === "katarina-juselius-johansen" &&
            norm(a.family || "") === "juselius"),
      );
      const year = (m["published-print"] || m.published || m.issued)?.[
        "date-parts"
      ]?.[0]?.[0];
      const originalYear = p.year;
      if (titleOK && authorOK && Number.isInteger(year)) p.year = year;
      out.push({
        candidate: c.id,
        title: p.title,
        crossrefTitle: title,
        url: p.url,
        authors: (m.author || []).map((a: any) => a.family),
        titleOK,
        authorOK,
        originalYear,
        crossrefYear: year,
        status: titleOK && authorOK ? "metadata agrees" : "review",
        retrieved: "2026-10-08",
      });
    } catch (error) {
      out.push({
        candidate: c.id,
        title: p.title,
        url: p.url,
        status: "unavailable",
        error: String(error).slice(0, 150),
      });
      // A rate limit is not a reason to retry rapidly or use another account.
      if (String(error).includes("429")) throw error;
    }
  }
}
fs.writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
fs.writeFileSync(
  "research/bibliography-audit.json",
  JSON.stringify(out, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      records: out.length,
      agrees: out.filter((x) => x.status === "metadata agrees").length,
      review: out.filter((x) => x.status === "review"),
      unavailable: out.filter((x) => x.status === "unavailable"),
      otherSources: out.filter(
        (x) => x.status === "author or repository source",
      ).length,
    },
    null,
    2,
  ),
);
