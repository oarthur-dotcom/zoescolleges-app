import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT=new URL('..', import.meta.url).pathname;
http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end();}r.writeHead(200,{'content-type':f.endsWith('.html')?'text/html':'text/javascript'});r.end(d);});}).listen(8950);
const b=await chromium.launch();const page=await b.newPage({viewport:{width:390,height:844}});const errs=[];page.on('pageerror',e=>errs.push(''+e));page.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text().slice(0,160));});
await page.goto('http://localhost:8950/index.html');await page.waitForFunction(()=>typeof startDemo==='function'&&document.getElementById('demo-start'),null,{timeout:60000});
await page.evaluate(()=>startDemo());await page.waitForFunction(()=>state.catalog&&state.catalog.length>0,null,{timeout:60000});await page.waitForTimeout(1500);
const res=await page.evaluate(async()=>{
  const BAD=/\bNaN\b|undefined|\bnull\b|\[object|Infinity/;
  const out={n:state.catalog.length,detail:[],row:[],chance:[],match:[],cost:[]};
  const w=myPrefs();
  // chance + match + cost facts for every school
  for(const c of state.catalog){
    let ch=null,m=null; try{ ch=chanceFor(c); }catch(e){ out.chance.push([c.name,'throw '+e.message]); } try{ m=matchScore(c,w);}catch(e){ out.match.push([c.name,'throw '+e.message]); }
    const ar=c.scorecard&&c.scorecard.admissionRate;
    if(ch){ if(!['likely','target','reach'].includes(ch.band)) out.chance.push([c.name,'band '+ch.band]);
      if(ch.score!=null&&!(ch.score>=0&&ch.score<=100)) out.chance.push([c.name,'score '+ch.score]);
      if(typeof ar==='number'&&ar<0.15&&ch.band!=='reach') out.chance.push([c.name,'rate '+ar+' not reach: '+ch.band]);
      if(typeof ar==='number'&&ar<0.25&&ch.band==='likely') out.chance.push([c.name,'rate '+ar+' likely']);
      if(BAD.test(JSON.stringify(ch.label||''))) out.chance.push([c.name,'label '+ch.label]); }
    if(m!=null&&!(m>=0&&m<=100)) out.match.push([c.name,'match '+m]);
    try{ const k=costFact(c); if(k&&(BAD.test(k.v+k.s)||/\$-/.test(k.v))) out.cost.push([c.name,k.v,k.s]); }catch(e){ out.cost.push([c.name,'throw '+e.message]); }
  }
  // detail page for every school
  for(const c of state.catalog){ try{ openDetail(c.id,'explore'); const t=document.getElementById('v-detail').innerText; const h=document.getElementById('v-detail').innerHTML;
      if(BAD.test(t)) out.detail.push([c.name,(t.match(BAD)||[])[0], t.slice(Math.max(0,t.search(BAD)-40),t.search(BAD)+40).replace(/\s+/g,' ')]);
      if(!t.includes(c.name)) out.detail.push([c.name,'name missing']);
    }catch(e){ out.detail.push([c.name,'throw '+e.message]); } }
  // search rows for every school
  goto('explore'); $('ex-level').value=''; renderExList._lastKey='|'; renderExList._limit=1e6; renderExList('');
  const rows=[...document.querySelectorAll('#exlist .srow')]; out.rows=rows.length;
  rows.forEach(r=>{ const t=r.innerText; if(BAD.test(t)) out.row.push([r.querySelector('.sn')&&r.querySelector('.sn').innerText.slice(0,40),(t.match(BAD)||[])[0], t.slice(Math.max(0,t.search(BAD)-30),t.search(BAD)+30).replace(/\s+/g,' ')]); });
  // consistency of shown numbers vs data
  rows.forEach(r=>{ const nm=r.querySelector('.sn').childNodes[0].textContent.trim(); const c=state.catalog.find(x=>x.name===nm); if(!c) return; const s=c.scorecard||{}; const t=r.innerText;
    const a=t.match(/admit\s+(\d+)%/); if(a && typeof s.admissionRate==='number' && Math.abs(+a[1]-Math.round(s.admissionRate*100))>1) out.row.push([nm,'admit mismatch',a[1],s.admissionRate]);
    const z=t.match(/([\d,]+)\s+students/); if(z && typeof s.size==='number' && +z[1].replace(/,/g,'')!==s.size) out.row.push([nm,'size mismatch',z[1],s.size]);
    if(!r.querySelector('.srow-thumb')) out.row.push([nm,'no thumb']);
    if(!r.querySelector('[data-open]')) out.row.push([nm,'no open']); });
  return out; });
console.log('catalog',res.n,'rows rendered',res.rows);
for(const k of ['chance','match','cost','detail','row']) console.log(k,res[k].length,JSON.stringify(res[k].slice(0,12)));
console.log('errors',errs.length,errs.slice(0,6));
process.exit(0);
