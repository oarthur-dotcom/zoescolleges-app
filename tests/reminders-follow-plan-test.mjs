// Oct 28: email reminders follow the plan a family chose for a school (checklist._plan); no choice / stale choice = every date. No DB change.
import fs from 'fs';
const { runReminders, buildEmail } = await import('../netlify/functions/deadline-reminders.mjs');
const { deadlineList } = await import('../netlify/lib/deadlines.mjs');
const DATA = process.env.ZC_DATA || '/home/claude/zoescolleges-data';
const CAT = fs.readFileSync(DATA+'/colleges.json','utf8'), DLF = fs.readFileSync(DATA+'/deadlines-2026-27.json','utf8');
const dlmap = JSON.parse(DLF).schools; const ELON='sc-198516';
const R={}; let bad=0; const ok=(n,c,x)=>{ R[n]=!!c; if(!c){ bad++; console.log('FAIL:',n,x??''); } };
// the lib
const info={id:ELON,name:'Elon University'}; const all=deadlineList(info, dlmap[ELON]);
ok('lib_no_choice_all_rounds', all.length>=4, all.length);
ok('lib_choice_returns_only_that_round', deadlineList(info, dlmap[ELON], 'Early Action|2026-11-01').length===1 && deadlineList(info, dlmap[ELON], 'Early Action|2026-11-01')[0].kind==='Early Action');
ok('lib_stale_choice_returns_all', deadlineList(info, dlmap[ELON], 'Early Action|2025-11-01').length===all.length);
ok('lib_garbage_choice_returns_all', deadlineList(info, dlmap[ELON], 'nonsense').length===all.length);
// the job
const FAM='fam-1', U='user-on';
function world(checklist, withColumn=true){ return { prefs:[{user_id:U,family_id:FAM,email_on:true}], board:[{family_id:FAM,school_id:ELON,name:'Elon University', ...(checklist!==undefined?{checklist}:{})}], withColumn, log:[], nextId:1, emails:[] }; }
function fake(W){ return async (url,opts={})=>{ url=String(url); const m=opts.method||'GET'; const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s});
  if(url.includes('deadlines-2026-27.json')) return new Response(DLF,{status:200}); if(url.includes('colleges.json')) return new Response(CAT,{status:200});
  if(url.startsWith('https://api.resend.com/emails')){ W.emails.push(JSON.parse(opts.body)); return J({id:'e'}); }
  const u=new URL(url); if(u.pathname.startsWith('/auth/v1/admin/users/')) return J({id:U,email:'dad@example.org'});
  const t=u.pathname.replace('/rest/v1/','');
  if(t==='reminder_prefs') return J(W.prefs); if(t==='family_schools'){ const sel=u.searchParams.get('select')||''; if(sel.includes('checklist') && !W.withColumn) return new Response('column family_schools.checklist does not exist',{status:400}); return J(W.board.map(b=>{ const o={...b}; if(!sel.includes('checklist')) delete o.checklist; return o; })); }
  if(t==='reminder_log' && m==='GET') return J(W.log);
  if(t==='reminder_log' && m==='POST'){ const rows=JSON.parse(opts.body); const ins=rows.map(r=>({...r,id:W.nextId++})); W.log.push(...ins); return J(ins,201); }
  if(t==='reminder_log' && m==='DELETE'){ return new Response(null,{status:204}); }
  return J({msg:'unexpected '+t},599); }; }
const quiet={log(){},error(){}}; const ENV={SUPABASE_SERVICE_ROLE_KEY:'svc',RESEND_API_KEY:'re',REMINDERS_LIVE:'yes'};
// Nov 1, 2026 deadlines: on Oct 29 (3 days out) a no-choice family gets ED and EA; a family that chose EA gets only EA
const at=d=>new Date(d+'T13:00:00Z');
let W=world({}); let s=await runReminders({env:ENV,fetchImpl:fake(W),now:at('2026-10-29'),log:quiet});
const kinds=W.log.map(x=>x.kind).sort().join('|');
ok('job_no_choice_reminds_every_round', /Early Action/.test(kinds) && /Early Decision/.test(kinds), kinds);
W=world({_plan:'Early Action|2026-11-01'}); s=await runReminders({env:ENV,fetchImpl:fake(W),now:at('2026-10-29'),log:quiet});
ok('job_chosen_plan_only', W.log.length===1 && W.log[0].kind==='Early Action' && W.log[0].deadline_date==='2026-11-01', JSON.stringify(W.log.map(x=>[x.kind,x.deadline_date])));
ok('job_email_says_which_plan', W.emails.length===1 && /Early Action/.test(W.emails[0].text) && !/Early Decision deadline/.test(W.emails[0].text), W.emails[0]&&W.emails[0].text);
W=world({_plan:'Early Decision|2026-11-01'}); await runReminders({env:ENV,fetchImpl:fake(W),now:at('2026-10-29'),log:quiet});
ok('job_chosen_binding_plan_only', W.log.length===1 && W.log[0].kind==='Early Decision', JSON.stringify(W.log.map(x=>x.kind)));
W=world({_plan:'Early Action|2025-11-01'}); await runReminders({env:ENV,fetchImpl:fake(W),now:at('2026-10-29'),log:quiet});
ok('job_stale_choice_reminds_every_round', W.log.length>=2, W.log.length);
W=world({_plan:'Regular Decision|2027-01-10'}); await runReminders({env:ENV,fetchImpl:fake(W),now:at('2026-10-29'),log:quiet});
ok('job_chosen_later_plan_ignores_nov1', W.log.length===0, JSON.stringify(W.log.map(x=>x.kind)));
W=world({_plan:'Early Action|2026-11-01'}, false); s=await runReminders({env:ENV,fetchImpl:fake(W),now:at('2026-10-29'),log:quiet});
ok('job_no_checklist_column_falls_back_to_every_date', s.errors.length===0 && W.log.length>=2, JSON.stringify([s.errors,W.log.length]));
W=world(undefined); await runReminders({env:ENV,fetchImpl:fake(W),now:at('2026-10-29'),log:quiet});
ok('job_row_without_checklist_every_date', W.log.length>=2);
const mail=buildEmail([{schoolName:'Elon University',kind:'Early Action',date:'2026-11-01',daysLeft:3}]);
ok('email_explains_plan_rule', /follow that plan/.test(mail.html) && /Reminders follow the plan your family chose/.test(mail.text));
console.log(JSON.stringify(R,null,1)); console.log(bad?`${bad} FAILED`:'ALL PASS'); process.exit(bad?1:0);
