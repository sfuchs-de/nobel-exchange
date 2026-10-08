// Disposable runtime test. It uses local RSA/JWK fixtures, never Google accounts
// or the production market. No fixture credentials are printed or retained.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import {randomBytes,createHash} from "node:crypto";
import {generateKeyPair,exportJWK,SignJWT} from "jose";
const state=fs.mkdtempSync(path.join(os.tmpdir(),"nobel-auth-test-"));
const fixture=path.resolve("worker/.mobile-auth-fixture.ts");
const {privateKey,publicKey}=await generateKeyPair("RS256");
const jwk={...await exportJWK(publicKey),kid:"local-test",alg:"RS256",use:"sig"};
const jwks=http.createServer((req,res)=>{res.setHeader("Content-Type","application/json");res.setHeader("Cache-Control","max-age=300");res.end(JSON.stringify({keys:[jwk]}));});
await new Promise(r=>jwks.listen(0,"127.0.0.1",r));
const jwksUrl=`http://127.0.0.1:${jwks.address().port}/jwks`;
const codeValue=()=>randomBytes(32).toString("base64url");
const hash=v=>createHash("sha256").update(v).digest("base64url");
fs.writeFileSync(fixture,fs.readFileSync("worker/index.ts","utf8").replace("https://www.googleapis.com/oauth2/v3/certs",jwksUrl));
const config=path.join(state,"config.json");
fs.writeFileSync(config,JSON.stringify({...JSON.parse(fs.readFileSync("wrangler.jsonc","utf8")),main:fixture,vars:{
  ALLOWED_ORIGINS:"http://127.0.0.1:4196",GOOGLE_CLIENT_ID:"local-client",ADMIN_SUB:"local-owner",
  SESSION_SECRET:codeValue(),MARKET_CLOSE:"2026-10-12T00:00:00Z",ANNOUNCEMENT:"2026-10-12T09:45:00Z",
}}));
const base="http://127.0.0.1:8810",origin="http://127.0.0.1:4196";
let worker,logs="";const checks=[];
const check=(label,value)=>{assert.ok(value,label);checks.push(label);};
async function start(){
  worker=spawn(process.execPath,["node_modules/wrangler/bin/wrangler.js","dev","--config",config,"--ip","127.0.0.1","--port","8810","--inspector-port","9310","--persist-to",state],{stdio:["ignore","pipe","pipe"],env:{...process.env,WRANGLER_SEND_METRICS:"false"}});
  worker.stdout.on("data",d=>logs+=d);worker.stderr.on("data",d=>logs+=d);
  for(let i=0;i<100;i++){
    if(worker.exitCode!==null)throw Error("Auth runtime exited before starting.");
    try {if((await fetch(base+"/api/config")).ok)return;}catch{}
    await new Promise(r=>setTimeout(r,200));
  }throw Error("Auth runtime did not become ready.");
}
async function stop(){if(!worker||worker.exitCode!==null)return;const exited=new Promise(r=>worker.once("exit",r));worker.kill("SIGTERM");await exited;}
async function api(prefix,p,body,opts={}){
  return fetch(base+prefix+p,{method:body===undefined?"GET":"POST",headers:{Origin:origin,...(body?{"Content-Type":"application/json"}:{}),...opts.headers},...(body?{body:JSON.stringify(body)}:{}),redirect:"manual"});
}
async function begin(prefix){const verifier=codeValue();const r=await api(prefix,"/auth/redirect",{challenge:hash(verifier)});assert.equal(r.status,200);const f=await r.json();const page=await fetch(f.loginUrl);const html=await page.text();return {...f,verifier,html,nonce:html.match(/data-nonce="([^"]+)"/)[1],prefix};}
async function token(nonce,extra={}){
  return new SignJWT({nonce,given_name:"Test",name:"Test sign-in",...extra})
    .setProtectedHeader({alg:"RS256",kid:"local-test"}).setSubject("local-user")
    .setAudience(extra.aud || "local-client").setIssuer(extra.iss || "https://accounts.google.com").setIssuedAt().setExpirationTime(extra.exp ?? "5m").sign(privateKey);
}
async function callback(f,extra={},cookie="g_csrf_token=csrf",fields={}){
  const form=new URLSearchParams({credential:await token(f.nonce,extra),g_csrf_token:"csrf",flow_id:f.flowId,state:f.flowId,...fields});
  return fetch(base+f.prefix+"/auth/callback",{method:"POST",redirect:"manual",headers:{Origin:"https://accounts.google.com","Content-Type":"application/x-www-form-urlencoded",Cookie:cookie},body:form});
}
async function redeem(f,code,extra={}){return api(f.prefix,"/auth/redeem",{flowId:f.flowId,code,verifier:f.verifier,...extra});}
try{
  await start();
  const snapshots={};for(const prefix of ["/api","/api/public"])snapshots[prefix]=await (await api(prefix,"/market")).json();
  for(const prefix of ["/api","/api/public"]){
    const f=await begin(prefix);
    check(prefix+" full-page login has correct group and callback",f.html.includes(prefix+"/auth/callback")&&f.html.includes('data-ux_mode="redirect"'));
    check(prefix+" login page has no bearer credential",!f.html.includes("token:")&&!f.html.includes("session:"));
    check(prefix+" pending redeem rejected",(await redeem(f,codeValue())).status===401);
    check(prefix+" missing CSRF cookie rejected",(await callback(f,{},"")).status===403);
    check(prefix+" mismatched CSRF cookie rejected",(await callback(f,{},"g_csrf_token=wrong")).status===403);
    check(prefix+" wrong nonce rejected",(await callback(f,{nonce:codeValue()})).status===401);
    check(prefix+" wrong audience rejected",(await callback(f,{aud:"wrong"})).status===401);
    check(prefix+" expired Google credential rejected",(await callback(f,{exp:1})).status===401);
    const other={...f,prefix:prefix==="/api"?"/api/public":"/api"};
    check(prefix+" cross-group callback rejected",(await callback(other)).status===410);
    check(prefix+" foreign origin create rejected",(await api(prefix,"/auth/redirect",{challenge:hash(f.verifier)},{headers:{Origin:"https://untrusted.example"}})).status===403);
    const completed=await callback(f);
    check(prefix+" valid signed Google response redirects",completed.status===303);
    const target=new URL(completed.headers.get("Location"));const fragment=new URLSearchParams(target.hash.slice(1));const code=fragment.get("code");
    check(prefix+" exact group return and no bearer token in URL",target.origin===origin&&target.pathname===(prefix==="/api"?"/nobel-exchange/":"/nobel-exchange/public/")&&!completed.headers.get("Location").includes("eyJ"));
    check(prefix+" replayed callback rejected",(await callback(f)).status===410);
    check(prefix+" wrong verifier rejected",(await redeem(f,code,{verifier:codeValue()})).status===401);
    check(prefix+" wrong code rejected",(await redeem(f,codeValue())).status===401);
    check(prefix+" cross-group redemption rejected",(await redeem(other,code)).status===401);
    // Completed handoffs must survive a Worker restart, without replaying login.
    await stop();await start();
    const r=await redeem(f,code);const s=await r.json();
    check(prefix+" valid one-use handoff survives restart",r.status===200&&typeof s.token==="string"&&s.id==="local-user");
    const own=await api(prefix,"/me",undefined,{headers:{Authorization:"Bearer "+s.token}});
    check(prefix+" sign-in alone does not create a portfolio",own.status===200&&(await own.json()).entry===null);
    check(prefix+" repeated redemption rejected",(await redeem(f,code)).status===401);
    const concurrent=await begin(prefix);const callbackResults=await Promise.all([callback(concurrent),callback(concurrent)]);
    check(prefix+" concurrent callbacks allow exactly one handoff",callbackResults.filter(r=>r.status===303).length===1);
    const success=callbackResults.find(r=>r.status===303);const c=new URLSearchParams(new URL(success.headers.get("Location")).hash.slice(1)).get("code");
    const race=await Promise.all([redeem(concurrent,c),redeem(concurrent,c)]);
    check(prefix+" concurrent redemptions allow exactly one session",race.filter(r=>r.status===200).length===1);
    const after=await (await api(prefix,"/market")).json();
    delete after.serverTime;delete snapshots[prefix].serverTime;
    check(prefix+" complete auth path leaves pool, revision, entries and history unchanged",JSON.stringify(after)===JSON.stringify(snapshots[prefix]));
    const invalid=await fetch(base+prefix+"/auth/login?flow=unknown");
    check(prefix+" invalid/expired login returns useful HTML, not a blank page",invalid.status===410&&(await invalid.text()).includes("Return to the game"));
  }
  console.log(`${checks.length} isolated redirect sign-in integration checks passed. No production accounts or portfolios used.`);
}finally{
  await stop();await new Promise(r=>jwks.close(r));fs.rmSync(fixture,{force:true});fs.rmSync(state,{recursive:true,force:true});
}
