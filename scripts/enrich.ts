import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import type {Candidate} from '../shared/types';
const path='public/candidates.json';const data=JSON.parse(fs.readFileSync(path,'utf8'));const raw='research/raw';fs.mkdirSync(raw,{recursive:true});
const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ı/g,'i').replace(/ø/g,'o').replace(/[^a-z ]/g,'').replace(/\s+/g,' ').trim();
async function get(url:string,key:string):Promise<any>{const p=`${raw}/${key}.json`;if(fs.existsSync(p))return JSON.parse(fs.readFileSync(p,'utf8'));await new Promise(r=>setTimeout(r,180));const result=execFileSync('curl',['--fail','--silent','--show-error','--max-time','35',url],{encoding:'utf8',maxBuffer:8e6});const json=JSON.parse(result);fs.writeFileSync(p,JSON.stringify(json));return json;}
const aliases:Record<string,string>={'m-hashem-pesaran':'Hashem Pesaran','michael-dean-woodford':'Michael Woodford','katarina-juselius-johansen':'Katarina Juselius','david-forbes-hendry':'David Hendry','james-a-levinsohn':'James Levinsohn','jerry-a-hausman':'Jerry Hausman','anne-osborn-krueger':'Anne Krueger','steve-bond':'Stephen Bond'};
const audit:any[]=[];
for(const c of data.candidates as Candidate[]){try{
 const search=aliases[c.id]||c.name;const found=await get(`https://api.openalex.org/authors?search=${encodeURIComponent(search)}&per-page=5`,`${c.id}-authors`);
 const wanted=norm(search).split(' ').filter(s=>s.length>1);const ranked=(found.results||[]).map((a:any)=>{
  // Canonical name only: alternative-name arrays sometimes contain whole coauthor lists.
  const names=[a.display_name].map(norm);
  const nameOK=names.some((n:string)=>wanted.every(p=>n.split(' ').includes(p)));
  const institutions=[...a.last_known_institutions||[],...(a.affiliations||[]).map((x:any)=>x.institution)].map((i:any)=>i.display_name).filter(Boolean);
  const relevant=institutions.some((n:string)=>norm(c.institution).includes(norm(n))||norm(n).includes(norm(c.institution))||norm(n).split(' ').filter(s=>s.length>4&&!['university','institute','school','college','technology'].includes(s)).some(s=>norm(c.institution).includes(s)));
  return {a,nameOK,relevant,institutions};
 }).filter((x:any)=>x.nameOK&&x.relevant).sort((a:any,b:any)=>b.a.cited_by_count-a.a.cited_by_count);
 if(!ranked.length){c.citations=null;c.papers=[];audit.push({id:c.id,status:'unresolved',options:found.results?.map((a:any)=>({id:a.id,name:a.display_name,institutions:a.last_known_institutions}))});continue;}
 const {a,institutions}=ranked[0];
 const works=await get(`https://api.openalex.org/works?filter=author.id:${a.id.split('/').pop()}&sort=cited_by_count:desc&per-page=8`,`${c.id==='amy-finkelstein'?c.id+'-corrected':c.id}-works`);
 const selected:any[]=[];for(const w of works.results||[]){if(!w.authorships?.some((au:any)=>au.author.id===a.id))continue;if(/book.review|review.of/i.test(w.type+' '+w.title))continue;if(selected.some(x=>norm(x.title)===norm(w.title)))continue;selected.push(w);if(selected.length===2)break;}
 if(selected.length<2){audit.push({id:c.id,status:'insufficient works',author:a.id});continue;}
 c.citations={total:a.cited_by_count,years:[],trendScope:'Selected works only; not the full author history. Run curate.ts and bibliographic review before publication.',openAlexId:a.id,retrieved:'2026-10-08',matchEvidence:`Canonical name matched to ${a.display_name}; institutional history includes ${institutions.filter((n:string)=>norm(c.institution).includes(norm(n))||norm(n).includes(norm(c.institution))).join('; ')||c.institution}. Selected work authorship checked. OpenAlex metadata can contain attribution errors.`};
 c.papers=selected.map(w=>({title:w.title,url:w.doi||w.primary_location?.landing_page_url||w.id,year:w.publication_year}));
 c.sources=c.sources.filter(s=>s.label!=='OpenAlex author and works');c.sources.push({label:'OpenAlex author and works',url:a.id});
 audit.push({id:c.id,status:'matched',author:a.id,name:a.display_name,institutions,works:c.papers});
 console.log(c.name+' — matched; '+c.papers.map(p=>p.title).join(' / '));
 }catch(e){c.citations=null;c.papers=[];audit.push({id:c.id,status:'error',message:String(e)});console.log(c.name+' — unavailable');}
 fs.writeFileSync(path,JSON.stringify(data,null,2)+'\n');fs.writeFileSync('research/author-match-audit.json',JSON.stringify(audit,null,2)+'\n');
}
console.log('Enrichment finished:',audit.filter(a=>a.status==='matched').length,'matched');
