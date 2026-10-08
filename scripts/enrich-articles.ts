import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import type { Candidate, ArticleRanking } from "../shared/types";
import { normalizeTitle, rankArticles } from "../shared/article-ranking";

const args = process.argv.slice(2);
const date = args.find(x=>x.startsWith("--date="))?.split("=")[1] || new Date().toISOString().slice(0,10), path = "public/candidates.json";
if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error("Invalid snapshot date");
const original = fs.readFileSync(path, "utf8"), data = JSON.parse(original);
const exclusions = JSON.parse(fs.readFileSync("research/article-exclusions.json", "utf8"));
const dir = `research/raw/articles-${date}`;
fs.mkdirSync(dir, { recursive: true });
const apply = args.includes("--apply"), offline = args.includes("--offline");
if(apply)throw Error("Preparation is preview-only. Run verify:articles -- --apply after inspecting the prepared rankings.");
const cachedOnly = args.includes("--cached");
const limit = Number(args.find(x => x.startsWith("--limit="))?.split("=")[1] || data.candidates.length);
const only = args.find(x => x.startsWith("--only="))?.split("=")[1];
const aliases: Record<string, string> = { "m-hashem-pesaran": "Hashem Pesaran", "michael-dean-woodford": "Michael Woodford", "katarina-juselius-johansen": "Katarina Juselius", "david-forbes-hendry": "David Hendry", "anne-osborn-krueger": "Anne Krueger", "john-haltiwanger": "John Haltiwanger" };
const norm = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/ı/g,"i").replace(/ø/g,"o").replace(/[^a-z ]/g, " ").replace(/\s+/g," ").trim();
async function get(url: string, key: string): Promise<any> {
  const file = `${dir}/${key}.json`;
  if (fs.existsSync(file)) {
    const cached = JSON.parse(fs.readFileSync(file, "utf8"));
    if (cached.url !== url) throw Error("Cache URL mismatch: " + key);
    return cached.response;
  }
  if (offline) throw Error("No cached response: " + key);
  await new Promise(r => setTimeout(r, 350));
  let response: any;
  for (let attempt=0; attempt<3; attempt++) {
    try {
      const raw = execFileSync("curl", ["--fail", "--silent", "--show-error", "--max-time", "35", url], { encoding:"utf8", maxBuffer:12e6 });
      response = JSON.parse(raw); break;
    } catch (e) {
      // No credentials or paid fallback. Quota errors stop this run.
      if (String(e).includes("429") || attempt === 2) throw e;
      await new Promise(r => setTimeout(r, 1500 * (attempt+1)));
    }
  }
  fs.writeFileSync(file, JSON.stringify({url, retrievedAt:new Date().toISOString(), response},null,2)+"\n", {flag:"wx"});
  return response;
}
function nameMatch(c: Candidate, a: any) {
  const wanted=norm(aliases[c.id] || c.name).split(" ").filter(s=>s.length>1);
  const words=norm(a.display_name || "").split(" ");
  return wanted.every(w=>words.includes(w));
}
function institutionMatch(c: Candidate, a: any) {
  const institutions=[...(a.last_known_institutions || []), ...(a.affiliations || []).map((x:any)=>x.institution)]
    .map((i:any)=>norm(i.display_name || ""));
  let expected=norm(c.institution);
  if (/\bmit\b/.test(expected)) expected += " massachusetts institute technology";
  if (expected.includes("upf")) expected += " pompeu fabra";
  const words=expected.split(" ").filter(w=>w.length>4 && !["university","institute","technology","school","college","emeritus"].includes(w));
  return institutions.some((i:string)=>words.some(w=>i.split(" ").includes(w)));
}
function anchorMatch(c: Candidate, works: any[]) {
  return c.papers.some(p=>works.some(w=>
    (p.url.startsWith("https://doi.org/") && w.doi?.toLowerCase()===p.url.toLowerCase()) ||
    normalizeTitle(p.title)===normalizeTitle(w.title || "")
  ));
}
const audit: any[]=[];
for (const c of (data.candidates as Candidate[]).filter(c=>!only || c.id===only).slice(0,limit)) {
  try {
    let authorId=c.citations?.openAlexId, matchEvidence=c.citations?.matchEvidence;
    let works: any;
    if (!authorId) {
      if (cachedOnly) throw Error("Author identity requires a fresh, verified publication match; ranking unavailable for now.");
      const query=aliases[c.id] || c.name;
      const authors=await get(`https://api.openalex.org/authors?search=${encodeURIComponent(query)}&per_page=5`,`${c.id}-authors`);
      const possible=(authors.results || []).filter((a:any)=>nameMatch(c,a) && institutionMatch(c,a));
      const matched: any[]=[];
      for (const a of possible) {
        const results=await get(`https://api.openalex.org/works?filter=author.id:${a.id.split("/").pop()}&sort=cited_by_count:desc&per_page=60`,`${c.id}-${a.id.split("/").pop()}-works`);
        if (anchorMatch(c,results.results || [])) matched.push({a,results});
      }
      if (matched.length !== 1) throw Error(`Author identity unresolved: ${matched.length} canonical-name/institution/publication matches`);
      authorId=matched[0].a.id; works=matched[0].results;
      matchEvidence=`Canonical name ${matched[0].a.display_name}, institutional history and at least one previously checked landmark publication matched. Alternative-name arrays were not used.`;
    }
    const queryUrl=`https://api.openalex.org/works?filter=author.id:${authorId!.split("/").pop()}&sort=cited_by_count:desc&per_page=60`;
    if (cachedOnly) {
      works=JSON.parse(fs.readFileSync(`research/raw/${c.id}-works.json`,"utf8"));
      const cachedAuthor=works.meta?.x_query?.oqo?.filter_rows?.[0];
      if (!JSON.stringify(cachedAuthor).includes(authorId!.split("/").pop()!)) throw Error("Cached query author could not be verified");
    } else works ||= await get(queryUrl,`${c.id}-${authorId!.split("/").pop()}-works`);
    const ranking=rankArticles(works.results || [], authorId!, {...exclusions.global, ...(exclusions[c.id] || {})});
    // If 60 high-citation records do not contain five articles, do not imply
    // that the author has fewer than five articles in their entire oeuvre.
    const recordsExamined=works.results?.length || 0;
    const value: ArticleRanking={status:ranking.articles.length ? "available":"unavailable", retrievedOn:cachedOnly ? c.citations!.retrieved : date, authorId,
      queryUrl:cachedOnly ? queryUrl.replace("per_page=60","per_page=8") : queryUrl, matchEvidence, recordsExamined,
      ...(ranking.articles.length<5 ? {reason:`${ranking.articles.length} distinct journal articles verified in the ${recordsExamined}-record window. More records need checking to complete five.`}:{}), articles:ranking.articles};
    c.mostCitedArticles=value;
    audit.push({id:c.id,...value,skipped:ranking.skipped});
    console.log(`${c.name}: ${ranking.articles.length} articles`);
  } catch (e) {
    if (String(e).includes("429")) throw Error("OpenAlex quota reached; resume from the immutable cache later.");
    c.mostCitedArticles={status:"unavailable",retrievedOn:date,reason:String(e).replace(/^Error: /,""),articles:[]};
    audit.push({id:c.id,...c.mostCitedArticles});
    console.log(`${c.name}: unavailable (${c.mostCitedArticles.reason})`);
  }
}
const staged=JSON.stringify(data,null,2)+"\n";
fs.writeFileSync(`${dir}/prepared-candidates.json`,staged);
fs.writeFileSync("research/article-ranking-audit.json",JSON.stringify({retrievedOn:date,source:"OpenAlex public API",scope:"Five highest-cited distinct journal article/review records; identified book reviews, paratext, corrections and retracted records excluded; versions are not summed.",inputSha256:crypto.createHash("sha256").update(original).digest("hex"),candidates:audit},null,2)+"\n");
console.log(`Prepared ${audit.length} rankings; preview only.`);
