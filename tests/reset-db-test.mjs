// Practice run of the fresh-start reset on a full copy of the schema (PGlite). Run: node tests/reset-db-test.mjs
import { PGlite } from '@electric-sql/pglite'; import fs from 'fs';
const APP='/home/claude/zoescolleges-app/';
const STUB=`create function public.gen_random_bytes(n int) returns bytea language sql volatile as $$ select substring(decode(md5(random()::text)||md5(random()::text),'hex') from 1 for n) $$;
create schema auth; create table auth.users(id uuid primary key, email text, created_at timestamptz default now(), last_sign_in_at timestamptz, raw_user_meta_data jsonb default '{}');
create table auth.identities(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
create role anon; create role authenticated;
create schema storage; create table storage.buckets(id text primary key, name text, public boolean);
create table storage.objects(bucket_id text, name text); alter table storage.objects enable row level security;
create function storage.foldername(n text) returns text[] language sql as $$ select string_to_array(n,'/') $$;
grant usage on schema public, auth, storage to anon, authenticated;`;
const db=new PGlite(); await db.exec(STUB); const _ex=db.exec.bind(db); let STEP=0; db.exec=async(s)=>{ STEP++; try{ return await _ex(s); }catch(e){ console.log('STEP',STEP,'FAILED:',e.message,'::',String(s).slice(0,120).replace(/\n/g,' ')); throw e; } };
for (const f of fs.readdirSync(APP).filter(f=>/^migration-0\d\d-.*\.sql$/.test(f)).sort()) await db.exec(fs.readFileSync(APP+f,'utf8').replace(/create extension[^;]*;/gi,''));
await db.exec(`create table public.ai_usage(user_id uuid references auth.users(id) on delete cascade, question_date date, n int);`);
await db.exec(`insert into private.beta_codes(code,note) values ('TESTCODE','x'); alter table auth.users disable trigger enforce_beta_gate;`);
const U=['aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','cccccccc-0000-0000-0000-000000000003'];
for (const [i,u] of U.entries()) await db.exec(`insert into auth.users(id,email,raw_user_meta_data) values ('${u}','p${i}@x.com','{"join_code":"x"}'); insert into auth.identities(user_id) values ('${u}');`);
const cols=async t=>(await db.query(`select column_name, is_nullable, column_default from information_schema.columns where table_schema='public' and table_name='${t}'`)).rows;
// families + data
const fam=(await db.query(`insert into public.families(name, created_by) values ('Arthur Family','${U[0]}'),('Test Fam','${U[2]}') returning id`)).rows.map(r=>r.id);
await db.exec(`insert into public.members(user_id,family_id,display_name,role) values ('${U[0]}','${fam[0]}','Obie','parent'),('${U[1]}','${fam[0]}','Zoe','student'),('${U[2]}','${fam[1]}','T','parent');`).catch(async e=>{ console.log('members cols', await cols('members')); throw e; });
await db.exec(`insert into public.family_schools(family_id,school_id,name,added_by) values ('${fam[0]}','sc-1','A','${U[0]}'),('${fam[0]}','sc-2','B','${U[0]}'),('${fam[1]}','sc-3','C','${U[2]}');`).catch(async e=>{ console.log('fs cols', await cols('family_schools')); throw e; });
await db.exec(`insert into public.ratings(family_id,school_id,user_id,rating) values ('${fam[0]}','sc-1','${U[0]}',4);`).catch(async e=>{ console.log('ratings cols', await cols('ratings')); throw e; });
await db.exec(`insert into public.profiles(user_id,family_id,gpa) values ('${U[1]}','${fam[0]}','3.7');`).catch(async e=>{ console.log('profiles cols', await cols('profiles')); throw e; });
await db.exec(`insert into public.ai_usage values ('${U[0]}', current_date, 2);`);
const before=(await db.query(`select (select count(*) from auth.users)::int u,(select count(*) from public.families)::int f,(select count(*) from public.family_schools)::int s,(select count(*) from public.ratings)::int r,(select count(*) from public.profiles)::int p,(select count(*) from public.members)::int m,(select count(*) from auth.identities)::int i`)).rows[0];
await db.exec(`alter table auth.users enable trigger enforce_beta_gate;`);
const sql=fs.readFileSync('/tmp/claude-0/reset.sql','utf8');
let err=null; try{ await db.exec(sql); }catch(e){ err=e.message; console.log('RESET ERROR:', e.message, e.where||''); await db.exec('rollback'); }
const after=(await db.query(`select (select count(*) from auth.users)::int u,(select count(*) from public.families)::int f,(select count(*) from public.family_schools)::int s,(select count(*) from public.ratings)::int r,(select count(*) from public.profiles)::int p,(select count(*) from public.members)::int m,(select count(*) from auth.identities)::int i,(select count(*) from private.beta_codes)::int codes`)).rows[0];
const bk=(await db.query(`select (select count(*) from backup_20261011.users)::int u,(select count(*) from backup_20261011.families)::int f,(select count(*) from backup_20261011.family_schools)::int s,(select count(*) from backup_20261011.ratings)::int r,(select count(*) from backup_20261011.profiles)::int p,(select count(*) from backup_20261011.members)::int m,(select count(*) from backup_20261011.ai_usage)::int a, (select email from backup_20261011.users order by email limit 1) e`)).rows[0];
// new sign-up afterwards: blocked without code, allowed with the kept code
let noCode=null, withCode=null;
try{ await db.exec(`insert into auth.users(id,email,raw_user_meta_data) values ('dddddddd-0000-0000-0000-000000000004','new@x.com','{}')`); noCode='created'; }catch(e){ noCode='blocked'; }
try{ await db.exec(`insert into auth.users(id,email,raw_user_meta_data) values ('eeeeeeee-0000-0000-0000-000000000005','new2@x.com','{"access_code":"testcode"}')`); withCode='created'; }catch(e){ withCode='blocked: '+e.message; }
// second run must refuse (backup schema tables already exist) without deleting anything
await db.exec(`insert into public.families(name, created_by) values ('After','eeeeeeee-0000-0000-0000-000000000005')`);
let rerun=null; try{ await db.exec(sql); rerun='ran'; }catch(e){ rerun='refused: '+e.message.split('\n')[0]; await _ex('rollback'); }
const afterRerun=(await db.query(`select count(*)::int n from public.families`)).rows[0].n;
const R={before,err,after,bk,noCode,withCode,rerun,afterRerun};
R.ok={ noError:!err, everythingBackedUp: bk.u===before.u&&bk.f===before.f&&bk.s===before.s&&bk.r===before.r&&bk.p===before.p&&bk.m===before.m&&bk.a===1&&bk.e==='p0@x.com',
  allAccountsGone: after.u===0&&after.i===0, allFamilyDataGone: after.f===0&&after.s===0&&after.r===0&&after.p===0&&after.m===0, betaCodeKept: after.codes===1,
  newSignupNeedsCode: noCode==='blocked'&&withCode==='created', secondRunCannotWipeAgain: rerun.startsWith('refused')&&afterRerun===1 };
R.allPass=Object.values(R.ok).every(Boolean); console.log(JSON.stringify(R,null,1));
