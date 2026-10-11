import { PGlite } from '@electric-sql/pglite'; import fs from 'fs';
const APP='/home/claude/zoescolleges-app/';
const A='aaaaaaaa-0000-0000-0000-000000000001', B='bbbbbbbb-0000-0000-0000-000000000002';
async function run(withFix){
  const db=new PGlite();
  await db.exec(`create function public.gen_random_bytes(n int) returns bytea language sql volatile as $$ select substring(decode(md5(random()::text)||md5(random()::text),'hex') from 1 for n) $$;
  create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
  create role anon; create role authenticated; create schema storage; create table storage.buckets(id text primary key, name text, public boolean);
  create table storage.objects(bucket_id text, name text); alter table storage.objects enable row level security;
  create function storage.foldername(n text) returns text[] language sql as $$ select string_to_array(n,'/') $$;
  grant usage on schema public, auth, storage to anon, authenticated;`);
  for(const f of ['001-core','002-profiles-photos']) await db.exec(fs.readFileSync(`${APP}migration-${f}.sql`,'utf8').replace(/create extension[^;]*;/gi,''));
  await db.exec(`grant select, insert, update, delete on all tables in schema public, storage to anon, authenticated; grant execute on all functions in schema public to anon, authenticated; insert into auth.users values ('${A}'),('${B}');`);
  if(withFix) await db.exec(fs.readFileSync(`${APP}migration-009-private-photos.sql`,'utf8'));
  const as=async(uid,role,sql)=>{ await db.exec(`set test.uid='${uid}'; set role ${role};`); try{ return (await db.query(sql)).rows; }catch(e){ return 'ERR '+e.message; } finally{ await db.exec('reset role'); } };
  const FA=(await as(A,'authenticated',`select public.create_family('A','a') id`))[0].id; await as(B,'authenticated',`select public.create_family('B','b') id`);
  await db.exec(`insert into storage.objects values ('campus-photos','${FA}/sc-1/photo.jpg')`);
  return { ownFamilySees:(await as(A,'authenticated',`select name from storage.objects`)).length, otherFamilySees:(await as(B,'authenticated',`select name from storage.objects`)).length, anonymousSees:(await as('','anon',`select name from storage.objects`)).length };
}
console.log(JSON.stringify({BEFORE:await run(false), AFTER:await run(true)}));
