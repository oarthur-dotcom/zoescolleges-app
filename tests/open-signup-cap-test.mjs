// Open sign-up with a daily cap + waitlist (Oct 26). Run: CHROME=/path/to/chrome node tests/open-signup-cap-test.mjs
import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const root = new URL('..', import.meta.url).pathname;
const srv = http.createServer((q,r)=>{ let p=decodeURIComponent(q.url.split('?')[0]); if(p==='/')p='/index.html'; const f=path.join(root,p);
  fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);return r.end();} r.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':f.endsWith('.json')?'application/json':'text/html'}); r.end(d);});}).listen(0);
const port = srv.address().port;
const STUB = `window.__calls=[]; window.__rpc=[]; window.__signupError=null; window.__rpcError=null;
window.supabase={createClient:()=>({auth:{
  getSession:async()=>({data:{session:null}}), onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
  signUp:async(a)=>{window.__calls.push(a.options&&a.options.data); return window.__signupError?{data:{},error:{message:window.__signupError}}:{data:{session:null,user:{}},error:null};},
  signInWithPassword:async()=>({error:null}), signOut:async()=>({}), resetPasswordForEmail:async()=>({}), updateUser:async()=>({})},
  from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:null}),single:async()=>({data:null})}),
  rpc:async(n,a)=>{ window.__rpc.push([n,a]); return {data:{ok:true},error:window.__rpcError?{message:'x'}:null}; }})};`;
const b = await chromium.launch({ executablePath: process.env.CHROME, args:['--no-sandbox'] });
const out = {}; let bad = 0; const ok=(n,c,extra)=>{ out[n]=!!c; if(!c){bad++; console.log('FAIL:',n,extra??'');} };
async function open(qs){
  const ctx=await b.newContext(); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.route(/supabase-js|supabase\.min\.js/, r=>r.fulfill({contentType:'text/javascript',body:STUB}));
  await p.route(/jsdelivr.*colleges\.json/, r=>r.fulfill({contentType:'application/json',body:'{"colleges":[]}'}));
  await p.goto(`http://127.0.0.1:${port}/index.html`+qs,{waitUntil:'networkidle'});
  await p.evaluate(()=>{ try{ setAuthMode('signup'); }catch(e){} });
  return {p,ctx,errs};
}
const sign = async (p, code) => { await p.fill('#email','t@example.org'); await p.fill('#pw','password123'); if(code) await p.fill('#accesscode',code); await p.click('#go-auth'); await p.waitForTimeout(350); };
const txt = async (p,s)=> (await p.textContent(s)).trim();
{ // A: no code -> goes to the server (not blocked in the browser)
  const {p,ctx,errs}=await open(''); ok('A_code_field_optional_label', /optional/i.test(await txt(p,'label[for=accesscode]')));
  await sign(p,''); const c=await p.evaluate(()=>window.__calls);
  ok('A_no_code_signup_sent', c.length===1 && c[0].access_code==='' , JSON.stringify(c)); ok('A_no_page_errors', errs.length===0, errs);
  ok('A_waitlist_hidden_on_success', await p.isHidden('#waitlist-wrap')); await ctx.close(); }
{ // B: server says no (cap) with no code -> waitlist shown, join works
  const {p,ctx}=await open(''); await p.evaluate(()=>window.__signupError='Database error saving new user'); await sign(p,'');
  ok('B_waitlist_shown_at_cap', await p.isVisible('#waitlist-wrap')); ok('B_no_bad_code_message', !/isn't right/.test(await txt(p,'#auth-msg')));
  await p.click('#go-waitlist'); await p.waitForTimeout(300); const rpc=await p.evaluate(()=>window.__rpc);
  ok('B_join_waitlist_called_with_email', rpc.length===1 && rpc[0][0]==='join_waitlist' && rpc[0][1].p_email==='t@example.org', JSON.stringify(rpc));
  ok('B_confirmation_shown', /on the waitlist/.test(await txt(p,'#auth-msg')) && await p.isHidden('#waitlist-wrap')); await ctx.close(); }
{ // C: wrong typed code -> code message, no waitlist
  const {p,ctx}=await open(''); await p.evaluate(()=>window.__signupError='Database error saving new user'); await sign(p,'WRONG');
  ok('C_bad_code_message', /invite code isn't right/.test(await txt(p,'#auth-msg'))); ok('C_no_waitlist_for_bad_code', await p.isHidden('#waitlist-wrap')); await ctx.close(); }
{ // D: waitlist with empty email asks for email, no rpc
  const {p,ctx}=await open(''); await p.evaluate(()=>window.__signupError='Database error saving new user'); await sign(p,''); await p.fill('#email','');
  await p.click('#go-waitlist'); await p.waitForTimeout(200);
  ok('D_needs_email', /Enter your email/.test(await txt(p,'#auth-msg')) && (await p.evaluate(()=>window.__rpc)).length===0); await ctx.close(); }
{ // E: waitlist failure shows a retry message
  const {p,ctx}=await open(''); await p.evaluate(()=>window.__signupError='Database error saving new user'); await sign(p,''); await p.evaluate(()=>window.__rpcError=true);
  await p.click('#go-waitlist'); await p.waitForTimeout(300); ok('E_rpc_failure_message', /try again/.test(await txt(p,'#auth-msg'))); await ctx.close(); }
{ // F: family invite + referral links still sign up with their code
  for (const [n,qs,key] of [['F_invite','?join=ab12cd34ef56','join_code'],['G_referral','?ref=9f8e7d6c','ref_code']]) {
    const {p,ctx}=await open(qs); if(qs.includes('join')) await p.evaluate(()=>applyJoinContext()); await sign(p,''); const c=await p.evaluate(()=>window.__calls);
    ok(n+'_code_sent', c.length===1 && !!c[0][key], JSON.stringify(c)); await ctx.close(); } }
{ // H: no "invite-only" wording left on the sign-up page; pricing wording intact
  const {p,ctx}=await open(''); const html=await p.content();
  ok('H_no_invite_only_copy', !/invite-only|needs an access code|beta access code/i.test(await p.evaluate(()=>document.getElementById('lp-account').textContent+document.getElementById('lp').textContent)));
  ok('H_free_for_beta_testers_kept', html.includes('Free for Beta Testers')); await ctx.close(); }
console.log(JSON.stringify(out,null,1)); console.log(bad?`${bad} FAILED`:'ALL PASS'); await b.close(); srv.close(); process.exit(bad?1:0);
