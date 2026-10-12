import { launch } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE='/tmp/claude-0/tour/site', CAT=fs.readFileSync('/tmp/claude-0/f35-colleges.json'), VL=fs.readFileSync('/home/claude/zoescolleges-data/visit-links.json');
const FAKE=fs.readFileSync('/tmp/claude-0/audit-ui/fake-supabase.js','utf8');
const srv=http.createServer((q,r)=>{const f=path.join(SITE,decodeURIComponent(q.url.split('?')[0])); fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end();} r.writeHead(200,{'Content-Type': f.endsWith('.webp')?'image/webp':f.endsWith('.html')?'text/html':f.endsWith('.jpg')?'image/jpeg':'application/octet-stream'}); r.end(d);});}).listen(8872);
import { chromium } from 'playwright';
const b=await chromium.launch({headless:true,args:['--no-sandbox'],executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'});
const ctx=await b.newContext({viewport:{width:1280,height:720}, deviceScaleFactor:1});
const page=await ctx.newPage();
fs.rmSync('/tmp/claude-0/tour/sc',{recursive:true,force:true}); fs.mkdirSync('/tmp/claude-0/tour/sc');
const cdp=await ctx.newCDPSession(page); const shots=[]; let n=0;
cdp.on('Page.screencastFrame', async f=>{ const fn=`/tmp/claude-0/tour/sc/${String(n++).padStart(5,'0')}.jpg`; fs.writeFileSync(fn,Buffer.from(f.data,'base64')); shots.push([fn,f.metadata.timestamp]); try{ await cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId}); }catch(e){} });
await cdp.send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:1280,maxHeight:720,everyNthFrame:1});
await page.addInitScript(`window.__PLAN="family"; window.__SIGNEDOUT=true; window.__EMPTY=false;`);
await page.route('**/supabase.min.js', r=>r.fulfill({status:200, contentType:'application/javascript', body:FAKE}));
await page.route(/jsdelivr.*colleges\.json/, r=>r.fulfill({contentType:'application/json',body:CAT})); await page.route(/jsdelivr.*visit-links\.json/, r=>r.fulfill({contentType:'application/json',body:VL}));
await page.route(/tile\.openstreetmap|router\.project-osrm|\.netlify\/functions/, r=>r.abort());
const W=ms=>page.waitForTimeout(ms);
const style=`#tour-cap{position:fixed;left:50%;bottom:40px;transform:translateX(-50%);max-width:980px;width:max-content;background:rgba(11,20,36,.88);color:#fff;font:700 27px/1.3 "Bricolage Grotesque",system-ui,sans-serif;padding:16px 26px;border-radius:18px;z-index:99999;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.35);transition:opacity .35s;letter-spacing:-.01em}
#tour-cap small{display:block;font-weight:500;font-size:17px;opacity:.85;margin-top:4px}
#tour-card{position:fixed;inset:0;z-index:99998;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0b7f81;color:#fff;font-family:"Bricolage Grotesque",system-ui,sans-serif;transition:opacity .5s}
#tour-card h1{font-size:64px;margin:0;letter-spacing:-.03em}#tour-card p{font-size:26px;margin:10px 0 0;opacity:.92}
.tour-spot{outline:4px solid #f5b83d!important;outline-offset:4px;border-radius:14px;transition:outline-color .3s}
#demo-bar,#demo-toast,#zoe-fab,.fab{display:none!important}`;
const prep=async()=>{ await page.addStyleTag({content:style}); };
const cap=async(t,s)=>page.evaluate(([t,s])=>{ let c=document.getElementById('tour-cap'); if(!c){ c=document.createElement('div'); c.id='tour-cap'; document.body.appendChild(c); } c.style.opacity=0; setTimeout(()=>{ c.innerHTML=t+(s?`<small>${s}</small>`:''); c.style.opacity=1; },180); },[t,s||'']);
const card=async(h,p)=>page.evaluate(([h,p])=>{ let c=document.getElementById('tour-card'); if(!c){ c=document.createElement('div'); c.id='tour-card'; document.body.appendChild(c); } c.style.opacity=1; c.innerHTML=`<h1>${h}</h1><p>${p}</p>`; },[h,p]);
const hide=async()=>{ await page.evaluate(()=>{ const c=document.getElementById('tour-cap'); if(c) c.style.opacity=0; }); await page.waitForTimeout(250); };
const uncard=async()=>page.evaluate(()=>{ const c=document.getElementById('tour-card'); if(c){ c.style.opacity=0; setTimeout(()=>c.remove(),600); } });
const spot=async sel=>page.evaluate(sel=>{ document.querySelectorAll('.tour-spot').forEach(e=>e.classList.remove('tour-spot')); const e=sel&&document.querySelector(sel); if(e){ e.classList.add('tour-spot'); e.scrollIntoView({behavior:'smooth',block:'center'}); } },sel);
await hide(); await page.goto('http://localhost:8872/index.html'); await W(2500); await prep();
await card("Zoe's Colleges","A one-minute tour"); await W(2000); await uncard(); await W(500);
await cap("One calm place for your family's college search"); await W(2500);
await hide(); await page.evaluate(()=>startDemo()); await W(2500); await prep();
await page.evaluate(()=>{ try{ localStorage.setItem('zc_guide_seen','1'); }catch(e){} goto('today'); }); await W(700);
await spot('#td-student .ns-card'); await cap("Today shows your one next step","…and how far along your family is"); await W(4300);
await hide(); await spot(null); await page.evaluate(()=>gotoGroup('schools')); await W(900);
await spot('#schools .school'); await cap("Every school on one board","Your real cost, your chance, and everyone's stars"); await W(3000);
await page.evaluate(()=>window.scrollBy({top:420,behavior:'smooth'})); await W(1600);
await hide(); await spot(null); await page.evaluate(()=>{ window.scrollTo(0,0); goto('discover'); }); await W(1200);
await cap("Discover schools with a swipe","When two of you like the same one, it's a match"); await W(1800);
const box=await page.locator('.disc-stage > .disc-card').boundingBox(); if(box){ await page.mouse.move(box.x+box.width/2,box.y+150); await page.mouse.down(); for(let i=1;i<=14;i++){ await page.mouse.move(box.x+box.width/2+i*14,box.y+150+i*2); await W(35);} await page.mouse.up(); } await W(1400);
await page.evaluate(()=>discDecide('no')); await W(1500);
await hide(); await page.evaluate(()=>goto('cost')); await W(1000); await page.evaluate(()=>{ const s=document.getElementById('cost-income2'); if(s){ s.value='2'; s.dispatchEvent(new Event('change',{bubbles:true})); } }); await W(900);
await cap("What each school will really cost you","After typical aid for your income — and out-of-state tuition when it applies"); await W(2200); await page.evaluate(()=>window.scrollBy({top:330,behavior:'smooth'})); await W(2200); await page.evaluate(()=>window.scrollTo(0,0));;
await hide(); await page.evaluate(()=>goto('deadlines')); await W(1000); await cap("Every deadline and checklist","Shared with the whole family"); await W(3300);
await hide(); await page.evaluate(()=>{ const k=(state.schools[0]||{}).school_id; openTalk({tab:'thread', school:k}); }); await W(1100);
await cap("A calm conversation for each school","Everyone gets a voice. Nobody has to win."); await W(4200);
await hide(); await page.evaluate(()=>goto('journey')); await W(1100); await cap("Your family's journey","From the first list to Decision Day — the outline of your movie"); await W(2400);
await page.evaluate(()=>window.scrollBy({top:380,behavior:'smooth'})); await W(1900);
await hide(); await page.evaluate(()=>{ window.scrollTo(0,0); goto('today'); openCmd(); }); await W(700);
await cap("Jump anywhere — just type"); await page.type('#cmd-q','charleston cost',{delay:85}); await W(1800); await page.keyboard.press('Enter'); await W(2600);
await page.evaluate(()=>{ const c=document.getElementById('tour-cap'); if(c) c.remove(); }); await card("Start with the sample family","Or join with your family's invite at zoescolleges.com"); await W(3400);
await cdp.send('Page.stopScreencast'); const end=Date.now()/1000;
let list=''; for(let i=0;i<shots.length;i++){ const d=((shots[i+1]?shots[i+1][1]:end)-shots[i][1]); list+=`file '${shots[i][0]}'\nduration ${Math.max(0.001,d).toFixed(3)}\n`; } list+=`file '${shots[shots.length-1][0]}'\n`;
fs.writeFileSync('/tmp/claude-0/tour/sc/list.txt',list); console.log('frames',shots.length);
await ctx.close(); await b.close(); srv.close();

