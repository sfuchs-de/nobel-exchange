import type { CitedArticle } from "./types";

export const normalizeTitle = (s: string) => s.replace(/&amp;/g,"&").replace(/<[^>]+>/g,"").normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[ø]/g, "o").replace(/ı/g,"i")
  .replace(/[^a-z0-9]/g, "");

// Rank distinct journal articles, not books, book reviews, repositories or
// reprints in edited volumes. Database versions' counts are never added.
export function rankArticles(works: any[], authorId: string, exclusions: Record<string, string> = {}) {
  const articles: CitedArticle[] = [];
  const skipped: { id: string; title: string; reason: string }[] = [];
  const seenTitles = new Set<string>(), seenDois = new Set<string>();
  for (const w of [...works].sort((a, b) => b.cited_by_count - a.cited_by_count)) {
    const source = [w.primary_location, ...(w.locations || [])].find(l => l?.source?.type === "journal")?.source;
    const reason = exclusions[w.id?.split("/").pop()] ||
      (!w.authorships?.some((a: any) => a.author?.id === authorId) ? "Author ID absent" : "") ||
      (!/^https:\/\/openalex.org\/W\d+$/.test(w.id) ? "Invalid work ID" : "") ||
      (!Number.isInteger(w.cited_by_count) || w.cited_by_count < 0 ? "Missing citation count" : "") ||
      (!["article", "review"].includes(w.type) || source?.type !== "journal" ? "Not a journal article" : "") ||
      (w.is_retracted || w.is_paratext ? "Retracted or paratext record" : "") ||
      (!w.title || !Number.isInteger(w.publication_year) ? "Missing title or year" : "") ||
      (/\b(book review|review of the book|books received|correction:|erratum:|corrigendum:)\b/i.test(w.title) ? "Review or correction" : "");
    if (reason) { skipped.push({ id: w.id, title: w.title, reason }); continue; }
    const title = normalizeTitle(w.title), doi = (w.doi || "").toLowerCase();
    if (seenTitles.has(title) || (doi && seenDois.has(doi))) {
      skipped.push({ id: w.id, title: w.title, reason: "Duplicate title or DOI; counts not combined" }); continue;
    }
    seenTitles.add(title); if (doi) seenDois.add(doi);
    articles.push({ id: w.id, title: w.title, url: /^https:\/\//.test(w.doi || "") ? w.doi : w.id,
      year: w.publication_year, venue: source.display_name, citations: w.cited_by_count });
    if (articles.length === 5) break;
  }
  return { articles, skipped };
}
