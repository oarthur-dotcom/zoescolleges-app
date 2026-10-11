import fs from 'fs';
const { runReminders, buildEmail } = await import('./netlify/functions/deadline-reminders.mjs');
const CAT = fs.readFileSync('/home/claude/zoescolleges-data/colleges.json','utf8');
const cat = JSON.parse(CAT).colleges; const id = n => cat.find(c=>c.name===n).id;
const FAM='fam-1', U1='user-on', U2='user-off';
function makeWorld(){
  return { prefs:[{user_id:U1,family_id:FAM,email_on:true},{user_id:U2,family_id:FAM,email_on:false}],
    board:[{family_id:FAM,school_id:id('Clemson University'),name:'Clemson University'},{family_id:FAM,school_id:id('College of Charleston'),name:'College of Charleston'},{family_id:FAM,school_id:id('University of Arizona'),name:'University of Arizona'},{family_id:FAM,school_id:id('Massachusetts Institute of Technology'),name:'MIT'}],
    users:{[U1]:'zoe@example.org',[U2]:'dad@example.org'}, log:[], nextId:1, emails:[], resendFail:false };
}
function fakeFetch(W){
  return async (url, opts={}) => {
    url=String(url); const m=opts.method||'GET'; const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s});
    if(url.includes('colleges.json')) return new Response(CAT,{status:200});
    if(url.startsWith('https://api.resend.com/emails')){ if(W.resendFail) return new Response('boom',{status:500}); W.emails.push(JSON.parse(opts.body)); return J({id:'e'+W.emails.length}); }
    const u=new URL(url);
    if(u.pathname.startsWith('/auth/v1/admin/users/')){ const uid=u.pathname.split('/').pop(); return W.users[uid]?J({id:uid,email:W.users[uid]}):J({},404); }
    const t=u.pathname.replace('/rest/v1/','');
    if(t==='reminder_prefs') return J(W.prefs.filter(p=>p.email_on));
    if(t==='family_schools') return J(W.board);
    if(t==='reminder_log' && m==='GET'){ const uid=u.searchParams.get('user_id').replace('eq.',''); return J(W.log.filter(x=>x.user_id===uid)); }
    if(t==='reminder_log' && m==='POST'){ const rows=JSON.parse(opts.body); const ins=[]; for(const r of rows){ const k=[r.user_id,r.school_id,r.kind,r.deadline_date,r.days_before].join('|'); if(W.log.some(x=>[x.user_id,x.school_id,x.kind,x.deadline_date,x.days_before].join('|')===k)) continue; const row={...r,id:W.nextId++}; W.log.push(row); ins.push(row);} return J(ins,201); }
    if(t==='reminder_log' && m==='DELETE'){ const ids=u.searchParams.get('id').replace(/^in\.\(|\)$/g,'').split(',').map(Number); W.log=W.log.filter(x=>!ids.includes(x.id)); return new Response(null,{status:204}); }
    return J({msg:'unexpected '+t},599);
  };
}
const quiet={log(){},error(){}}; const ENV={SUPABASE_SERVICE_ROLE_KEY:'svc',RESEND_API_KEY:'re',REMINDERS_LIVE:'yes'};
const at=d=>new Date(d+'T13:00:00Z'); const out={};
let W=makeWorld();
let s=await runReminders({env:ENV,fetchImpl:fakeFetch(W),now:at('2026-10-11'),log:quiet});
out['1_first_run_Oct11']={emails:W.emails.map(e=>({to:e.to,subject:e.subject})), loggedRows:W.log.length, summary:{people:s.people,emails:s.emails,items:s.items,errors:s.errors}};
out['1_email_lines']=W.emails[0]?W.emails[0].text.split('\n').slice(0,4):null;
s=await runReminders({env:ENV,fetchImpl:fakeFetch(W),now:at('2026-10-11'),log:quiet});
out['2_same_day_again']={newEmails:W.emails.length-1, summary:{emails:s.emails}};
s=await runReminders({env:ENV,fetchImpl:fakeFetch(W),now:at('2026-10-13'),log:quiet});
out['3_Oct13_three_day_window']={newEmail:W.emails[1]?W.emails[1].subject:null};
out['4_reminders_off_user_emailed']=W.emails.some(e=>e.to==='dad@example.org');
let W2=makeWorld(); s=await runReminders({env:{SUPABASE_SERVICE_ROLE_KEY:'svc'},fetchImpl:fakeFetch(W2),now:at('2026-10-11'),log:quiet});
out['5_dry_run']={emailsSent:W2.emails.length, logRows:W2.log.length, wouldEmail:s.emails, live:s.live};
let W3=makeWorld(); W3.resendFail=true; s=await runReminders({env:ENV,fetchImpl:fakeFetch(W3),now:at('2026-10-11'),log:quiet});
const logAfterFail=W3.log.length; W3.resendFail=false; s=await runReminders({env:ENV,fetchImpl:fakeFetch(W3),now:at('2026-10-11'),log:quiet});
out['6_email_service_down_then_retry']={logRowsAfterFailure:logAfterFail, sentOnRetry:W3.emails.length};
s=await runReminders({env:{},fetchImpl:fakeFetch(makeWorld()),now:at('2026-10-11'),log:quiet});
out['7_no_service_key']=s.errors;
const e=buildEmail([{schoolName:'<script>alert(1)</script> U',kind:'Regular',date:'2026-11-01',daysLeft:21}]);
out['8_html_escaped']=!e.html.includes('<script>') && e.html.includes('&lt;script&gt;');
out['9_timezone_late_night']=(await import('./netlify/functions/deadline-reminders.mjs')).todayET(new Date('2026-10-12T02:30:00Z'));
console.log(JSON.stringify(out,null,1));
