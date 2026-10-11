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
grant usage on schema public, auth, storage to anon, authenticated;
`;
const GRANTS = `grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;`;  // Supabase default grants
const A='aaaaaaaa-0000-0000-0000-000000000001', B='bbbbbbbb-0000-0000-0000-000000000002';
async function setup(withFix){
  const db = new PGlite(); await db.exec(STUB);
  for (const f of ['001-core','002-profiles-photos','003-rigor-activities','004-binder-shares']) await db.exec(fs.readFileSync(`${APP}migration-${f}.sql`,'utf8').replace(/create extension[^;]*;/gi,''));
  await db.exec(GRANTS);
  await db.exec(`insert into auth.users values ('${A}'),('${B}');`);
  if (withFix) await db.exec(fs.readFileSync(`${APP}migration-006-lock-family-policies.sql`,'utf8'));
  return db;
}
async function as(db, uid, sql){ await db.exec(`set test.uid='${uid}'; set role authenticated;`);
  try { const r = await db.query(sql); return {ok:true, rows:r.affectedRows ?? r.rows.length, data:r.rows}; }
  catch(e){ return {ok:false, err:e.message.split('\n')[0]}; } finally { await db.exec('reset role'); } }
const results = {};
for (const withFix of [false, true]) {
  const db = await setup(withFix); const out = {};
  const FA = (await as(db, A, `select public.create_family('Fam A','Obie') as id`)).data[0].id;
  const FB = (await as(db, B, `select public.create_family('Fam B','Other') as id`)).data[0].id;
  const fbCode = (await db.query(`select invite_code from families where id='${FB}'`)).rows[0].invite_code;
  // ATTACKS (A tries to get into B's family / upgrade for free)
  out.hop_family     = await as(db, A, `update members set family_id='${FB}' where user_id='${A}'`);
  out.free_upgrade   = await as(db, A, `update families set plan='family_plus' where id='${FA}'`);
  out.steal_code     = await as(db, A, `update families set invite_code='hacked' where id='${FA}'`);
  await db.exec(`reset role`);
  out.after_hop_A_family = (await db.query(`select family_id='${FB}' as in_b from members where user_id='${A}'`)).rows[0].in_b ? 'A IS NOW IN FAMILY B' : 'A still in own family';
  out.after_plan = (await db.query(`select plan from families where id='${FA}'`)).rows[0].plan;
  // reset A to own family for the remaining checks (as owner)
  await db.exec(`update members set family_id='${FA}' where user_id='${A}'`);
  await as(db, A, `insert into family_schools(family_id,school_id,name,added_by) values ('${FA}','sc-1','X','${A}')`);
  await as(db, A, `insert into ratings(family_id,school_id,user_id,rating) values ('${FA}','sc-1','${A}',4)`);
  out.move_rating    = await as(db, A, `update ratings set family_id='${FB}' where user_id='${A}'`);
  // NORMAL APP ACTIONS must still work
  out.app_change_role  = await as(db, A, `update members set role='student' where user_id='${A}'`);
  out.app_rate_upsert  = await as(db, A, `insert into ratings(family_id,school_id,user_id,rating) values ('${FA}','sc-1','${A}',5) on conflict (family_id,school_id,user_id) do update set rating=excluded.rating`);
  out.app_profile_upsert = await as(db, A, `insert into profiles(user_id,family_id,gpa) values ('${A}','${FA}',3.8) on conflict (user_id) do update set gpa=excluded.gpa`);
  out.app_profile_again  = await as(db, A, `insert into profiles(user_id,family_id,gpa) values ('${A}','${FA}',3.9) on conflict (user_id) do update set gpa=excluded.gpa`);
  out.profile_hop   = await as(db, A, `update profiles set family_id='${FB}' where user_id='${A}'`);
  out.app_prefs_upsert = await as(db, A, `insert into preferences(user_id,family_id,weights) values ('${A}','${FA}','{}') on conflict (user_id) do update set weights=excluded.weights`);
  out.app_read_family  = await as(db, A, `select plan from families`);
  // a third user joins B legitimately with the code
  await db.exec(`insert into auth.users values ('cccccccc-0000-0000-0000-000000000003')`);
  out.app_join_with_code = await as(db, 'cccccccc-0000-0000-0000-000000000003', `select public.join_family('${fbCode}','Kid','student')`);
  results[withFix ? 'WITH_FIX' : 'BEFORE_FIX'] = out;
}
console.log(JSON.stringify(results, null, 1));
