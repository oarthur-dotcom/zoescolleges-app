import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const root='/tmp/claude-0/f2/site';
const srv=http.createServer((q,r)=>{const f=path.join(root,decodeURIComponent(q.url.split('?')[0])==='/'?'index.html':decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);return r.end();} r.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':'text/html'}); r.end(d);});}).listen(8771);
const STUB = `window.__calls=[]; window.__signupError=null;
window.supabase={createClient:()=>({auth:{
  getSession:async()=>({data:{session:null}}), onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
  signUp:async(a)=>{window.__calls.push(a); return window.__signupError?{data:{},error:{message:window.__signupError}}:{data:{session:null,user:{}},error:null};},
  signInWithPassword:async()=>({error:null}), signOut:async()=>({}), resetPasswordForEmail:async()=>({}), updateUser:async()=>({})},
  from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:null}),single:async()=>({data:null})}), rpc:async()=>({data:null})})};`;
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',headless:false,args:['--no-sandbox','--headless=new']});
const out={};
async function run(name, qs, code, err){
  const ctx=await b.newContext(); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.route(/supabase-js|supabase\.min\.js/, r=>r.fulfill({contentType:'text/javascript',body:STUB}));
  await p.route(/jsdelivr.*colleges\.json/, r=>r.fulfill({contentType:'application/json',body:'{"colleges":[]}'}));
  await p.goto('http://localhost:8771/index.html'+qs,{waitUntil:'networkidle'});
  if(err) await p.evaluate(e=>window.__signupError=e, err);
  await p.evaluate(()=>{ try{ setAuthMode('signup'); }catch(e){} });
  if(qs.includes('join')) await p.evaluate(()=>applyJoinContext());
  const codeVisible = await p.isVisible('#accesscode');
  await p.fill('#email','t@example.org'); await p.fill('#pw','password123');
  if(code!==null && codeVisible) await p.fill('#accesscode',code);
  await p.click('#go-auth'); await p.waitForTimeout(400);
  out[name]={ codeFieldVisible:codeVisible, sentToServer: await p.evaluate(()=>window.__calls.map(c=>c.options&&c.options.data)), message: (await p.textContent('#auth-msg')).trim().slice(0,110), pageErrors:errs,
    sourceHasOldCode: (await p.content()).includes('ZOE2027') };
  await ctx.close();
}
await run('A_typed_code','',"newcode26",null);
await run('B_no_code','', '',null);
await run('C_invite_link','?join=ab12cd34ef56','',null);
await run('D_referral_link','?ref=9f8e7d6c','',null);
await run('E_server_rejects','', 'WRONG','Database error saving new user');
console.log(JSON.stringify(out,null,1)); await b.close(); srv.close();
