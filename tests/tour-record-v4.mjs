// Narrated welcome tutorial: each scene lasts as long as its narration clip. Records with Chrome's headless shell
// (full frame) via CDP screencast, logs scene start times, writes frames + list + audio timeline.
import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const SITE='/tmp/claude-0/tour2/site', OUT='/tmp/claude-0/tour2', NAR='/tmp/claude-0/narration/sienna';
const CAT=fs.readFileSync('/tmp/claude-0/f35-colleges.json'), VL=fs.readFileSync('/home/claude/zoescolleges-data/visit-links.json'), DLF=fs.readFileSync('/home/claude/zoescolleges-data/deadlines-2026-27.json');
const NP=fs.readFileSync('/home/claude/zoescolleges-data/net-price-by-income.json'), AID=fs.readFileSync('/home/claude/zoescolleges-data/school-aid.json');
const FAKE=fs.readFileSync('/tmp/claude-0/audit-ui/fake-supabase.js','utf8'); const CL=JSON.parse(fs.readFileSync(NAR+'/clips.json'));
const srv=http.createServer((q,r)=>{const f=path.join(SITE,decodeURIComponent(q.url.split('?')[0])); fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end();} r.writeHead(200,{'Content-Type': f.endsWith('.webp')?'image/webp':f.endsWith('.html')?'text/html':f.endsWith('.jpg')?'image/jpeg':'application/octet-stream'}); r.end(d);});}).listen(8874);
const b=await chromium.launch({headless:true,args:['--no-sandbox'],executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'});
const ctx=await b.newContext({viewport:{width:1280,height:720}, deviceScaleFactor:1});
const page=await ctx.newPage();
fs.rmSync(OUT+'/sc',{recursive:true,force:true}); fs.mkdirSync(OUT+'/sc');
await page.addInitScript(`window.__PLAN="family"; window.__SIGNEDOUT=true;`);
await page.route('**/supabase.min.js', r=>r.fulfill({status:200, contentType:'application/javascript', body:FAKE}));
await page.route(/jsdelivr.*colleges\.json/, r=>r.fulfill({contentType:'application/json',body:CAT}));
await page.route(/jsdelivr.*visit-links\.json/, r=>r.fulfill({contentType:'application/json',body:VL}));
await page.route(/jsdelivr.*deadlines-2026-27\.json/, r=>r.fulfill({contentType:'application/json',body:DLF}));
await page.route(/jsdelivr.*net-price-by-income\.json/, r=>r.fulfill({contentType:'application/json',body:NP}));
await page.route(/jsdelivr.*school-aid\.json/, r=>r.fulfill({contentType:'application/json',body:AID}));
await page.route(/tile\.openstreetmap|router\.project-osrm|\.netlify\/functions/, r=>r.abort());
const W=ms=>page.waitForTimeout(ms);
const style=`#tour-cap{position:fixed;left:50%;bottom:40px;transform:translateX(-50%);max-width:980px;width:max-content;background:rgba(11,20,36,.88);color:#fff;font:700 26px/1.3 "Bricolage Grotesque",system-ui,sans-serif;padding:14px 24px;border-radius:18px;z-index:99999;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.35);transition:opacity .35s;letter-spacing:-.01em}
#tour-cap small{display:block;font-weight:500;font-size:16px;opacity:.85;margin-top:4px}
#tour-card{position:fixed;inset:0;z-index:99998;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0b7f81;color:#fff;font-family:"Bricolage Grotesque",system-ui,sans-serif;transition:opacity .5s}
#tour-card h1{font-size:64px;margin:0;letter-spacing:-.03em}#tour-card p{font-size:26px;margin:10px 0 0;opacity:.92}
.tour-spot{outline:4px solid #f5b83d!important;outline-offset:4px;border-radius:14px;transition:outline-color .3s}
#demo-bar,#demo-toast,#zoe-fab,.fab{display:none!important}`;
const prep=async()=>{ await page.addStyleTag({content:style}); };
const cap=async(t,s)=>page.evaluate(([t,s])=>{ let c=document.getElementById('tour-cap'); if(!c){ c=document.createElement('div'); c.id='tour-cap'; document.documentElement.appendChild(c); } c.style.opacity=0; setTimeout(()=>{ c.innerHTML=t+(s?`<small>${s}</small>`:''); c.style.opacity=1; },180); },[t,s||'']);
const hide=async()=>{ await page.evaluate(()=>{ const c=document.getElementById('tour-cap'); if(c) c.style.opacity=0; }); };
const card=async(h,p)=>page.evaluate(([h,p])=>{ let c=document.getElementById('tour-card'); if(!c){ c=document.createElement('div'); c.id='tour-card'; document.documentElement.appendChild(c); } c.style.opacity=1; c.innerHTML=`<h1>${h}</h1><p>${p}</p>`; },[h,p]);
const uncard=async()=>page.evaluate(()=>{ const c=document.getElementById('tour-card'); if(c){ c.style.opacity=0; setTimeout(()=>c.remove(),600); } });
const spot=async sel=>page.evaluate(sel=>{ document.querySelectorAll('.tour-spot').forEach(e=>e.classList.remove('tour-spot')); const e=sel&&document.querySelector(sel); if(e) e.classList.add('tour-spot'); },sel);
await page.goto('http://localhost:8874/index.html'); await W(2500); await prep();
// screencast
const cdp=await ctx.newCDPSession(page); const shots=[]; let n=0;
cdp.on('Page.screencastFrame', async f=>{ const fn=`${OUT}/sc/${String(n++).padStart(5,'0')}.jpg`; fs.writeFileSync(fn,Buffer.from(f.data,'base64')); shots.push([fn,f.metadata.timestamp]); try{ await cdp.send('Page.screencastFrameAck',{sessionId:f.sessionId}); }catch(e){} });
await cdp.send('Page.startScreencast',{format:'jpeg',quality:88,maxWidth:1280,maxHeight:720,everyNthFrame:1});
await W(300); const T0=Date.now()/1000; const timeline=[];

// camera: zoom the page so `sel` fills the frame, gliding from wherever it was (page stays scrolled to top)
const cam=async(sel,maxS=1.8)=>page.evaluate(([sel,maxS])=>{ const B=document.body; const T='transform .95s cubic-bezier(.4,0,.2,1)';
  let left=false; if(sel&&sel.endsWith('<')){ left=true; sel=sel.slice(0,-1); } let e=null; if(sel){ const [q,idx,sub]=sel.split('|'); const all=document.querySelectorAll(q); e=all[+(idx||0)]||null; if(e&&sub) e=e.querySelector(sub); } if(!e){ B.style.transition=T; B.style.transform='translate(0px,0px) scale(1)'; return false; }
  const prev=B.style.transform; B.style.transition='none'; B.style.transform='none'; const r0=e.getBoundingClientRect(), br=B.getBoundingClientRect(); const r=left?{left:r0.left,top:r0.top,width:Math.min(r0.width,560),height:Math.min(r0.height,330)}:r0; B.style.transform=prev||'translate(0px,0px) scale(1)'; void B.offsetWidth;
  const W=innerWidth,H=innerHeight; let s=Math.max(1,Math.min(maxS,0.9*W/r.width,0.74*H/r.height));
  const cx=r.left+r.width/2-br.left, cy=r.top+r.height/2-br.top;
  let tx=W/2-br.left-s*cx, ty=H*0.44-br.top-s*cy; tx=Math.min(-br.left,Math.max(W-br.left-s*br.width,tx)); ty=Math.min(-br.top,ty);
  B.style.transformOrigin='0 0'; B.style.transition=T; B.style.transform=`translate(${tx}px,${ty}px) scale(${s})`; return true; },[sel,maxS]);
const reset=async()=>page.evaluate(()=>{ const B=document.body; B.style.transition='none'; B.style.transform='none'; window.scrollTo(0,0); });
const go=async v=>{ await reset(); await page.evaluate(v=>{ goto(v); window.scrollTo(0,0); },v); };
// a scene: run the action, start the clip, hold for the clip's length (+pad)
async function scene(clip, setup, during){ if(setup) await setup(); const t=Date.now()/1000-T0; timeline.push({clip, at:t}); const ms=Math.round(CL[clip].secs*1000)+700; const t0=Date.now(); if(during) await during(); const left=ms-(Date.now()-t0); if(left>0) await W(left); }
await scene('40-hi-im-zoe', async()=>{ await card("Zoe's Colleges","Welcome — a quick tour"); });
await scene('01-welcome', async()=>{ await uncard(); await W(400); await cap("One calm, shared place for your family's college search"); });
await scene('05-today', async()=>{ await hide(); await page.evaluate(()=>startDemo()); await W(2200); await prep(); await page.evaluate(()=>{ try{ localStorage.setItem('zc_guide_seen','1'); }catch(e){} }); await go('today'); await W(400); await cap("Today: your one next step","…and what's coming up"); await cam('#v-today .td-card<',1.8); },
  async()=>{ await W(4200); await cam('#v-today .td-grid',1.25); });
await scene('07-board', async()=>{ await hide(); await go('board'); await W(700); await cap("Every school on one board","Your real cost, your chance, and everyone's stars"); await cam('#v-board .bd-sum',1.7); },
  async()=>{ await W(2600); await cam('#schools .school:first-child .big3',2.3); await W(4200); await cam('#schools .school:first-child .top',2.2); });
await scene('09b-zoe-picks', async()=>{ await hide(); await go('recommends'); await W(800); await cap("Zoe Picks — as a list…","…or swipe: yes, maybe, no"); await cam('#v-recommends .rec-card',1.6); },
  async()=>{ await W(4300); await cam('#v-recommends .pk-toggle',2.4); await W(1500); await reset(); await page.evaluate(()=>goto('discover')); await W(700); await cam('#v-discover .disc-stage',1.45); await W(1200);
    const box=await page.locator('.disc-stage > .disc-card').boundingBox(); if(box){ await page.mouse.move(box.x+box.width/2,box.y+150); await page.mouse.down(); for(let i=1;i<=14;i++){ await page.mouse.move(box.x+box.width/2+i*14,box.y+150+i*2); await W(35);} await page.mouse.up(); } await W(1500); await page.evaluate(()=>discDecide('no')); });
await scene('14-profile', async()=>{ await hide(); await go('profile'); await W(900); await cap("A student profile like the Common App","Grades, schedule, scores and activities"); await cam('#v-profile .pv-grid<',1.9); },
  async()=>{ await W(5500); await cam('#v-profile .pv-grid .pv-row:nth-child(4)',2.4); });
await scene('15-transcript', async()=>{ await reset(); await page.evaluate(()=>{ const b=[...document.querySelectorAll('#v-profile button')].find(x=>/Edit profile/i.test(x.textContent)); if(b) b.click(); }); await W(700); await page.evaluate(()=>window.scrollTo(0,0)); await W(300); await spot('#pf-form-card .tx-up'); await cap("Snap a photo of the transcript","Zoe reads every course and works out the GPA"); await cam('#pf-form-card .tx-up<',2.2); }, async()=>{ await W(5000); await cam('#pf-form-card<',1.6); });
await scene('11-chances', async()=>{ await spot(null); await hide(); await go('recommends'); await W(900); await cap("Likely · Target · Reach · Far reach","Compared with the students each school really admits"); await cam('#rec-out .rec-grid|0|.rec-card .rec-body',2.0); },
  async()=>{ await W(4600); await cam('#rec-out .rec-grid|1|.rec-card .rec-body',2.0); await W(4600); await cam('#rec-out .rec-grid|2|.rec-card .rec-body',2.0); });
await scene('17-costs', async()=>{ await hide(); await go('cost'); await W(500); await page.evaluate(async()=>{ await setFamilyFinance(165000,1); renderCost(); }); await W(500); await cap("What each school will likely cost you","Add your income once — every school updates"); await cam('#v-cost .cf-box<',1.9); },
  async()=>{ await W(3800); await cam('#v-cost .cost-sum<',1.9); await W(2800); await cam('#v-cost .cost-tbl',1.15); });
await scene('21-deadlines', async()=>{ await hide(); await page.evaluate(()=>{ try{ localStorage.removeItem(lsKey('dlStages')); }catch(e){} }); await go('deadlines'); await W(900); await cap("Every deadline in one place","Checked against each school's own site"); await cam('#v-deadlines .dl-row<',1.9); });
await scene('22-checklist', async()=>{ await spot('#dl-out .dl-pills'); await cap("An application checklist for each school","Tick each item — the whole family sees it"); await cam('#dl-out .dl-pills',2.3); },
  async()=>{ await W(3500); await page.evaluate(()=>{ const p=document.querySelector('#dl-out .dl-pill'); if(p) p.click(); }); await W(500); await spot('#dl-out .dl-pills'); await cam('#dl-out .dl-pills',2.3); });
await scene('25-plan-visit', async()=>{ await spot(null); await hide(); await page.evaluate(()=>{ const k=(state.schools[1]||{}).school_id, k2=(state.schools[2]||{}).school_id; const d=n=>{ const x=new Date(Date.now()+n*864e5); return new Date(x.getTime()-x.getTimezoneOffset()*6e4).toISOString().slice(0,10); };
    if(k){ const v=getVisit(k); v.date=d(9); v.booked=true; saveVisit(k,v); } if(k2){ const v=getVisit(k2); v.date=d(10); saveVisit(k2,v); } }); await go('trip'); await W(900); await cap("Plan campus visits","Pick a date — trips a few days apart become a road trip"); await cam('#v-trip .tv-acts',2.0); },
  async()=>{ await W(2600); await cam('#trip-out .card<',1.9); });
await scene('29-talk-it-out', async()=>{ await hide(); await reset(); await page.evaluate(()=>{ const k=(state.schools[0]||{}).school_id; openTalk({tab:'thread', school:k}); window.scrollTo(0,0); }); await W(900); await cap("A calm conversation for each school","Everyone gets a voice. Nobody has to win."); await cam('#v-talk .tk-thread, #v-talk',1.3); });
await scene('32-journey', async()=>{ await hide(); await go('journey'); await W(900); await cap("Your family's journey","From the first list to Decision Day"); await cam('#v-journey .jr-list',1.5); },
  async()=>{ await W(3600); await cam('#v-journey .jr-list > li:nth-child(3)',2.0); });
await scene('33-memories', async()=>{ await hide(); await go('memories'); await W(1000); await cap("Memories","Visit photos become a reel — and a short film of your journey"); await cam('#mem-list .mem-grid',1.8); },
  async()=>{ await W(3800); await cam('#mem-list .mem-takes<',2.0); });
await scene('31-decision-day', async()=>{ await hide(); await go('decide'); await W(1100); await cap("Decision Day","Acceptances, real costs and everyone's voice — then you choose, together"); await cam('#v-decide .dd-hero',1.5); },
  async()=>{ await W(2600); await cam('#v-decide .dd-row<',2.0); await W(1800); await hide(); await reset(); await page.evaluate(()=>{ const sid=(state.schools[0]||{}).school_id; celebrate(`🎓 ${studentFirst()==="We"?"We're":studentFirst()+" is"} going to ${schoolName(sid)}!`, "This is the big moment of your family movie. Congratulations to all of you. 💛", {fireworks:true}); }); });
await scene('35-ask-zoe', async()=>{ await spot(null); await hide(); await page.evaluate(()=>document.querySelectorAll('.celebrate').forEach(e=>e.remove())); await go('zoe'); await W(1000); await cap("Ask Zoe anything","She knows your student and your list"); await cam('#v-zoe .zm-cards',1.4); },
  async()=>{ await W(4800); await cam('#v-zoe .zsugg',2.0); });
await scene('36-college-report', async()=>{ await hide(); await go('report'); await W(1200); await cap("The College Report","Everything in one clean PDF for your counselor"); await cam('#v-report .rp-stats',1.7); },
  async()=>{ await W(3800); await cam('#v-report .rp-take',1.7); });
await scene('04-invite-family', async()=>{ await hide(); await go('today'); await W(500); await page.evaluate(()=>openInvite()); await W(500); await cap("Invite your family","A one-tap link by email — everyone sees the same board"); });
await scene('37-privacy', async()=>{ await page.evaluate(()=>{ try{ document.getElementById('dlg-invite').close(); }catch(e){} }); await reset(); await page.evaluate(()=>{ show('v-trust'); window.scrollTo(0,0); }); await W(900); await cap("Your family's information stays with your family","We never sell it"); await cam('#v-trust .card<',1.7); });
await scene('39-outro', async()=>{ await reset(); await page.evaluate(()=>{ const c=document.getElementById('tour-cap'); if(c) c.remove(); }); await card("Start with one small step","zoescolleges.com"); });
await W(800);
await cdp.send('Page.stopScreencast'); const end=Date.now()/1000;
let list=''; for(let i=0;i<shots.length;i++){ const d=((shots[i+1]?shots[i+1][1]:end)-shots[i][1]); list+=`file '${shots[i][0]}'\nduration ${Math.max(0.001,d).toFixed(3)}\n`; } list+=`file '${shots[shots.length-1][0]}'\n`;
// trim to the timeline start (T0)
fs.writeFileSync(OUT+'/sc/list.txt',list); fs.writeFileSync(OUT+'/timeline.json',JSON.stringify({start:T0, firstFrame:shots[0][1], end, timeline},null,1));
console.log('frames',shots.length,'secs',(end-T0).toFixed(1)); await ctx.close(); await b.close(); srv.close();
