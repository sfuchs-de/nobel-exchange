// Curated public-source checks made on 2026-10-08. No copied biographies.
// A current non-memorial institutional profile is evidence, not proof of vital status.
import fs from 'node:fs';
const checked: [string, string, string][] = [
 ['Israel M. Kirzner','https://www.beloit.edu/live/profiles/543-israel-kirzner','Beloit institutional profile identifies the NYU emeritus economist; the Global Award for Entrepreneurship Research separately supports identity and work.'],
 ['Richard Posner','https://www.law.uchicago.edu/faculty/posner-r','University of Chicago lists the retired judge as senior lecturer.'],
 ['Mark Granovetter','https://sociology.stanford.edu/people/mark-granovetter','Stanford emeritus profile identifies the social-networks scholar.'],
 ['Richard Blundell','https://ifs.org.uk/people/richard-blundell','IFS profile includes current research and a 2026 working paper.'],
 ['John A. List','https://news.uchicago.edu/profile/john-list','Chicago profile describes his field-experiment research.'],
 ['Charles F. Manski','https://economics.northwestern.edu/centers/center-for-econometrics/','Northwestern lists his 2025–26 research and 2026 award news.'],
 ['Olivier Blanchard','https://www.piie.com/newsroom/short-videos/2026/olivier-blanchard-how-eurobonds-could-secure-financing-europe','PIIE records his April 2026 presentation.'],
 ['Marc Melitz','https://www.economics.harvard.edu/people/marc-melitz','Harvard faculty profile identifies the international-trade scholar.'],
 ['Colin Camerer','https://directory.caltech.edu/personnel/camerer','Caltech directory identifies the behavioral-economics professor.'],
 ['George Loewenstein','https://www.cmu.edu/dietrich/sds/people/faculty/george-loewenstein.html','CMU faculty profile describes his economics and psychology appointment.'],
 ['Robert Hall','https://economics.stanford.edu/people/robert-hall','Stanford lists the economics professor emeritus.'],
 ['Stewart Myers','https://mitsloan.mit.edu/faculty/directory/stewart-myers','MIT Sloan emeritus finance profile lists research and publications.'],
 ['Raghuram Rajan','https://faculty.chicagobooth.edu/raghuram-rajan','Chicago Booth faculty profile identifies the finance scholar.'],
 ['Manuel Arellano','https://www.cemfi.es/~arellano/','CEMFI personal page lists his professorship and June 2026 research.'],
 ['Steve Bond','https://www.economics.ox.ac.uk/our-people','Oxford current directory lists Steve Bond as professor of economics.'],
 ['Wesley M. Cohen','https://provost.duke.edu/profile/wesley-m-cohen/','Duke profile identifies its innovation-economics scholar.'],
 ['W. Brian Arthur','https://santafe.edu/people/profile/w-brian-arthur','Santa Fe Institute profile identifies the increasing-returns scholar.'],
 ['Ariel Rubinstein','https://arielrubinstein.tau.ac.il/vitae.html','Author CV updated September 2026 identifies TAU and NYU affiliations.'],
 ['Søren Johansen','https://www.econ.ku.dk/ansatte/emeriti/','Copenhagen lists him among current emeriti, distinct from memorials.'],
 ['Katarina Juselius-Johansen','https://www.economics.ku.dk/staff/emeriti_kopi/?pure=en%2Fpersons%2Fkatarina-juselius%284e62a864-7bb5-49b8-a18a-f0dcc9f26dbd%29%2Fcv.html','Copenhagen uses the professional name Katarina Juselius for this emerita.'],
 ['David Dickey','https://statistics.sciences.ncsu.edu/people/dickey/','NC State identifies the emeritus time-series statistician.'],
 ['Wayne Fuller','https://www.econ.iastate.edu/people/wayne-fuller','Iowa State faculty profile; also interviewed by Statistics Canada in 2026.'],
 ['Pierre Perron','https://www.bu.edu/econ/profile/pierre-perron/','Boston University identifies the time-series econometrician.'],
 ['Steven T. Berry','https://economics.yale.edu/people/steven-berry','Yale identifies its Sterling Professor and empirical-IO scholar.'],
 ['James A. Levinsohn','https://som.yale.edu/faculty-research/faculty-directory/james-levinsohn','Yale faculty profile identifies the economics scholar.'],
 ['Ariél Pakes','https://www.economics.harvard.edu/people/ariel-pakes','Harvard uses Ariel Pakes; profile identifies IO and econometrics research.'],
 ['David B. Audretsch','https://www.spea.indiana.edu/faculty-research/directory/profiles/faculty/full-time/audretsch-david.html','Indiana current faculty profile identifies the entrepreneurship scholar.'],
 ['David Teece','https://haas.berkeley.edu/faculty/teece-david/','Berkeley profile identifies the innovation scholar and lists 2026 work.'],
 ['Carmen Reinhart','https://www.hks.harvard.edu/faculty/carmen-reinhart','Harvard Kennedy School profile identifies the financial-history scholar.'],
 ['Kenneth Rogoff','https://www.economics.harvard.edu/people/kenneth-rogoff','Harvard profile identifies the international-macroeconomics scholar.'],
 ['Samuel Bowles','https://www.santafe.edu/people/profile/sam-bowles/','Santa Fe Institute lists him among resident faculty.'],
 ['Richard Layard','https://www.lse.ac.uk/economics/people/visiting-and-emeritus-professors-and-academics','LSE lists the emeritus economics professor and wellbeing programme director.'],
 ['Andrew Oswald','https://warwick.ac.uk/fac/soc/economics/staff/ajoswald/','Warwick faculty profile identifies the happiness-economics scholar.'],
 ['Edward Glaeser','https://www.economics.harvard.edu/faculty?page=1','Harvard current faculty directory lists the urban economist.'],
 ['Thomas Piketty','https://www.parisschoolofeconomics.eu/en/personnes/thomas-piketty/','PSE profile identifies its chaired professor and inequality research.'],
 ['Emmanuel Saez','https://econ.berkeley.edu/profile/emmanuel-saez','Berkeley profile lists the tax-policy scholar and Fall 2026 teaching.'],
 ['Gabriel Zucman','https://econ.berkeley.edu/news','Berkeley reports his joint research with Saez in May 2026.'],
 ['Janet Currie','https://economics.yale.edu/people/janet-currie','Yale current profile identifies the child-health economist; award-time institution is separately labelled.'],
 ['Partha Dasgupta','https://www.joh.cam.ac.uk/research/academics/fellows/professor-sir-partha-dasgupta','St John’s Cambridge lists the emeritus economist.'],
 ['Paolo Mauro','https://www.imf.org/en/blogs/authors/paolo%20mauro','IMF author biography identifies the corruption-and-public-finance scholar.'],
 ['David Autor','https://clarivate.com/news/clarivate-unveils-citation-laureates-2025/','Official 2025 award release identifies the recipient and research area.'],
 ['Marianne Bertrand','https://clarivate.com/news/clarivate-unveils-citation-laureates-2025/','Official 2025 award release identifies the recipient and research area.'],
 ['Sendhil Mullainathan','https://clarivate.com/news/clarivate-unveils-citation-laureates-2025/','Official 2025 award release identifies the recipient and research area.'],
 ['Nicholas Bloom','https://clarivate.com/news/clarivate-unveils-citation-laureates-2025/','Official 2025 award release identifies the recipient and research area.'],
 ['Susan Athey','https://www.gsb.stanford.edu/faculty-research/faculty/susan-athey','Stanford profile lists current 2026–27 appointment and recent publications.'],
 ['Hal Varian','https://econ.berkeley.edu/profile/hal-varian','Berkeley economics faculty profile identifies the information-economics scholar.'],
 ['Michael Dean Woodford','https://econ.columbia.edu/category/news/','Columbia reports Woodford’s 2026 Clarivate Citation Laureate recognition.'],
 ['Sidney G. Winter','https://news.wharton.upenn.edu/faculty-accolades/2026/09/sidney-g-winter-named-2026-clarivate-citation-laureate/','Wharton identifies its emeritus professor in September 2026 award news.'],
];
const file='public/candidates.json';
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const audit=JSON.parse(fs.readFileSync('research/eligibility-audit.json','utf8'));
for(const [name,source,evidence] of checked){
 const candidate=data.candidates.find((c:any)=>c.name===name); if(!candidate)throw Error(name);
 const previous=audit.findIndex((a:any)=>a.id===candidate.id);
 const record={id:candidate.id,name,source,evidence,status:'primary source reviewed',retrieved:'2026-10-08',conclusion:'Identity supported by institutional or award source; no exclusion found in this check. Recheck immediately before opening.'};
 if(previous<0)audit.push(record);else audit[previous]=record;
 candidate.profileUrl=source;
 candidate.sources=candidate.sources.filter((s:any)=>s.label!=='Individual primary-source check');
 candidate.sources.push({label:'Individual primary-source check',url:source});
}
fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
fs.writeFileSync('research/eligibility-audit.json',JSON.stringify(audit,null,2)+'\n');
console.log(`Recorded ${checked.length} individually reviewed primary-source checks.`);
