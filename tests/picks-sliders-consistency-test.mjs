import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT=new URL('..', import.meta.url).pathname;
http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end();}r.writeHead(200,{'content-type':f.endsWith('.html')?'text/html':'text/javascript'});r.end(d);});}).listen(8954);
const b=await chromium.launch();const errs=[];
for(const W of [390,1280]){
const page=await b.newPage({viewport:{width:W,height:900}});page.on('pageerror',e=>errs.push(W+' '+e));
await page.goto('http://localhost:8954/index.html');await page.waitForFunction(()=>typeof startDemo==='function'&&document.getElementById('demo-start'),null,{timeout:60000});
await page.evaluate(()=>startDemo());await page.waitForFunction(()=>state.catalog&&state.catalog.length>0,null,{timeout:60000});await page.waitForTimeout(1000);
const R=await page.evaluate(()=>{
  const out={cases:0,orderBad:[],fitBad:[],priceBad:[],whyBad:[],bandBad:[],dupBad:[],boardLeak:[],gradLeak:[],fewCards:[]};
  const keys=['afford','outcomes','prestige','spirit','proximity','lifestyle','size','setting'];
  const settings=[{},{afford:10},{afford:1},{prestige:10},{prestige:1},{outcomes:10,afford:1},{size:1},{size:10},{setting:1},{setting:10},{spirit:10,proximity:10}];
  const base=myPrefs();
  for(const st of settings){ const w={...base,...st}; state.prefs[state.me.user_id]=w; out.cases++;
    goto('board'); goto('recommends'); for(const b of ['likely','target','reach']) { window._recShow={}; } 
    const have=new Set(state.schools.map(s=>s.school_id));
    for(const band of ['likely','target','reach']){
      const grid=[...document.querySelectorAll('#rec-out .rec-h')].find(h=>h.innerText.toLowerCase().startsWith(band)); if(!grid){ out.fewCards.push(JSON.stringify(st)+' no '+band+' row'); continue; }
      const cards=[...grid.nextElementSibling.querySelectorAll('.rec-card')];
      const items=cards.map(c=>{ const nm=c.querySelector('.nm').innerText; return {nm,c,info:state.catalog.find(x=>x.name===nm)}; });
      let prev=1e9; items.forEach(({nm,c,info})=>{ if(!info) return; const m=matchScore(info,w); const shown=+(c.querySelector('.ring,.mring,[class*=ring]')||{innerText:''}).innerText.replace(/\D/g,'')||null;
        if(m>prev+0.001) out.orderBad.push([JSON.stringify(st),band,nm,m,prev]); prev=m;
        if(shown!=null && Math.abs(shown-Math.round(m))>1) out.fitBad.push([nm,shown,m]);
        const ch=chanceFor(info); if(ch.band!==band) out.bandBad.push([nm,band,ch.band]);
        if(have.has(info.id)) out.boardLeak.push(nm); if(isGradOnly(info)) out.gradLeak.push(nm);
        const k=costFact(info); const priceShown=c.querySelectorAll('.rf b')[1].innerText; if(k&&priceShown!==k.v) out.priceBad.push([nm,priceShown,k.v]);
        const low=/low net price/.test(c.innerText); const mp=matchPrice(info); if(low&&!(mp<20000)) out.whyBad.push([nm,'low net price but',mp,priceShown]);
      });
      const names=items.map(x=>x.nm); if(new Set(names).size!==names.length) out.dupBad.push(band);
    }
  }
  state.prefs[state.me.user_id]=base; return out; });
console.log(W,JSON.stringify(Object.fromEntries(Object.entries(R).map(([k,v])=>[k,Array.isArray(v)?v.length+' '+JSON.stringify(v.slice(0,3)):v]))));
await page.close(); }
console.log('errs',errs);process.exit(0);
