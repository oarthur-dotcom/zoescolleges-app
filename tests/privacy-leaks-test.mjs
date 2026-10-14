import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT=new URL('..', import.meta.url).pathname;
http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end();}r.writeHead(200,{'content-type':f.endsWith('.html')?'text/html':'text/javascript'});r.end(d);});}).listen(8970);
const b=await chromium.launch();const page=await b.newPage({viewport:{width:1280,height:900}});const errs=[];page.on('pageerror',e=>errs.push(''+e));
await page.goto('http://localhost:8970/index.html');await page.waitForFunction(()=>typeof startDemo==='function'&&document.getElementById('demo-start'),null,{timeout:60000});
await page.evaluate(()=>startDemo());await page.waitForFunction(()=>state.catalog&&state.catalog.length>0,null,{timeout:60000});await page.waitForTimeout(1000);
const R=await page.evaluate(async()=>{
  const out={role:myRole(),leaks:[],parentSees:null,kidSees:null,promptsChecked:0,zoeChecked:0};
  const LEAK=/33\d,?\d{3}|\$33\dk|\b330k\b|income of \$|\$\d{2,3},?\d{3} (income|a year)/i;
  const views=['today','board','recommends','explore','compare','cost','deadlines','trip','talk','journey','memories','decide','family','zoe','profile','report'];
  const sweep=(tag)=>{ for(const v of views){ try{ goto(v); }catch(e){} const sec=[...document.querySelectorAll('section')].find(s=>!s.classList.contains('hidden')&&s.offsetParent); const t=sec?sec.innerText:''; if(LEAK.test(t)){ out.leaks.push([tag,v,t.slice(Math.max(0,t.search(LEAK)-30),t.search(LEAK)+40).replace(/\s+/g,' ')]); } } };
  const board=state.schools.slice(0,3);
  // ---- kid
  const meMember=state.members.find(m=>m.user_id===state.me.user_id); state.me.role='student'; out.role=myRole();
  state.fin={income:330000,band:3,kids:1,exact:false};
  sweep('kid');
  goto('profile'); out.kidSees=!!document.querySelector('#pf-family-money')&&document.querySelector('#pf-family-money').innerText.length>0 && /330/.test(document.getElementById('pf-family-money').innerText);
  // ask-ai prompts & zoe answers & report
  const prompts=[]; for(const c of state.catalog.slice(0,40)){ try{ openDetail(c.id,'board'); }catch(e){} }
  goto('board'); document.querySelectorAll('[data-askai]').forEach(b=>prompts.push(_aiPrompts[b.dataset.askai])); goto('zoe'); document.querySelectorAll('[data-askai]').forEach(b=>prompts.push(_aiPrompts[b.dataset.askai]));
  prompts.push(aiProfileLine()); prompts.push(zoeBoardLine()); Object.values(_aiPrompts).forEach(p=>prompts.push(p));
  out.promptsChecked=prompts.length; prompts.forEach(p=>{ if(LEAK.test(p||'')||/income/i.test(p||'')&&/\d{3}/.test((p||'').match(/income[^.]{0,40}/i)||'')) out.leaks.push(['prompt',(p||'').slice(0,80)]); });
  const qs=['how much can we afford','what is our income','what is our family income','what will it cost us','cheapest schools for us','how much aid will we get','tell me about our finances','what is the net price at '+board[0].name,'how much will Harvard cost','can we afford college','compare offers'];
  qs.forEach(q=>{ try{ const a=zoeAnswer(q); out.zoeChecked++; if(LEAK.test(a)) out.leaks.push(['zoe',q,a.slice(0,100)]); }catch(e){ out.leaks.push(['zoe throw',q,e.message]); } });
  try{ goto('report'); const t=document.getElementById('v-report').innerText; if(LEAK.test(t)) out.leaks.push(['report','kid']); }catch(e){}
  // ---- parent sees it
  state.me.role='parent'; state.fin={income:330000,band:3,kids:1,exact:true}; goto('profile'); const pm=document.getElementById('pf-family-money'); out.parentSees=!!pm&&/330/.test((pm.innerHTML||'')+(pm.querySelector('input')?pm.querySelector('input').value:''));
  out.parentInputVal=pm&&pm.querySelector('input')?pm.querySelector('input').value:null;
  // share link content must not contain income for any audience
  try{ const html=renderShareHtml({audience:'anyone',familyName:'X',sections:{cost:true,schools:true,finance:true,income:true},schools:state.schools.map(s=>({school_id:s.school_id,name:s.name}))},{}); if(LEAK.test(html)) out.leaks.push(['share','anyone']); out.shareLen=html.length; }catch(e){ out.leaks.push(['share throw',e.message]); }
  out.promptsSample=prompts.slice(0,2).map(p=>(p||'').slice(0,160));
  return out; });
console.log(JSON.stringify(R,null,1));console.log(errs);process.exit(0);
