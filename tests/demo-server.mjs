// Disposable local-only browser-QA fixture. No real accounts or published winners.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const state=fs.mkdtempSync(path.join(os.tmpdir(),'nobel-browser-qa-'));
const children=[];
const run=(args,env={})=>{const p=spawn(process.execPath,args,{stdio:'inherit',env:{...process.env,...env}});children.push(p);return p;};
process.on('SIGTERM',()=>{children.forEach(p=>p.kill('SIGTERM'));process.exit(0)});
process.on('SIGINT',()=>{children.forEach(p=>p.kill('SIGTERM'));process.exit(0)});
run(['node_modules/wrangler/bin/wrangler.js','dev','--ip','127.0.0.1','--port','8798','--inspector-port','9298','--persist-to',state,'--var','DEV_AUTH:local-only','--var','ALLOWED_ORIGINS:http://127.0.0.1:4198'],{WRANGLER_SEND_METRICS:'false'});
for(let i=0;i<80;i++){try{const r=await fetch('http://127.0.0.1:8798/api/config');if(r.ok)break}catch{}await new Promise(r=>setTimeout(r,250));}
async function post(route,body,person='admin',method='POST'){
 const r=await fetch('http://127.0.0.1:8798/api'+route,{method,headers:{Origin:'http://127.0.0.1:4198',Authorization:'Bearer dev-'+person,'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!r.ok)throw Error(await r.text());return r.json();
}
await post('/admin/state',{phase:'open'});
for(const [person,name,allocation] of [
 ['alpha','Test · Invisible Hands',{'hal-varian':70,'susan-athey':30}],
 ['beta','Test · Pareto Pirates',{'hal-varian':70,'susan-athey':30}],
 ['gamma','Test · Team Endogenous',{'susan-athey':100}],
 ['delta','Test · Rational Exuberance',{'gabriel-zucman':100}],
])await post('/portfolio',{allocation,displayName:name,version:0,requestId:crypto.randomUUID()},person,'PUT');
run(['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4198','--strictPort'],{VITE_API_URL:'http://127.0.0.1:8798'});
console.log('Disposable browser QA: http://127.0.0.1:4198/nobel-exchange/');
