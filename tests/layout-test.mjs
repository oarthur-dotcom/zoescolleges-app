import { launch, newPage, audit } from '/tmp/claude-0/audit-ui/lib.mjs';
import http from 'http'; import fs from 'fs'; import path from 'path';
const CAT=fs.readFileSync('/home/claude/zoescolleges-data/colleges.json');
const srv=http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split('?')[0]); const f=path.join('/tmp/claude-0/f4',u);
  fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);return r.end();} r.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':'text/html'}); r.end(d);});}).listen(8774);
const S='/tmp/claude-0/f4/shots/'; const b=await launch(); const res={};
const overlap=(a,c)=>a&&c&&!(a.right<=c.left||c.right<=a.left||a.bottom<=c.top||c.bottom<=a.top);
for(const ver of ['old','new']) for(const [vn,vp] of [['phone',{width:390,height:844}],['desk',{width:1440,height:900}]]){
  const {ctx,page,log}=await newPage(b,vp,{plan:'family'});
  await page.route(/jsdelivr.*colleges\.json/,r=>r.fulfill({contentType:'application/json',body:CAT}));
  await page.goto(`http://localhost:8774/${ver}/index.html`);
  await page.waitForFunction(()=>typeof state!=="undefined"&&state.catalog&&state.catalog.length>0&&!document.getElementById('v-board').classList.contains('hidden'),null,{timeout:60000});
  await page.waitForTimeout(1200);
  const k=`${ver}-${vn}`; const r={};
  // board card header
  r.board = await page.evaluate(()=>{ const cards=[...document.querySelectorAll('#schools .school')]; const tiles=document.getElementById('schools').classList.contains('as-tiles');
    return {tiles, cards:cards.length, cardsWithSqueezedName: cards.filter(c=>{const n=c.querySelector('.top .name'); return n && n.getBoundingClientRect().width<120;}).length,
      cardsWhereNameOverlapsButton: cards.filter(c=>{const n=c.querySelector('.top .name').getBoundingClientRect(); return [...c.querySelectorAll('.top .openlink')].some(bt=>{const o=bt.getBoundingClientRect(); return !(n.right<=o.left||o.right<=n.left||n.bottom<=o.top||o.bottom<=n.top);});}).length,
      minNameWidth: Math.min(...cards.map(c=>Math.round(c.querySelector('.top .name').getBoundingClientRect().width)))}; });
  r.boardOverflowX=(await audit(page,'#v-board')).overflowX;
  await page.locator('#schools .school').first().screenshot({path:S+`${k}-card.png`});
  // FABs vs last card at bottom
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight)); await page.waitForTimeout(400);
  r.fabCoversLastCard = await page.evaluate(()=>{ const last=[...document.querySelectorAll('#schools .school')].pop(); const targets=[...last.querySelectorAll('.raters, details.extra summary')]; const fabs=['fab-add','zoe-fab'].map(i=>document.getElementById(i)).filter(f=>f&&getComputedStyle(f).display!=='none'&&!f.classList.contains('hidden'));
    return targets.some(t=>{const a=t.getBoundingClientRect(); return fabs.some(f=>{const c=f.getBoundingClientRect(); return !(a.right<=c.left||c.right<=a.left||a.bottom<=c.top||c.bottom<=a.top);});}); });
  await page.screenshot({path:S+`${k}-board-bottom.png`});
  // compare 4 schools
  await page.evaluate(()=>window.scrollTo(0,0));
  const btns=page.locator('#schools .cmp-btn'); const n=Math.min(4,await btns.count()); for(let i=0;i<n;i++){ await btns.nth(i).click(); await page.waitForTimeout(150); }
  await page.click('[data-nav="compare"]'); await page.waitForTimeout(800);
  r.compare = await page.evaluate(()=>{ const hs=[...document.querySelectorAll('.cx-grid .cx-head')]; const cells=[...document.querySelectorAll('.cx-grid .cx-cell')]; const spill=[...hs,...cells].filter(h=>h.scrollWidth>h.clientWidth+1).length; return {cols:hs.length, minColWidth: Math.min(...hs.map(h=>Math.round(h.getBoundingClientRect().width))), cellsOrHeadersSpilling:spill}; });
  r.compareOverflowX=(await audit(page,'#v-compare')).overflowX;
  const tbl=page.locator('.cx-card').first(); if(await tbl.count()) await tbl.screenshot({path:S+`${k}-compare.png`});
  // explore
  await page.click('[data-nav="explore"]'); await page.waitForTimeout(1500);
  const ex=await audit(page,'#v-explore'); r.exploreOverflowX=ex.overflowX; r.exploreWide=ex.wide.slice(0,3);
  await page.locator('#exlist .srow').first().screenshot({path:S+`${k}-explore-row.png`});
  // zoe tab
  await page.click('[data-nav="zoe"]'); await page.waitForTimeout(600);
  r.zoeFabVisibleOnZoeTab = await page.evaluate(()=>{const f=document.getElementById('zoe-fab'); return !f.classList.contains('hidden') && getComputedStyle(f).display!=='none';});
  await page.click('[data-nav="board"]'); await page.waitForTimeout(500);
  r.zoeFabVisibleOnBoard = await page.evaluate(()=>{const f=document.getElementById('zoe-fab'); return !f.classList.contains('hidden');});
  r.pageErrors=log.pageerr;
  res[k]=r; await ctx.close();
}
fs.writeFileSync('/tmp/claude-0/f4/result.json',JSON.stringify(res,null,1)); console.log(JSON.stringify(res,null,1)); await b.close(); srv.close();
