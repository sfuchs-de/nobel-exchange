// Disposable Workers-runtime fixture. Never writes to a production market.
// Generated recovery/session credentials stay in memory and are not printed.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {randomBytes,createHash} from "node:crypto";
import {SignJWT} from "jose";
const state=fs.mkdtempSync(path.join(os.tmpdir(),"nobel-quick-test-"));
const secret=randomBytes(32), config=path.join(state,"config.json");
const roster=JSON.parse(fs.readFileSync("public/candidates.json","utf8"));
const [first,second]=roster.candidates.filter(c=>c.eligible).map(c=>c.id);
const ui=process.argv.includes("--ui");
const port=ui?8812:8811;
const base=`http://127.0.0.1:${port}`, origin=ui?"http://127.0.0.1:4198":"http://127.0.0.1:4196";
const signingSecret=secret.toString("base64url");
fs.writeFileSync(config,JSON.stringify({...JSON.parse(fs.readFileSync("wrangler.jsonc","utf8")),
  main:path.resolve("worker/index.ts"), vars:{ALLOWED_ORIGINS:origin,GOOGLE_CLIENT_ID:"local-client",
    ADMIN_SUB:"local-owner",SESSION_SECRET:signingSecret,MARKET_CLOSE:"2099-10-12T00:00:00Z",ANNOUNCEMENT:"2099-10-12T09:45:00Z"}}));
let worker;const checks=[];
const check=(label,value)=>{assert.ok(value,label);checks.push(label);};
async function start(){
  worker=spawn(process.execPath,["node_modules/wrangler/bin/wrangler.js","dev","--config",config,"--ip","127.0.0.1","--port",String(port),"--inspector-port",ui?"9312":"9311","--persist-to",state],
    {stdio:["ignore","pipe","pipe"],env:{...process.env,WRANGLER_SEND_METRICS:"false"}});
  worker.stdout.resume(); worker.stderr.resume();
  for(let i=0;i<100;i++){
    if(worker.exitCode!==null)throw Error("Quick-auth local runtime exited before ready.");
    try{if((await fetch(base+"/api/config")).ok &&
      (await fetch(base+"/api/me",{headers:{Origin:origin,Authorization:"Bearer "+await signed("local-owner")}})).ok)return;}catch{}
    await new Promise(r=>setTimeout(r,200));
  }throw Error("Quick-auth local runtime did not become ready.");
}
async function stop(){if(!worker||worker.exitCode!==null)return;const done=new Promise(r=>worker.once("exit",r));worker.kill("SIGTERM");await done;}
async function signed(sub,claims={}){return new SignJWT({name:"Local test",...claims}).setProtectedHeader({alg:"HS256"})
  .setSubject(sub).setIssuer("nobel-exchange").setAudience("nobel-exchange").setIssuedAt().setExpirationTime("1h")
  .sign(new TextEncoder().encode(signingSecret));}
async function api(prefix,p,body,token,method,extraHeaders={}){
  const r=await fetch(base+prefix+p,{method:method||(body===undefined?"GET":"POST"),headers:{Origin:origin,
    ...(body!==undefined?{"Content-Type":"application/json"}:{}),...(token?{Authorization:"Bearer "+token}:{}),...extraHeaders},
    ...(body!==undefined?{body:JSON.stringify(body)}:{})});
  return {status:r.status,body:await r.json(),headers:r.headers};
}
const clean=s=>{const c=structuredClone(s);delete c.serverTime;return c;};
try{
  await start();const admin=await signed("local-owner"), google=await signed("existing-google");
  check("Original can be opened by the existing Google administrator",(await api("/api","/admin/state",{phase:"open",reason:"Disposable test"},admin)).status===200);
  if(ui){
    console.log("Disposable UI backend ready on loopback port 8812. No live records or credentials printed.");
    await new Promise(resolve=>{process.once("SIGTERM",resolve);process.once("SIGINT",resolve);});
  }else{
  const existing=(await api("/api","/portfolio",{allocation:{[first]:100},displayName:"Existing Google",version:0,requestId:crypto.randomUUID()},google,"PUT")).body.entry;
  check("Existing Google portfolio accepted before quick registration",existing.version===1);
  const snapshots={}, accounts={};
  for(const prefix of ["/api","/api/public"]){
    snapshots[prefix]=clean((await api(prefix,"/market")).body);
    check(prefix+" both sign-in methods configured",(await api(prefix,"/config")).body.quickAuthReady&&(await api(prefix,"/config")).body.authReady);
    check(prefix+" invalid public name rejected",(await api(prefix,"/auth/quick/register",{displayName:"<bad>"})).status===400);
    check(prefix+" foreign-origin join rejected",(await api(prefix,"/auth/quick/register",{displayName:"No"},null,null,{Origin:"https://untrusted.example"})).status===403);
    check(prefix+" registration GET rejected",(await api(prefix,"/auth/quick/register")).status===404);
    const joined=await api(prefix,"/auth/quick/register",{displayName:"  Same   nickname ",admin:true,subject:"local-owner"});
    const q=joined.body;accounts[prefix]=q;
    check(prefix+" quick account normalized and never administrator",joined.status===200&&q.session.displayName==="Same nickname"&&q.session.admin===false&&q.session.id.startsWith("quick:"));
    check(prefix+" full-strength code scoped to group",new RegExp(prefix==="/api"?"^NX-O\\.[A-Za-z0-9_-]{43}$":"^NX-P\\.[A-Za-z0-9_-]{43}$").test(q.recoveryCode));
    check(prefix+" credentials are no-store responses",joined.headers.get("Cache-Control")==="no-store");
    check(prefix+" signup does not enroll or change market",JSON.stringify(clean((await api(prefix,"/market")).body))===JSON.stringify(snapshots[prefix]));
    check(prefix+" newly signed-in own entry empty",(await api(prefix,"/me",undefined,q.session.token)).body.entry===null);
    check(prefix+" quick admin routes denied",(await api(prefix,"/admin/export",undefined,q.session.token)).status===403);
    check(prefix+" malformed recovery rejected",(await api(prefix,"/auth/quick/recover",{recoveryCode:"bad"})).status===401);
    const fabricated=(prefix==="/api"?"NX-O.":"NX-P.")+randomBytes(32).toString("base64url");
    check(prefix+" unknown full-strength code rejected",(await api(prefix,"/auth/quick/recover",{recoveryCode:fabricated})).status===401);
    const back=await api(prefix,"/auth/quick/recover",{recoveryCode:"  "+q.recoveryCode+"  "});
    check(prefix+" recovery returns same account, not another",back.status===200&&back.body.session.id===q.session.id);
    check(prefix+" repeated recovery does not change market",JSON.stringify(clean((await api(prefix,"/market")).body))===JSON.stringify(snapshots[prefix]));
    check(prefix+" wrong-market bearer rejected",(await api(prefix==="/api"?"/api/public":"/api","/me",undefined,q.session.token)).status===401);
    check(prefix+" wrong-market recovery rejected",(await api(prefix==="/api"?"/api/public":"/api","/auth/quick/recover",{recoveryCode:q.recoveryCode})).status===401);
    const rewrite=q.recoveryCode.replace(prefix==="/api"?"NX-O.":"NX-P.",prefix==="/api"?"NX-P.":"NX-O.");
    check(prefix+" changing code prefix cannot cross markets",(await api(prefix==="/api"?"/api/public":"/api","/auth/quick/recover",{recoveryCode:rewrite})).status===401);
    check(prefix+" 99 credits rejected",(await api(prefix,"/portfolio",{allocation:{[second]:99},displayName:"Quick player",version:0,requestId:crypto.randomUUID()},q.session.token,"PUT")).status===400);
    const payload={allocation:{[second]:100},displayName:"Quick player",version:0,requestId:crypto.randomUUID()};
    const saved=await api(prefix,"/portfolio",payload,q.session.token,"PUT");q.entry=saved.body.entry;
    check(prefix+" valid quick portfolio gets one saved entry",saved.status===200&&q.entry.version===1);
    const again=await api(prefix,"/portfolio",payload,q.session.token,"PUT");
    check(prefix+" exact save retry has same ID/version",again.status===200&&JSON.stringify(again.body.entry)===JSON.stringify(q.entry));
    check(prefix+" old version cannot duplicate entry",(await api(prefix,"/portfolio",{...payload,requestId:crypto.randomUUID()},q.session.token,"PUT")).status===409);
    const after=(await api(prefix,"/market")).body;
    check(prefix+" pool increases by exactly 100 only at save",after.pool===snapshots[prefix].pool+100&&after.participants===snapshots[prefix].participants+1);
    check(prefix+" no code/hash/private account identifiers in public feed",![q.recoveryCode,q.session.id,createHash("sha256").update(q.recoveryCode).digest("base64url")].some(v=>JSON.stringify(after).includes(v)));
    check(prefix+" recovered account retrieves saved version",(await api(prefix,"/me",undefined,back.body.session.token)).body.entry.id===q.entry.id);
    const exported=await api(prefix,"/admin/export",undefined,admin);
    check(prefix+" admin export has no code or recovery verifier",![q.recoveryCode,createHash("sha256").update(q.recoveryCode).digest("base64url")].some(v=>JSON.stringify(exported.body).includes(v)));
  }
  check("Both quick accounts and public entry IDs remain independent",accounts["/api"].session.id!==accounts["/api/public"].session.id&&accounts["/api"].entry.id!==accounts["/api/public"].entry.id);
  check("Existing Google entry unchanged",JSON.stringify((await api("/api","/me",undefined,google)).body.entry)===JSON.stringify(existing));
  const quick=accounts["/api/public"];
  await new Promise(r=>setTimeout(r,650));
  const edits=await Promise.all([40,60].map(n=>api("/api/public","/portfolio",{allocation:{[first]:n,[second]:100-n},displayName:"Quick player",version:1,requestId:crypto.randomUUID()},quick.session.token,"PUT")));
  check("Concurrent guest edits accept exactly one version",edits.filter(r=>r.status===200).length===1&&edits.filter(r=>r.status===409).length===1);
  const version2=(await api("/api/public","/me",undefined,quick.session.token)).body.entry;
  check("Concurrent edit leaves exactly 100 credits",Object.values(version2.allocation).reduce((a,b)=>a+b,0)===100&&version2.version===2);
  const publicSnapshot=clean((await api("/api/public","/market")).body);
  const deceptive=await signed(quick.session.id,{name:"Forged role",authMethod:"quick",marketId:"public",admin:true});
  check("Guest claim cannot elevate admin privileges",(await api("/api/public","/admin/export",undefined,deceptive)).status===403);
  const stripped=await signed(quick.session.id);
  check("Guest identity requires quick market claim",(await api("/api/public","/me",undefined,stripped)).status===401);
  await stop();await start();
  for(const prefix of ["/api","/api/public"]){
    const back=await api(prefix,"/auth/quick/recover",{recoveryCode:accounts[prefix].recoveryCode});
    check(prefix+" private recovery survives restart",back.status===200&&back.body.session.id===accounts[prefix].session.id);
    check(prefix+" saved entry survives restart",(await api(prefix,"/me",undefined,back.body.session.token)).body.entry.id===accounts[prefix].entry.id);
  }
  check("Public market completely unchanged after recovery/restart",JSON.stringify(clean((await api("/api/public","/market")).body))===JSON.stringify(publicSnapshot));
  // Throttles are persistent and local to the group. Never load-test production.
  const joins=await Promise.all(Array.from({length:30},()=>api("/api/public","/auth/quick/register",{displayName:"Disposable account"})));
  check("Concurrent registration throttled without touching pool",joins.some(r=>r.status===429)&&JSON.stringify(clean((await api("/api/public","/market")).body))===JSON.stringify(publicSnapshot));
  check("Other market registration unaffected by public throttle",(await api("/api","/auth/quick/register",{displayName:"Independent test"})).status===200);
  const invalids=await Promise.all(Array.from({length:90},()=>api("/api/public","/auth/quick/recover",{recoveryCode:"bad"})));
  check("Bad-code guessing is throttled",invalids.some(r=>r.status===429));
  await stop();await start();
  check("Attempt limits survive restart",(await api("/api/public","/auth/quick/register",{displayName:"Disposable"})).status===429);
  check("Original recovery not blocked by public throttle",(await api("/api","/auth/quick/recover",{recoveryCode:accounts["/api"].recoveryCode})).status===200);
  check("Closing original market succeeds",(await api("/api","/admin/state",{phase:"closed",reason:"Disposable close"},admin)).status===200);
  check("No fresh quick accounts after closing",(await api("/api","/auth/quick/register",{displayName:"Late arrival"})).status===403);
  const afterClose=await api("/api","/auth/quick/recover",{recoveryCode:accounts["/api"].recoveryCode});
  check("Existing quick account can recover after closing",afterClose.status===200);
  check("Recovered account cannot edit locked picks",(await api("/api","/portfolio",{allocation:{[first]:100},displayName:"Late change",version:1,requestId:crypto.randomUUID()},afterClose.body.session.token,"PUT")).status===409);
  const closed=(await api("/api","/market")).body;
  check("Final public portfolios use random public IDs, never recovery identities",closed.entries.length===2&&!JSON.stringify(closed).includes("quick:")&&!JSON.stringify(closed).includes(accounts["/api"].recoveryCode));
  console.log(`${checks.length} isolated quick-join runtime checks passed. No production accounts, tokens or records used.`);
  }
} finally {await stop();fs.rmSync(state,{recursive:true,force:true});}
