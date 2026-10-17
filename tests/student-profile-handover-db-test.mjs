// Migration 025: parents can edit the student's profile; pending grades survive the student joining.
// Run: node tests/student-profile-handover-db-test.mjs   (needs: npm i --no-save @electric-sql/pglite)
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
const DIR = new URL('../', import.meta.url).pathname;
const STUB = `
create function public.gen_random_bytes(n int) returns bytea language sql volatile as $$ select substring(decode(md5(random()::text)||md5(random()::text),'hex') from 1 for n) $$;
create schema auth; create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
create role anon; create role authenticated;
create schema storage; create table storage.buckets(id text primary key, name text, public boolean);
create table storage.objects(bucket_id text, name text); alter table storage.objects enable row level security;
create function storage.foldername(n text) returns text[] language sql as $$ select string_to_array(n,'/') $$;
grant usage on schema public, auth, storage to anon, authenticated;`;
const GRANTS = `grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;`;
const DAD='aaaaaaaa-0000-0000-0000-00000000000a', ZOE='bbbbbbbb-0000-0000-0000-00000000000b', EVE='cccccccc-0000-0000-0000-00000000000c', MOM='dddddddd-0000-0000-0000-00000000000d';
const files = fs.readdirSync(DIR).filter(f => /^migration-\d+.*\.sql$/.test(f)).sort();
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };
async function fresh(upTo) {
  const db = new PGlite(); await db.exec(STUB);
  const run = async f => db.exec(fs.readFileSync(DIR + f, 'utf8').replace(/create extension[^;]*;/gi, ''));
  for (const f of files.filter(f => !f.startsWith('migration-029') && !/^migration-02[67]/.test(f))) await run(f);
  await db.exec(GRANTS);   // Supabase hands out default grants when objects are created; migration 025 then tightens its own functions
  if (upTo !== 'before') for (const f of files.filter(f => f.startsWith('migration-029'))) await run(f);
  await db.exec(`alter table auth.users disable trigger user; alter table auth.users disable trigger enforce_beta_gate;`).catch(()=>{}); await db.exec(`insert into auth.users(id) values ('${DAD}'),('${ZOE}'),('${EVE}'),('${MOM}');`); return db;
}
const as = async (db, uid, sql) => { await db.exec(`set test.uid='${uid}'; set role authenticated;`); try { return await db.query(sql); } finally { await db.exec('reset role;'); } };
const tryas = async (db, uid, sql) => { try { const r = await as(db, uid, sql); return { r }; } catch (e) { return { e: e.message }; } };
const GRADES = `{"gpa":"3.8","sat":"1400","major":"Biology","notes":"loves ecology","rigor":{"ap":4,"honors":3},"activities":[{"name":"Soccer"}],"test_optional":false,"hs":{"name":"West High"}}`;

// ---- BEFORE the fix: prove the bug is real --------------------------------------------------------------------
{ const db = await fresh('before');
  const fam = (await as(db, DAD, `select public.create_family('Arthur','Dad') id`)).rows[0].id;
  const code = (await db.query(`select invite_code c from families where id='${fam}'`)).rows[0].c;
  await as(db, ZOE, `select public.join_family('${code}','Zoe','student')`);
  const r = await tryas(db, DAD, `insert into profiles(user_id,family_id,gpa) values ('${ZOE}','${fam}','3.9')`);
  ok(r.e, 'BEFORE fix: a parent must NOT yet be able to write the student profile (proves the bug)'); }

// ---- AFTER the fix ---------------------------------------------------------------------------------------------
const db = await fresh('after');
const fam = (await as(db, DAD, `select public.create_family('Arthur','Dad') id`)).rows[0].id;
const code = (await db.query(`select invite_code c from families where id='${fam}'`)).rows[0].c;
await db.exec(`insert into pending_students(family_id,display_name,profile,created_by) values ('${fam}','Zoe','${GRADES}'::jsonb,'${DAD}')`);
await as(db, MOM, `select public.join_family('${code}','Mom','parent')`);
ok((await db.query(`select count(*)::int n from pending_students`)).rows[0].n === 1, 'a parent joining must not touch the pending grades');
await as(db, ZOE, `select public.join_family('${code}','Zoe','student')`);
const p = (await db.query(`select * from profiles where user_id='${ZOE}'`)).rows[0];
ok(p && p.gpa === '3.8' && p.sat === '1400' && p.major === 'Biology' && p.notes === 'loves ecology', 'pending grades are copied to Zoe on join');
ok(p && p.rigor && p.rigor.ap === 4 && Array.isArray(p.activities) && p.activities.length === 1 && p.test_optional === false && p.hs.name === 'West High', 'rigor, activities, test-optional and school carried over');
ok(p && p.family_id === fam, 'copied profile belongs to the family');
ok((await db.query(`select count(*)::int n from pending_students`)).rows[0].n === 0, 'pending row removed only after the copy');
// parent adjusts after join (update + insert paths)
let r = await tryas(db, DAD, `update profiles set gpa='3.9' where user_id='${ZOE}' returning gpa`);
ok(r.r && r.r.rows.length === 1 && r.r.rows[0].gpa === '3.9', 'parent can adjust the student\'s grades after she joined');
r = await tryas(db, MOM, `update profiles set sat='1450' where user_id='${ZOE}' returning sat`);
ok(r.r && r.r.rows.length === 1, 'the other parent can adjust too');
// student keeps control of her own profile and cannot be locked out
r = await tryas(db, ZOE, `update profiles set gpa='4.0' where user_id='${ZOE}' returning gpa`);
ok(r.r && r.r.rows.length === 1, 'student can still edit her own profile');
// nobody can delete grades
r = await tryas(db, ZOE, `delete from profiles where user_id='${ZOE}' returning 1`);
ok(!r.r || r.r.rows.length === 0, 'student cannot delete (cancel) the profile'); 
r = await tryas(db, DAD, `delete from profiles where user_id='${ZOE}' returning 1`);
ok(!r.r || r.r.rows.length === 0, 'parent cannot delete the profile either');
ok((await db.query(`select count(*)::int n from profiles where user_id='${ZOE}'`)).rows[0].n === 1, 'profile still exists after delete attempts');
// outsiders and cross-family writes are blocked
r = await tryas(db, EVE, `update profiles set gpa='1.0' where user_id='${ZOE}' returning 1`);
ok(!r.r || r.r.rows.length === 0, 'someone outside the family cannot edit');
const fam2 = (await as(db, EVE, `select public.create_family('Other','Eve') id`)).rows[0].id;
r = await tryas(db, EVE, `insert into profiles(user_id,family_id,gpa) values ('${ZOE}','${fam2}','1.0')`);
ok(r.e, 'a parent of another family cannot write into this student\'s profile');
r = await tryas(db, DAD, `update profiles set family_id='${fam2}' where user_id='${ZOE}' returning 1`);
ok(r.e || r.r.rows.length === 0, 'a profile cannot be moved to another family');
// parent entering grades for a student who joined with NO pending grades (the exact situation in production)
const db2 = await fresh('after');
const f3 = (await as(db2, DAD, `select public.create_family('Arthur','Dad') id`)).rows[0].id;
const c3 = (await db2.query(`select invite_code c from families where id='${f3}'`)).rows[0].c;
await as(db2, ZOE, `select public.join_family('${c3}','Zoe','student')`);
r = await tryas(db2, DAD, `insert into profiles(user_id,family_id,gpa,sat) values ('${ZOE}','${f3}','3.7','1380') on conflict (user_id) do update set gpa=excluded.gpa, sat=excluded.sat returning gpa`);
ok(r.r && r.r.rows[0].gpa === '3.7', 'parent can ADD grades for a student who already joined (upsert, as the app does)');
// joining with an empty pending profile, or no pending row, still works
const db3 = await fresh('after');
const f4 = (await as(db3, DAD, `select public.create_family('Arthur','Dad') id`)).rows[0].id;
const c4 = (await db3.query(`select invite_code c from families where id='${f4}'`)).rows[0].c;
await db3.exec(`insert into pending_students(family_id,display_name,profile) values ('${f4}','Zoe','{}'::jsonb)`);
await as(db3, ZOE, `select public.join_family('${c4}','Zoe','student')`);
ok((await db3.query(`select count(*)::int n from profiles`)).rows[0].n === 0 && (await db3.query(`select count(*)::int n from pending_students`)).rows[0].n === 0, 'empty pending profile: join works, no blank profile row, pending cleared');
// the anon role can no longer call join_family
r = await tryas(db3, '00000000-0000-0000-0000-000000000000', `select 1`);
await db3.exec(`set role anon;`); let anonErr = null; try { await db3.query(`select public.join_family('x','y','student')`); } catch (e) { anonErr = e.message; } await db3.exec('reset role;');
ok(anonErr && /permission denied/i.test(anonErr), 'signed-out visitors cannot call join_family');
// ---- edit history (migration 028) works when a PARENT edits the STUDENT's grades ------------------------------------------
r = await tryas(db, DAD, `insert into profile_edits(family_id,profile_owner,edited_by,edited_by_name,field,old_value,new_value) values ('${fam}','Zoe','${DAD}','Dad','GPA','3.8','3.9') returning id`);
ok(r.r && r.r.rows.length === 1, 'a parent can log an edit made to the student\'s profile');
r = await tryas(db, DAD, `insert into profile_edits(family_id,profile_owner,edited_by,edited_by_name,field,old_value,new_value) values ('${fam}','Zoe','${MOM}','Mom','GPA','3.8','3.9')`);
ok(r.e, 'an edit cannot be logged under someone else\'s id');
r = await tryas(db, ZOE, `insert into profile_edits(family_id,profile_owner,edited_by,edited_by_name,field,old_value,new_value) values ('${fam}','Zoe','${ZOE}','Zoe','SAT','1400','1450') returning id`);
ok(r.r && r.r.rows.length === 1, 'the student can log her own edits');
r = await tryas(db, ZOE, `select edited_by_name from profile_edits order by created_at`);
ok(r.r && r.r.rows.length === 2 && r.r.rows[0].edited_by_name === 'Dad', 'the student can read who changed her grades');
r = await tryas(db, EVE, `select * from profile_edits`);
ok(r.r && r.r.rows.length === 0, 'someone outside the family cannot read the history');
r = await tryas(db, DAD, `update profile_edits set new_value='4.0' where edited_by='${DAD}' returning 1`);
ok(!r.r || r.r.rows.length === 0, 'a logged edit cannot be changed');
r = await tryas(db, DAD, `delete from profile_edits returning 1`);
ok(!r.r || r.r.rows.length === 0, 'a logged edit cannot be deleted');
r = await tryas(db, EVE, `insert into profile_edits(family_id,profile_owner,edited_by,field) values ('${fam}','Zoe','${EVE}','GPA')`);
ok(r.e, 'someone outside the family cannot write into this family\'s history');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
