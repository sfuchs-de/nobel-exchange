// Human-reviewed selections from cached publication records. Never use a book review as the book.
import fs from 'node:fs';
const p='public/candidates.json',data=JSON.parse(fs.readFileSync(p,'utf8'));
const chosen:Record<string,string[]>={
 'avinash-dixit':['W2087076079','W2047212489'],
 'elhanan-helpman':['W2099167504','W3122837923'],
 'gene-grossman':['W2057675067','W2002007234'],
 'matthew-rabin':['W2100056252','W3022853033'],
 'richard-posner':['W2107431528','W1985079567'],
 'israel-m-kirzner':['W3022876346','W3124950409'],
 'richard-blundell':['W3121403162','W2081590363'],
 'john-a-list':['W4251446432','W2030360026'],
 'mark-gertler':['W1560350676','W3121935849'],
 'david-m-kreps':['W4248083116','W2128168853'],
 'hal-varian':['W1484133690','W2155419203'],
 'sidney-g-winter':['W2018514036','W2059813301'],
 'melissa-dell':['W3124568416','W2199160864'],
 'emi-nakamura':['W2082839717','W2052662085'],
 'david-b-audretsch':['W3124839039','W1992598870'],
 'jagdish-bhagwati':['W1991978947','W2028243237'],
 'anne-osborn-krueger':['W1486212401','W3121441566'],
 'ariel-rubinstein':['W2112374372','W2329310016'],
 'michael-dean-woodford':['W2189139855','W2127680685'],
 'parag-pathak':['W2162195070','W2128340555'],
 'partha-dasgupta':['W2165603404','W4248651010'],
 'richard-layard':['W2131115373','W1547350729']
};
for(const c of data.candidates){if(chosen[c.id]){const works=JSON.parse(fs.readFileSync(`research/raw/${c.id}-works.json`,'utf8')).results;c.papers=chosen[c.id].map(id=>{const w=works.find((x:any)=>x.id.endsWith('/'+id));if(!w)throw Error(id);return{title:w.title,url:w.doi||w.id,year:w.publication_year}});}
 // An OpenAlex author search containing a coauthor list was explicitly rejected.
 if(c.id==='amy-finkelstein'){
  c.citations=null;c.sources=c.sources.filter((s:any)=>s.label!=='OpenAlex author and works');
  c.papers=[{title:'The Oregon Health Insurance Experiment: Evidence from the First Year',year:2012,url:'https://economics.mit.edu/people/faculty/amy-finkelstein/papers-topic'},{title:'The Aggregate Effects of Health Insurance: Evidence from the Introduction of Medicare',year:2007,url:'https://economics.mit.edu/people/faculty/amy-finkelstein/publications'}];
  if(!c.sources.some((s:any)=>s.label==='MIT publication list'))c.sources.push({label:'MIT publication list',url:'https://economics.mit.edu/people/faculty/amy-finkelstein/publications'});
 }
 if(c.id==='jordi-gali'){
  const a=JSON.parse(fs.readFileSync('research/raw/jordi-gali-authors.json','utf8')).results.find((x:any)=>x.id==='https://openalex.org/A5076507287');
  const ws=JSON.parse(fs.readFileSync('research/raw/jordi-gali-works.json','utf8')).results.filter((w:any)=>w.authorships.some((u:any)=>u.author.id===a.id));
  c.papers=ws.slice(0,2).map((w:any)=>({title:w.title,year:w.publication_year,url:w.doi||w.id}));
  c.citations={total:a.cited_by_count,years:[],openAlexId:a.id,retrieved:'2026-10-08',matchEvidence:'Manual canonical-name check: Jordi Gaĺı is the OpenAlex spelling for Jordi Galí; Pompeu Fabra and Barcelona affiliations, and the selected coauthored monetary-policy works, match.'};
  if(!c.sources.some((s:any)=>s.label==='OpenAlex author and works'))c.sources.push({label:'OpenAlex author and works',url:a.id});
 }
 // The author-level annual bins do not reliably identify the year a citation arrived.
 // Use the two displayed works' citation-year records instead, explicitly labelled in the UI.
 if(c.citations){
  const ws=JSON.parse(fs.readFileSync(`research/raw/${c.id}-works.json`,'utf8')).results;
  for(const p of c.papers){if(p.url.startsWith('http:')){const w=ws.find((x:any)=>(x.doi||x.primary_location?.landing_page_url||x.id)===p.url);if(!w)throw Error('Unmatched link '+c.id);p.url=w.id;}}
  const selected=c.papers.map((p:any)=>ws.find((w:any)=>w.id===p.url||(w.doi||w.id)===p.url));
  c.citations.years=selected.every((w:any)=>w?.counts_by_year)?[2021,2022,2023,2024,2025].map(year=>({year,count:selected.reduce((s:number,w:any)=>s+(w.counts_by_year.find((y:any)=>y.year===year)?.cited_by_count||0),0)})):[];
  c.citations.trendScope='Selected works only; citations received in each year, summed across the two displayed publication records. Not the full author total.';
 }
}
data.status='Draft roster; 90 award-based entries. Individual-source verification and bibliographic review remain launch gates.';
data.launchReady=false;
fs.writeFileSync(p,JSON.stringify(data,null,2)+'\n');
console.log('Applied reviewed selections; Amy Finkelstein misattribution removed.');
