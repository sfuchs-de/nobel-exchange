// An independent publisher-deposited Crossref check on article identity.
// Citation counts remain the untouched OpenAlex values, never Crossref counts.
import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { normalizeTitle, rankArticles } from "../shared/article-ranking";
const date=JSON.parse(fs.readFileSync("research/article-ranking-audit.json","utf8")).retrievedOn;
if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error("Invalid prepared snapshot date");
const run=promisify(execFile), path=`research/raw/articles-${date}/prepared-candidates.json`;
const data=JSON.parse(fs.readFileSync(path,"utf8")), exclusions=JSON.parse(fs.readFileSync("research/article-exclusions.json","utf8"));
const cacheDir=`research/raw/article-crossref-${date}`; fs.mkdirSync(cacheDir,{recursive:true});
const audit:any[]=[];
let networkPaused=process.argv.includes("--offline");
async function metadata(doi:string) {
  const key=Buffer.from(doi).toString("hex"), cache=`${cacheDir}/${key}.json`, old=`research/raw/crossref-${key}.json`;
  if(fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache,"utf8")).message;
  if(fs.existsSync(old)) return JSON.parse(fs.readFileSync(old,"utf8")).message;
  for(const dir of fs.readdirSync("research/raw").filter(d=>/^article-crossref-\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse()) {
    const previous=`research/raw/${dir}/${key}.json`;
    if(fs.existsSync(previous))return JSON.parse(fs.readFileSync(previous,"utf8")).message;
  }
  if(networkPaused) throw Error("Independent metadata not cached; network refresh paused");
  await new Promise(r=>setTimeout(r,250));
  let result;
  try {result=await run("curl",["--fail","--silent","--show-error","--max-time","20","https://api.crossref.org/works/"+encodeURIComponent(doi)],{maxBuffer:4e6});}
  catch(e){if(String(e).includes("429")) networkPaused=true;throw e;}
  const response=JSON.parse(result.stdout); fs.writeFileSync(cache,JSON.stringify(response),{flag:"wx"}); return response.message;
}
const candidates=data.candidates.filter((c:any)=>c.mostCitedArticles?.status==="available");
let next=0;
async function worker() {
  while(next<candidates.length) {
    const c=candidates[next++], r=c.mostCitedArticles;
    const fresh=`research/raw/articles-${date}/${c.id}-${r.authorId.split("/").pop()}-works.json`;
    const raw=new URL(r.queryUrl).searchParams.get("per_page")==="60"
      ? JSON.parse(fs.readFileSync(fresh,"utf8")).response.results
      : JSON.parse(fs.readFileSync(`research/raw/${c.id}-works.json`,"utf8")).results;
    const allowed:any[]=[], checks:any[]=[];
    const surname=normalizeTitle(c.name.split(" ").at(-1));
    // Keep every candidate's data traceable, including rejected versions.
    for(const w of [...raw].sort((a:any,b:any)=>b.cited_by_count-a.cited_by_count)) {
      const selection=rankArticles([w],r.authorId,{...exclusions.global,...(exclusions[c.id]||{})});
      if(!selection.articles.length) continue;
      const article=selection.articles[0];
      if(!w.doi) { checks.push({id:w.id,title:w.title,status:"OpenAlex authorship only; no DOI metadata available"}); article.verification="openalex";allowed.push(article); }
      else try {
        const m=await metadata(w.doi.slice("https://doi.org/".length)), title=m.title?.[0] || "";
        const nt=normalizeTitle(title.replace(/<[^>]+>/g,"")), nw=normalizeTitle(w.title);
        const authorOK=(m.author || []).some((a:any)=>normalizeTitle(a.family || "")===surname);
        const titleOK=nt.length>12&&(nw===nt || nw.includes(nt) || nt.includes(nw));
        if(!authorOK || !titleOK || m.type!=="journal-article") { checks.push({id:w.id,title:w.title,status:"Rejected independent metadata mismatch",crossrefTitle:title,authorOK,type:m.type}); continue; }
        const year=(m["published-print"] || m.published || m.issued)?.["date-parts"]?.[0]?.[0];
        if(Number.isInteger(year)) article.year=year;
        // Bibliographic titles sometimes include publisher footnotes; remove
        // only this known marker, not substantive words.
        article.title=title.replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").replace(/1This paper has benefited[\s\S]*$/," ").replace(/\s*\*\s*$/," ").trim();
        article.venue=m["container-title"]?.[0] || article.venue;
        article.verification="crossref";
        checks.push({id:w.id,title:w.title,status:"Crossref author/title/type matched",crossrefTitle:title,year}); allowed.push(article);
      } catch(e) { checks.push({id:w.id,title:w.title,status:"OpenAlex authorship checked; independent metadata unavailable",error:String(e).slice(0,180)}); article.verification="openalex";allowed.push(article); }
      if(new Set(allowed.map(a=>normalizeTitle(a.title))).size>=5)break;
    }
    const seen=new Set<string>();r.articles=allowed.filter(a=>{const t=normalizeTitle(a.title);if(seen.has(t))return false;seen.add(t);return true}).slice(0,5);
    r.status=r.articles.length ? "available":"unavailable";
    r.reason=r.articles.length<5 ? `${r.articles.length} distinct journal articles verified in the ${raw.length}-record window. More records need checking to complete five.` : undefined;
    audit.push({id:c.id,checks,articles:r.articles}); console.log(`${c.name}: ${r.articles.length} checked articles`);
  }
}
await Promise.all([worker(),worker()]);
fs.writeFileSync(path,JSON.stringify(data,null,2)+"\n");
fs.writeFileSync("research/article-bibliography-audit.json",JSON.stringify(audit.sort((a,b)=>a.id.localeCompare(b.id)),null,2)+"\n");
if(process.argv.includes("--apply")) {
  const before=fs.readFileSync("public/candidates.json","utf8"),active=JSON.parse(before);
  if(active.launchReady)throw Error("Cannot alter a launch-ready roster without review");
  for(const c of data.candidates){const target=active.candidates.find((a:any)=>a.id===c.id);if(target.name!==c.name || target.eligible!==c.eligible)throw Error("Roster conflict");target.mostCitedArticles=c.mostCitedArticles;}
  if(fs.readFileSync("public/candidates.json","utf8")!==before)throw Error("Concurrent roster edit; no write made");
  fs.writeFileSync("public/candidates.json",JSON.stringify(active,null,2)+"\n");
}
