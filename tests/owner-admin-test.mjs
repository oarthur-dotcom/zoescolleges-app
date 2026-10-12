// owner-admin: only the owner gets data; plan and active changes work; bad input refused; nothing deletes.
import { handle } from './netlify/functions/owner-admin.mjs';
const OWNER={id:'00000000-0000-0000-0000-00000000000a',email:'oarthur@gmail.com',email_confirmed_at:'2026-10-01'};
const OTHER={id:'00000000-0000-0000-0000-00000000000b',email:'someone@example.com',email_confirmed_at:'2026-10-01'};
const FAM='11111111-1111-1111-1111-111111111111';
function fake(user){ const calls=[]; const f=async(url,opts={})=>{ calls.push({url,method:opts.method||'GET',body:opts.body});
  const J=(o,s=200)=>({ok:s<300,status:s,json:async()=>o,text:async()=>JSON.stringify(o)});
  if(url.endsWith('/auth/v1/user')) return user?J(user):J({},401);
  if(url.includes('/auth/v1/admin/users?')) return J({users:[{...OWNER,last_sign_in_at:new Date().toISOString()},{...OTHER,banned_until:'2999-01-01'}]});
  if(url.includes('/auth/v1/admin/users/')) return J({});
  if(url.includes('/rest/v1/families?select')) return J([{id:FAM,name:'The Arthur Clan',plan:'family_plus',invite_code:'abc',created_at:'2026-10-11'}]);
  if(url.includes('/rest/v1/members')) return J([{user_id:OWNER.id,family_id:FAM,role:'parent',display_name:'Obie'}]);
  if(url.includes('/rest/v1/family_schools')) return J([{family_id:FAM},{family_id:FAM}]);
  if(url.includes('/rest/v1/visits')) return J([],404);
  if(url.includes('/rest/v1/')) return opts.method==='PATCH'?{ok:true,status:204,json:async()=>[]}:J([]);
  return J({},404); }; return {f,calls}; }
const env={SUPABASE_SERVICE_ROLE_KEY:'srv'}; const log={log(){},error(){}}; const r={};
{ const {f}=fake(null); r.noToken=(await handle({action:'overview'},'',{env,fetchImpl:f,log}))[0]===401; }
{ const {f}=fake(OTHER); r.notOwner403=(await handle({action:'overview'},'t',{env,fetchImpl:f,log}))[0]===403; }
{ const {f}=fake({...OWNER,email_confirmed_at:null}); r.unconfirmedOwner403=(await handle({action:'overview'},'t',{env,fetchImpl:f,log}))[0]===403; }
{ const {f}=fake(OWNER); const [s,o]=await handle({action:'overview'},'t',{env,fetchImpl:f,log});
  r.overview=s===200 && o.totals.families===1 && o.totals.accounts===2 && o.totals.active===1 && o.families[0].schools===2 && o.families[0].visits===null && o.families[0].members[0].email==='oarthur@gmail.com' && o.accounts.find(a=>a.email===OTHER.email).active===false; }
{ const {f,calls}=fake(OWNER); const [s]=await handle({action:'setPlan',family_id:FAM,plan:'family'},'t',{env,fetchImpl:f,log}); const c=calls.find(x=>x.method==='PATCH');
  r.setPlan=s===200 && c && /families\?id=eq\./.test(c.url) && JSON.parse(c.body).plan==='family'; }
{ const {f}=fake(OWNER); r.badPlan=(await handle({action:'setPlan',family_id:FAM,plan:'gold'},'t',{env,fetchImpl:f,log}))[0]===400 && (await handle({action:'setPlan',family_id:"x' or 1=1",plan:'free'},'t',{env,fetchImpl:f,log}))[0]===400; }
{ const {f,calls}=fake(OWNER); const [s]=await handle({action:'setActive',user_id:OTHER.id,active:false},'t',{env,fetchImpl:f,log}); const c=calls.find(x=>x.method==='PUT');
  r.deactivate=s===200 && JSON.parse(c.body).ban_duration==='876000h'; }
{ const {f,calls}=fake(OWNER); await handle({action:'setActive',user_id:OTHER.id,active:true},'t',{env,fetchImpl:f,log}); r.reactivate=JSON.parse(calls.find(x=>x.method==='PUT').body).ban_duration==='none'; }
{ const {f}=fake(OWNER); r.cantDeactivateSelf=(await handle({action:'setActive',user_id:OWNER.id,active:false},'t',{env,fetchImpl:f,log}))[0]===400; }
{ const {f,calls}=fake(OWNER); await handle({action:'overview'},'t',{env,fetchImpl:f,log}); await handle({action:'setPlan',family_id:FAM,plan:'free'},'t',{env,fetchImpl:f,log}); r.neverDeletes=!calls.some(c=>c.method==='DELETE'); }
{ const {f}=fake(OWNER); r.noKey500=(await handle({action:'overview'},'t',{env:{},fetchImpl:f,log}))[0]===500; }
const allPass=Object.values(r).every(v=>v===true); console.log(JSON.stringify(r,null,1)); console.log(JSON.stringify({allPass}));
