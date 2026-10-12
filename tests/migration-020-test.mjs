import { PGlite } from '@electric-sql/pglite'; import fs from 'fs';
const APP='/home/claude/zoescolleges-app/';
const STUB=`create function public.gen_random_bytes(n int) returns bytea language sql volatile as $$ select substring(decode(md5(random()::text)||md5(random()::text),'hex') from 1 for n) $$;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
create role anon; create role authenticated; create schema storage; create table storage.buckets(id text primary key, name text, public boolean);
create table storage.objects(bucket_id text, name text); alter table storage.objects enable row level security;
create function storage.foldername(n text) returns text[] language sql as $$ select string_to_array(n,'/') $$;
grant usage on schema public, auth, storage to anon, authenticated;`;
const A='aaaaaaaa-0000-0000-0000-000000000001'; const r={};
const db=new PGlite(); await db.exec(STUB);
for (const f of ['001-core','002-profiles-photos','003-rigor-activities','004-binder-shares','006-lock-family-policies']) await db.exec(fs.readFileSync(`${APP}migration-${f}.sql`,'utf8').replace(/create extension[^;]*;/gi,''));
await db.exec(`insert into auth.users values ('${A}')`);
const fa=(await db.query(`insert into public.families(name,created_by) values('A','${A}') returning id`)).rows[0].id;
await db.exec(`insert into public.ratings(family_id,school_id,user_id,rating,note) values('${fa}','s1','${A}',4,'kept')`);
const sql=fs.readFileSync(`${APP}migration-020-half-stars.sql`,'utf8');
try{ await db.exec(sql); r.runs=true; }catch(e){ r.runs=e.message; }
try{ await db.exec(sql); r.runsTwice=true; }catch(e){ r.runsTwice=e.message; }
const row=(await db.query(`select rating::text t, note from public.ratings`)).rows[0]; r.existingKept = row.t==='4.0' && row.note==='kept';
const ok=async v=>{ try{ await db.exec(`update public.ratings set rating=${v}`); return true; }catch(e){ return false; } };
r.half45 = await ok(4.5); r.half35 = await ok(3.5); r.one = await ok(1); r.five = await ok(5);
r.rejects475 = !(await ok(4.75)); r.rejects55 = !(await ok(5.5)); r.rejects05 = !(await ok(0.5)); r.nullOk = await ok('null');
const allPass=Object.values(r).every(v=>v===true); console.log(JSON.stringify(r,null,1)); console.log(JSON.stringify({allPass}));
