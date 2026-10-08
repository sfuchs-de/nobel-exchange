import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { rankArticles } from "../shared/article-ranking";
const author="https://openalex.org/A123";
const work=(n:number,count:number,extra:any={})=>({id:`https://openalex.org/W${n}`,title:`Article ${n}`,publication_year:2000+n,type:"article",cited_by_count:count,authorships:[{author:{id:author}}],primary_location:{source:{type:"journal",display_name:"Econometrica"}},...extra});
describe("citation-ranked journal articles",()=>{
  it("sorts integer citation counts, selects at most five and does not mutate inputs",()=>{
    const raw=[work(1,10),work(2,30),work(3,20),work(4,60),work(5,40),work(6,50)];
    const before=JSON.stringify(raw), r=rankArticles(raw,author);
    expect(r.articles.map(x=>x.citations)).toEqual([60,50,40,30,20]);
    expect(JSON.stringify(raw)).toBe(before);
  });
  it("rejects wrong authors, books, book reviews, repository versions, retractions and unknown counts",()=>{
    const raw=[work(1,900),work(2,800,{authorships:[{author:{id:"https://openalex.org/A999"}}]}),work(3,700,{type:"book"}),work(4,600,{title:"Book Review: Monetary Economics"}),work(5,500,{primary_location:{source:{type:"repository"}}}),work(6,400,{is_retracted:true}),work(7,null),work(8,10)];
    expect(rankArticles(raw,author,{W1:"Identified book review"}).articles.map(x=>x.id)).toEqual(["https://openalex.org/W8"]);
  });
  it("keeps research surveys and never adds counts from duplicate titles or DOI records",()=>{
    const r=rankArticles([work(1,90,{title:"A Review of Monetary Policy",type:"review",doi:"https://doi.org/10.1/a"}),work(2,40,{title:"A Review of Monetary Policy"}),work(3,30,{doi:"https://doi.org/10.1/a"}),work(4,20)],author);
    expect(r.articles.map(x=>x.citations)).toEqual([90,20]);
  });
  it("normalizes publisher entities and unusual accents without changing scholarly titles",()=>{
    const r=rankArticles([work(1,90,{title:"International R&D spillovers"}),work(2,40,{title:"International R&amp;D spillovers"})],author);
    expect(r.articles).toHaveLength(1);
  });
  it("uses a journal location even when a repository is the primary location",()=>{
    const r=rankArticles([work(1,90,{primary_location:{source:{type:"repository"}},locations:[{source:{type:"journal",display_name:"Journal of Economic Literature"}}]})],author);
    expect(r.articles[0].venue).toBe("Journal of Economic Literature");
  });
  it("preserves unavailable metrics rather than fabricating article lists",()=>{
    const data=JSON.parse(fs.readFileSync("public/candidates.json","utf8"));
    for(const c of data.candidates){const r=c.mostCitedArticles;expect(r).toBeTruthy();
      if(r.status==="unavailable"){expect(r.articles).toEqual([]);expect(r.reason).toBeTruthy();}
      else {expect(r.articles.length).toBeGreaterThan(0);expect(r.articles.length).toBeLessThanOrEqual(5);
        expect(r.articles.map((a:any)=>a.citations)).toEqual([...r.articles].map((a:any)=>a.citations).sort((a:number,b:number)=>b-a));}
    }
  });
});
