import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT=new URL('..', import.meta.url).pathname;
http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end();}r.writeHead(200,{'content-type':f.endsWith('.html')?'text/html':'text/javascript'});r.end(d);});}).listen(8953);
const b=await chromium.launch();const page=await b.newPage({viewport:{width:1280,height:900}});const errs=[];page.on('pageerror',e=>errs.push(''+e));
await page.goto('http://localhost:8953/index.html');await page.waitForFunction(()=>typeof startDemo==='function'&&document.getElementById('demo-start'),null,{timeout:60000});
await page.evaluate(()=>startDemo());await page.waitForFunction(()=>state.catalog&&state.catalog.length>0,null,{timeout:60000});await page.waitForTimeout(1000);
const R=await page.evaluate(()=>{
  const F={ 'ex-level':['4-year','2-year','graduate'], 'ex-size':['s','m','l'], 'ex-sel':['r','t','k'], 'ex-ch':['likely','target','reach','far'], 'ex-cost':['1','2','3'], 'ex-div':[...document.querySelectorAll('#ex-div option')].map(o=>o.value).filter(Boolean).slice(0,6), 'ex-pol':[...document.querySelectorAll('#ex-pol option')].map(o=>o.value).filter(Boolean), 'ex-guns':[...document.querySelectorAll('#ex-guns option')].map(o=>o.value).filter(Boolean), 'ex-lgbtq':[...document.querySelectorAll('#ex-lgbtq option')].map(o=>o.value).filter(Boolean), 'ex-relig':[...document.querySelectorAll('#ex-relig option')].map(o=>o.value).filter(Boolean), 'ex-prox':[...document.querySelectorAll('#ex-prox option')].map(o=>o.value).filter(Boolean)};
  const ids=['ex-level','ex-size','ex-sel','ex-ch','ex-cost','ex-div','ex-sport','ex-pol','ex-guns','ex-lgbtq','ex-relig','ex-prox','ex-sort2'];
  const reset=()=>{ ids.forEach(i=>{ const e=$(i); if(e) e.value= i==='ex-sort2'?e.value:''; }); $('ex-level').value=''; };
  const run=(q)=>{ const lv=($('ex-level')&&$('ex-level').value)||''; renderExList._lastKey=(q||'')+'|'+lv; renderExList._limit=1e6; renderExList(q||''); return new Set([...document.querySelectorAll('#exlist [data-open]')].map(e=>e.dataset.open)); };
  const out={single:[],pair:[],sorts:[],empty:[],notes:[]};
  goto('explore'); reset(); const base=run('');
  out.notes.push('unfiltered '+base.size+' of '+state.catalog.length+' (level default='+$('ex-level').value+')');
  // independent expectations from data
  const exp={ 'ex-level':(c,v)=>(c.degreeType||'')===v,
    'ex-size':(c,v)=>{const z=c.scorecard&&c.scorecard.size; if(typeof z!=='number')return false; return v==='s'?z<5000:v==='m'?(z>=5000&&z<15000):z>=15000;},
    'ex-sel':(c,v)=>{const a=c.scorecard&&c.scorecard.admissionRate; if(a==null)return false; return v==='r'?a<0.25:v==='t'?(a>=0.25&&a<0.6):a>=0.6;} };
  const sets={};
  for(const [id,vals] of Object.entries(F)) for(const v of vals){ reset(); $(id).value=v; if($(id).value!==v) { out.notes.push('option missing '+id+'='+v); continue; } const s=run(''); sets[id+'='+v]=s;
    if(exp[id]){ const e=new Set(state.catalog.filter(c=>exp[id](c,v)&&(id==='ex-level'||true)).map(c=>c.id)); // default level filter may hide some
      const lvl=$('ex-level').value; const e2=new Set([...e].filter(i=>{ const c=state.catalog.find(x=>x.id===i); return !lvl||c.degreeType===lvl; }));
      const diff=[...e2].filter(i=>!s.has(i)).length+[...s].filter(i=>!e2.has(i)).length; out.single.push([id+'='+v,s.size,e2.size,diff]); }
    else out.single.push([id+'='+v,s.size,'-', s.size===0?'EMPTY':'']); }
  // pairs: A∧B must equal intersection of A alone and B alone (same level default)
  const keys=Object.keys(sets).filter(k=>!k.startsWith('ex-level')); let bad=0,tested=0;
  for(let i=0;i<keys.length;i++) for(let j=i+1;j<keys.length;j++){ const [ia,va]=keys[i].split('='), [ib,vb]=keys[j].split('='); if(ia===ib) continue; reset(); $(ia).value=va; $(ib).value=vb; const s=run(''); const A=sets[keys[i]],B=sets[keys[j]]; const want=[...A].filter(x=>B.has(x)); tested++; if(want.length!==s.size||want.some(x=>!s.has(x))){ bad++; if(out.pair.length<10) out.pair.push([keys[i],keys[j],s.size,want.length]); } }
  out.notes.push('pairs tested '+tested+' mismatches '+bad);
  // sorts: every option, check no throw and order property for numeric sorts
  reset(); [...$('ex-sort2').options].forEach(o=>{ $('ex-sort2').value=o.value; try{ run(''); const n=document.querySelectorAll('#exlist .srow').length; out.sorts.push([o.value,n]); }catch(e){ out.sorts.push([o.value,'throw '+e.message]); } });
  // filters with text queries that yield nothing -> clear-filters message present
  reset(); $('ex-size').value='s'; $('ex-sel').value='r'; run('massachusetts'); out.empty.push($('excount').innerText+' | '+$('exlist').innerText.slice(0,80).replace(/\n/g,' '));
  return out; });
console.log(JSON.stringify(R,null,0).replace(/\],\[/g,'],\n['));console.log('errs',errs); process.exit(0);
