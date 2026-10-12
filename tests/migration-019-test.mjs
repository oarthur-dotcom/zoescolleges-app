// Migration 019: old 001 visits table is set aside (renamed, rows kept), new shared visits table works with family-only access.
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
const APP = '/home/claude/zoescolleges-app/';
const STUB = `
create function public.gen_random_bytes(n int) returns bytea language sql volatile as $$ select substring(decode(md5(random()::text)||md5(random()::text),'hex') from 1 for n) $$;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
create role anon; create role authenticated;
create schema storage; create table storage.buckets(id text primary key, name text, public boolean);
create table storage.objects(bucket_id text, name text); alter table storage.objects enable row level security;
create function storage.foldername(n text) returns text[] language sql as $$ select string_to_array(n,'/') $$;
grant usage on schema public, auth, storage to anon, authenticated;`;
const GRANTS = `grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;`;
const A='aaaaaaaa-0000-0000-0000-000000000001', B='bbbbbbbb-0000-0000-0000-000000000002';
const r = {};
const db = new PGlite(); await db.exec(STUB);
for (const f of ['001-core','002-profiles-photos','003-rigor-activities','004-binder-shares','006-lock-family-policies'])
  await db.exec(fs.readFileSync(`${APP}migration-${f}.sql`,'utf8').replace(/create extension[^;]*;/gi,''));
await db.exec(GRANTS);
await db.exec(`insert into auth.users values ('${A}'),('${B}');`);
const fa = (await db.query(`insert into public.families(name,created_by) values('A fam','${A}') returning id`)).rows[0].id;
const fb = (await db.query(`insert into public.families(name,created_by) values('B fam','${B}') returning id`)).rows[0].id;
await db.exec(`insert into public.members(user_id,family_id,display_name) values('${A}','${fa}','A'),('${B}','${fb}','B');`);
// an old-style row in the 001 table (as if someone had one) must survive
await db.exec(`insert into public.visits(family_id,school_id,visit_date,notes,created_by) values('${fa}','166027','2026-09-01','old row','${A}')`);
const sql = fs.readFileSync(`${APP}migration-019-visits.sql`,'utf8');
try { await db.exec(sql); r.runs = true; } catch(e){ r.runs = e.message; }
try { await db.exec(sql); r.runsTwice = true; } catch(e){ r.runsTwice = e.message; }
await db.exec(GRANTS);
r.legacyKept = (await db.query(`select notes from public.visits_legacy_001`)).rows.map(x=>x.notes).join() === 'old row';
const cols = (await db.query(`select column_name from information_schema.columns where table_schema='public' and table_name='visits' order by 1`)).rows.map(x=>x.column_name).join(',');
r.newShape = cols === 'family_id,school_id,updated_at,updated_by,visit';
async function as(uid, q){ await db.exec(`set test.uid='${uid}'; set role authenticated;`);
  try { const x = await db.query(q); return {ok:true, n:x.affectedRows ?? x.rows.length, rows:x.rows}; } catch(e){ return {ok:false, err:e.message.split('\n')[0]}; } finally { await db.exec('reset role'); } }
const up = (fam, note) => `insert into public.visits(family_id,school_id,visit,updated_by) values('${fam}','166027','{"note":"${note}"}','${A}') on conflict (family_id,school_id) do update set visit=excluded.visit`;
r.ownInsert = (await as(A, up(fa,'first'))).ok;
r.ownUpsert = (await as(A, up(fa,'second'))).ok && (await as(A,`select visit->>'note' n from public.visits`)).rows[0]?.n === 'second';
r.otherCantRead = (await as(B, `select * from public.visits`)).n === 0;
r.otherCantWrite = !(await as(B, up(fa,'hack'))).ok;
r.otherCantDelete = (await as(B, `delete from public.visits where family_id='${fa}'`)).n === 0;
r.ownDelete = (await as(A, `delete from public.visits where school_id='166027'`)).n === 1;
const allPass = Object.values(r).every(v => v === true);
console.log(JSON.stringify(r, null, 1), allPass);
console.log(JSON.stringify({ allPass }));
