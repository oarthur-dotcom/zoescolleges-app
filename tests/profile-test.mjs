import { launch, newPage } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const CAT=fs.readFileSync('/home/claude/zoescolleges-data/colleges.json');
const srv=http.createServer((q,r)=>{const f=path.join('/tmp/claude-0/f10',decodeURIComponent(q.url.split('?')[0])); fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);return r.end();} r.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':'text/html'}); r.end(d);});}).listen(8781);
const b=await launch(); const out={};
for(const v of ['old','new']){
  const {ctx,page,log}=await newPage(b,{width:1280,height:900},{plan:'family'});
  await page.route(/jsdelivr.*colleges\.json/,r=>r.fulfill({contentType:'application/json',body:CAT}));
  await page.goto(`http://localhost:8781/${v}/index.html`); await page.waitForFunction(()=>typeof state!=="undefined"&&state.catalog&&state.catalog.length>0&&state.me,null,{timeout:60000}); await page.waitForTimeout(600);
  const r=await page.evaluate(async()=>{
    const res={}; const lastUp=()=>window.__writes.filter(w=>w.table==='profiles'&&w.op==='upsert').pop();
    const fill=(o)=>{ for(const [k,v] of Object.entries(o)){ const el=document.getElementById(k); if(!el) continue; if(el.type==='checkbox') el.checked=v; else el.value=v; } };
    window.alert=(m)=>{ res.alerted=m; };
    // A: valid save with an athlete
    fill({"pf-gpa":"3.8","pf-sat":"1450","pf-act":"","pf-major":"Biology","pf-rank":"","pf-state":"MA","pf-notes":"","pf-noTest":false,"pf-honors":"3","pf-ap":"5","pf-dual":"0","pf-hs":"West Rox High","pf-hs-ap":"12","pf-hs-honors":"6"});
    profActs=[{name:"Varsity soccer",category:"Athletics",tier:2,hrs:"10",yrs:"4",sport:"Soccer"}];
    window.__writes.length=0; await saveProfileForm();
    const u=lastUp(); res.A_savedToSharedProfile = u? Object.keys(u.p).filter(k=>['rigor','activities','test_optional','hs'].includes(k)) : 'no save';
    res.A_sportSaved = !!(u && u.p.activities && u.p.activities[0] && u.p.activities[0].sport==='Soccer') || !!((state.profiles[state.me.user_id].activities||[])[0]||{}).sport;
    // B: impossible GPA
    fill({"pf-gpa":"9.9"}); window.__writes.length=0; await saveProfileForm();
    res.B_gpa99_blocked = !lastUp(); res.B_message = (document.getElementById('pf-savemsg')||{}).textContent||'';
    fill({"pf-gpa":"3.8","pf-sat":"2400"}); window.__writes.length=0; await saveProfileForm(); res.B_sat2400_blocked=!lastUp();
    fill({"pf-sat":"1450"});
    // C: database without the new columns yet -> save must still succeed
    const realFrom=sb.from.bind(sb); let attempts=[];
    sb.from=(t)=>{ const q=realFrom(t); if(t!=='profiles') return q; const up=q.upsert.bind(q); q.upsert=(row)=>{ attempts.push(Object.keys(row).includes('hs')); if('hs' in row) return Promise.resolve({data:null,error:{message:"Could not find the 'hs' column of 'profiles' in the schema cache"}}); return up(row); }; return q; };
    res.alerted=undefined; await saveProfileForm(); sb.from=realFrom;
    res.C_oldDatabase = {attemptsWithNewColumns:attempts, alertShown:res.alerted||null};
    // D: another member's shared profile is used for chances
    const other='other-user'; state.profiles[other]={user_id:other, gpa:'3.9', test_optional:true, rigor:{ap:8}, hs:{apOffered:10}}; hydrateLocalProfile();
    res.D_otherMemberTestOptional = state.profiles[other].testOptional===true;
    // E: anchor note
    const stu=state.members.find(m=>m.role==='student'); res.E_hasStudentMember=!!stu;
    const saved=JSON.stringify(state.profiles); if(stu) delete state.profiles[stu.user_id];
    res.E_anchorNote = (document.createElement('div').innerHTML=anchorNoteHtml()) && anchorNoteHtml().replace(/<[^>]+>/g,'').slice(0,110);
    state.profiles=JSON.parse(saved);
    // F: Zoe state parsing
    const t=x=>{ const h=zoeData(x); return h? h.replace(/<[^>]+>/g,'').slice(0,70) : null; };
    res.F_cheapest_in_my_area = t("cheapest schools in my area"); res.F_cheapest_in_co = t("cheapest schools in co");
    return res; });
  r.pageErrors=log.pageerr; out[v]=r; await ctx.close();
}
console.log(JSON.stringify(out,null,1)); fs.writeFileSync('/tmp/claude-0/f10/result.json',JSON.stringify(out,null,1)); await b.close(); srv.close();
