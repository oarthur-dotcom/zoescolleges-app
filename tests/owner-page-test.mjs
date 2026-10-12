import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs';
const SITE='/tmp/claude-0/fown/site'; const FAKE=fs.readFileSync('/tmp/claude-0/audit-ui/fake-supabase.js','utf8');
const srv=http.createServer((q,r)=>{ fs.readFile(SITE+q.url.split('?')[0],(e,d)=>{ if(e){r.writeHead(404);return r.end();} r.writeHead(200,{'Content-Type':'text/html'}); r.end(d); }); }).listen(8841);
const OV={me:'oarthur@gmail.com',generated_at:new Date().toISOString(),totals:{families:2,accounts:4,active:3,signedInLast7:2,byPlan:{free:0,family:1,family_plus:1}},
 families:[{id:'11111111-1111-1111-1111-111111111111',name:'The Arthur Clan',plan:'family_plus',invite_code:'a1b2c3',created_at:'2026-10-11',schools:9,visits:2,photos:9,pendingStudent:'Zoe',members:[{user_id:'u1',display_name:'Obie',role:'parent',email:'oarthur@gmail.com'},{user_id:'u2',display_name:'Usha',role:'parent',email:'usha@example.com'}]},
  {id:'22222222-2222-2222-2222-222222222222',name:'Test Family',plan:'family',invite_code:'zz9',created_at:'2026-10-12',schools:3,visits:0,photos:0,pendingStudent:null,members:[{user_id:'u3',display_name:'Pat',role:'parent',email:'pat@example.com'}]}],
 accounts:[{id:'u1',email:'oarthur@gmail.com',active:true,last_sign_in_at:new Date().toISOString(),family_id:'1'},{id:'u2',email:'usha@example.com',active:true,last_sign_in_at:null,family_id:'1'},{id:'u3',email:'pat@example.com',active:false,family_id:'2'},{id:'u4',email:'loose@example.com',active:true,created_at:'2026-10-12',family_id:null}]};
const b=await chromium.launch({args:['--no-sandbox'],executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'}); const out={};
for(const [label,vp,dark] of [['phone',{width:390,height:844}],['desktop',{width:1280,height:900}],['desktop-dark',{width:1280,height:900},true]]){
 const ctx=await b.newContext({viewport:vp}); const page=await ctx.newPage(); if(dark) await page.emulateMedia({colorScheme:'dark'}); const errs=[]; page.on('pageerror',e=>errs.push(e.message));
 await page.route('**/supabase.min.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:FAKE}));
 const posts=[]; await page.route('**/.netlify/functions/owner-admin',r=>{ const p=JSON.parse(r.request().postData()); posts.push(p); r.fulfill({contentType:'application/json',body:JSON.stringify(p.action==='overview'?OV:{ok:true})}); });
 await page.addInitScript(()=>{ window.confirm=()=>true; });
 await page.goto('http://localhost:8841/owner.html'); await page.waitForTimeout(1500);
 const o={}; o.tiles=await page.$$eval('.tile',x=>x.length); o.cards=await page.$$eval('.card',x=>x.length); o.who=await page.textContent('#who');
 o.overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
 await page.screenshot({path:`/tmp/claude-0/fown/${label}.png`,fullPage:true});
 await page.selectOption('[data-plan="22222222-2222-2222-2222-222222222222"]','free'); await page.waitForTimeout(500);
 await page.click('[data-act="u3"]'); await page.waitForTimeout(500);
 await page.fill('#q','pat'); await page.waitForTimeout(200); o.filtered=await page.$$eval('.fam-h b',x=>x.map(e=>e.textContent));
 o.posts=posts.map(p=>p.action+(p.plan?':'+p.plan:'')+(p.active!==undefined?':'+p.active:'')); o.errs=errs; out[label]=o; await ctx.close(); }
await b.close(); srv.close(); console.log(JSON.stringify(out,null,1));
