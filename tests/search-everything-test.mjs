import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT=new URL('..', import.meta.url).pathname;
http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end();}r.writeHead(200,{'content-type':f.endsWith('.html')?'text/html':'text/javascript'});r.end(d);});}).listen(8951);
const b=await chromium.launch();const page=await b.newPage();
await page.goto('http://localhost:8951/index.html');await page.waitForFunction(()=>typeof startDemo==='function'&&document.getElementById('demo-start'),null,{timeout:60000});
await page.evaluate(()=>startDemo());await page.waitForFunction(()=>state.catalog&&state.catalog.length>0,null,{timeout:60000});await page.waitForTimeout(1000);
const R=await page.evaluate(()=>{
  const cat=state.catalog; const fails={exact:[],lower:[],typo:[],prefix:[],city:[],cityst:[],stname:[],stabbr:[],nopunct:[],hand:[]};
  const top=(q,c,n)=>{ const h=searchCatalog(q)||[]; const i=h.findIndex(x=>x.c===c); return i>=0&&i<n; };
  const dupNames=new Set(cat.map(c=>c.name).filter((n,i,a)=>a.indexOf(n)!==i));
  const nonGrad=cat.filter(c=>!isGradOnly(c));
  let tested=0;
  for(const c of cat){ const n=c.name; tested++;
    if(!top(n,c,dupNames.has(n)?5:1)) fails.exact.push(n);
    if(!top(n.toLowerCase(),c,dupNames.has(n)?5:1)) fails.lower.push(n);
    if(!top(n.replace(/-/g,' ').replace(/[^A-Za-z0-9 ]/g,''),c,dupNames.has(n)?8:3)) fails.nopunct.push(n);
    const w=n.split(/[ -]/).filter(x=>x.length>=5); if(w.length){ const wd=w[0]; if(!top(n.slice(0,Math.max(6,Math.ceil(n.length*0.6))),c,25)) fails.prefix.push(n); }
    // single transposition typo in a long word
    const words=n.split(' '); const lw=words.findIndex(x=>x.length>=7&&/^[A-Za-z]+$/.test(x)); if(lw>=0){ const x=words[lw]; const t=x.slice(0,3)+x[4]+x[3]+x.slice(5); const q=[...words.slice(0,lw),t,...words.slice(lw+1)].join(' '); if(!top(q,c,15)) fails.typo.push(q+' -> '+n); }
  }
  // places: every city+state must return all schools in that city (within results)
  const byCity={}; nonGrad.forEach(c=>{ const k=(c.city||'')+'|'+c.state; (byCity[k]=byCity[k]||[]).push(c); });
  for(const [k,l] of Object.entries(byCity)){ const [city,st]=k.split('|'); if(!city) continue; const h=new Set((searchCatalog(city+', '+st)||[]).map(x=>x.c)); const miss=l.filter(c=>!h.has(c)); if(miss.length) fails.cityst.push(city+', '+st+': missing '+miss.slice(0,2).map(c=>c.name).join('; ')+(miss.length>2?' +'+(miss.length-2):'')); 
    const h2=new Set((searchCatalog(city)||[]).map(x=>x.c)); const miss2=l.filter(c=>!h2.has(c)); if(miss2.length) fails.city.push(city+': missing '+miss2.slice(0,2).map(c=>c.name).join('; ')); }
  const sts=[...new Set(cat.map(c=>c.state))];
  for(const st of sts){ const all=nonGrad.filter(c=>c.state===st); const h=new Set((searchCatalog(st.toLowerCase()+' colleges')||[]).map(x=>x.c)); const miss=all.filter(c=>!h.has(c)); if(all.length>3&&miss.length>0) fails.stabbr.push(st+' colleges: '+all.length+' schools, missing '+miss.length); }
  for(const [nm,ab] of Object.entries(STATE_NAMES)){ const all=nonGrad.filter(c=>c.state===ab.toUpperCase()); const h=new Set((searchCatalog(nm)||[]).map(x=>x.c)); const miss=all.filter(c=>!h.has(c)); if(all.length&&miss.length) fails.stname.push(nm+': '+all.length+' schools, missing '+miss.length); const h2=new Set((searchCatalog('colleges in '+nm)||[]).map(x=>x.c)); const m2=all.filter(c=>!h2.has(c)); if(all.length&&m2.length) fails.stname.push('colleges in '+nm+': missing '+m2.length); }
  return {tested, counts:Object.fromEntries(Object.entries(fails).map(([k,v])=>[k,v.length])), samples:Object.fromEntries(Object.entries(fails).map(([k,v])=>[k,v.slice(0,12)]))}; });
console.log(JSON.stringify(R,null,1)); process.exit(0);
