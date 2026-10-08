import fs from 'node:fs';
import type {Candidate} from '../shared/types';
const inventory=JSON.parse(fs.readFileSync('research/clarivate-inventory.json','utf8'));
const editorial=Object.fromEntries(fs.readFileSync('research/editorial.tsv','utf8').trim().split('\n').map(l=>{const[n,field,summary]=l.split('|');return[n,{field,summary}]}));
const extras=`Ludwig Straub|2026|Harvard University
Stefanie Stantcheva|2025|Harvard University
Philipp Strack|2024|Yale University
Oleg Itskhoki|2022|University of California, Los Angeles
Isaiah Andrews|2021|Harvard University
Melissa Dell|2020|Harvard University
Emi Nakamura|2019|University of California, Berkeley
Parag Pathak|2018|Massachusetts Institute of Technology
Dave Donaldson|2017|Massachusetts Institute of Technology
Yuliy Sannikov|2016|Princeton University
Roland Fryer|2015|Harvard University
Matthew Gentzkow|2014|University of Chicago
Amy Finkelstein|2012|Massachusetts Institute of Technology
Jonathan Levin|2011|Stanford University
Steven Levitt|2003|University of Chicago
Andrei Shleifer|1999|Harvard University
Lawrence H. Summers|1993|Harvard University
Sanford J. Grossman|1987|Princeton University`.split('\n').map(l=>{const[name,year,institution_at_award]=l.split('|');return{name,year,institution_at_award,profile:'https://www.aeaweb.org/about-aea/honors-awards/bates-clark',clark:true}});
const slug=(n:string)=>n.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'');
const candidates:Candidate[]=[...inventory.entries.filter((e:any)=>e.eligible),...extras].map((e:any)=>({id:slug(e.name),name:e.name,field:editorial[e.name]?.field||'Other',summary:editorial[e.name]?.summary||'',institution:e.institution_at_award,year:/^\d{4}$/.test(e.year)?Number(e.year):null,honors:[`${e.clark?'John Bates Clark Medal':'Clarivate Citation Laureate'} · ${e.year}`],papers:[],sources:[{label:e.clark?'AEA award record':'Clarivate archive',url:e.clark?e.profile:inventory.primaryArchive},{label:e.clark?'AEA biography':'Biographical cross-check',url:e.profile||inventory.index}],eligible:true,verifiedOn:'2026-10-08',profileUrl:e.profile||inventory.primaryArchive,citations:null}));
fs.mkdirSync('public',{recursive:true});
fs.writeFileSync('public/candidates.json',JSON.stringify({version:'economics-2026.1-draft',retrieved:'2026-10-08',status:'Review in progress',institutionNote:'Institutions are recorded at award recognition, not necessarily current appointments.',candidates},null,2)+'\n');
console.log(candidates.length+' candidates');
