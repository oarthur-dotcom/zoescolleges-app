import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const srv=http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split('?')[0]); const f=path.join('/tmp/claude-0/f3',u);
  fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);return r.end();} r.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':f.endsWith('.json')?'application/json':'text/html'}); r.end(d);});}).listen(8772);
const STUB=`window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from:()=>({select(){return this},eq(){return this}}),rpc:async()=>({data:null})})};`;
const PROFILES={
 P1_top_student:{gpa:"4.0",sat:"1580",activities:[{tier:1,years:4},{tier:1,years:4},{tier:2,years:3}],rigor:{ap:10,honors:4}},
 P2_3pt3_16APs:{gpa:"3.3",rigor:{ap:16}},
 P3_weighted_4pt4_entry:{gpa:"4.4"},
 P4_avg_3pt0_1100:{gpa:"3.0",sat:"1100"},
 P5_3pt95_no_tests:{gpa:"3.95",testOptional:true},
};
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',headless:false,args:['--no-sandbox','--headless=new']});
const res={};
for(const ver of ['old','new']){
  const p=await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.route(/supabase\.min\.js/,r=>r.fulfill({contentType:'text/javascript',body:STUB}));
  await p.route(/jsdelivr.*colleges\.json/,r=>r.fulfill({contentType:'application/json',body:fs.readFileSync('/tmp/claude-0/f3/colleges.json')}));
  await p.goto(`http://localhost:8772/${ver}/index.html`,{waitUntil:'networkidle'});
  const cat=JSON.parse(fs.readFileSync('/tmp/claude-0/f3/colleges.json')).colleges;
  res[ver]=await p.evaluate(({PROFILES,cat})=>{
    const out={}; state.members=[{user_id:'u1',role:'student',display_name:'Zoe'}]; state.me={user_id:'u1'};
    const named=['Harvard University','Stanford University','Massachusetts Institute of Technology','Princeton University','University of Michigan-Ann Arbor','College of Charleston','Clemson University','Boston College'];
    for(const [k,prof] of Object.entries(PROFILES)){
      state.profiles={u1:prof};
      const cnt={sub15:{reach:0,target:0,likely:0},'15to40':{reach:0,target:0,likely:0},over40:{reach:0,target:0,likely:0}}; const ex={};
      for(const c of cat){ const ch=chanceFor(c); if(!ch) continue; const r=c.scorecard.admissionRate; const bk=r<0.15?'sub15':r<0.4?'15to40':'over40'; cnt[bk][ch.band]++; if(named.includes(c.name)) ex[c.name]=ch.band; }
      out[k]={counts:cnt, examples:ex};
    }
    // explanation text for the top student at Harvard
    state.profiles={u1:PROFILES.P1_top_student}; const h=cat.find(c=>c.name==='Harvard University');
    out.harvard_explain=chanceExplain(h).steps.map(s=>`${s.k}: ${s.v} — ${s.why}`);
    return out;
  },{PROFILES,cat});
  res[ver].pageErrors=errs; await p.close();
}
fs.writeFileSync('/tmp/claude-0/f3/result.json',JSON.stringify(res,null,1));
for(const k of Object.keys(PROFILES)){ console.log(`\n== ${k}`); for(const v of ['old','new']) console.log(` ${v}: sub15%=${JSON.stringify(res[v][k].counts.sub15)} 15-40%=${JSON.stringify(res[v][k].counts['15to40'])} >40%=${JSON.stringify(res[v][k].counts.over40)}\n      ${JSON.stringify(res[v][k].examples)}`); }
console.log('\nHarvard explanation (new):\n '+res.new.harvard_explain.join('\n '));
console.log('page errors old/new:',res.old.pageErrors.length,res.new.pageErrors.length);
await b.close(); srv.close();
