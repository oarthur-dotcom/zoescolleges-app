import { PGlite } from '@electric-sql/pglite'; import fs from 'fs';
const APP='/home/claude/zoescolleges-app/'; const A='aaaaaaaa-0000-0000-0000-000000000001', B='bbbbbbbb-0000-0000-0000-000000000002';
const db=new PGlite();
await db.exec(`create function public.gen_random_bytes(n int) returns bytea language sql volatile as $$ select substring(decode(md5(random()::text)||md5(random()::text),'hex') from 1 for n) $$;
create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
create role anon; create role authenticated; grant usage on schema public, auth to anon, authenticated;`);
await db.exec(fs.readFileSync(APP+'migration-001-core.sql','utf8').replace(/create extension[^;]*;/gi,''));
await db.exec(fs.readFileSync(APP+'migration-010-deadline-reminders.sql','utf8'));
await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated; grant execute on all functions in schema public to anon, authenticated; insert into auth.users values ('${A}'),('${B}');`);
const as=async(uid,sql)=>{ await db.exec(`set test.uid='${uid}'; set role authenticated;`); try{ const r=await db.query(sql); return r.rows.length?r.rows:'ok'; }catch(e){ return 'DENIED'; } finally{ await db.exec('reset role'); } };
const FA=(await as(A,`select public.create_family('A','a') id`))[0].id, FB=(await as(B,`select public.create_family('B','b') id`))[0].id;
const out={
  turnOnOwn: await as(A,`insert into reminder_prefs(user_id,family_id,email_on) values ('${A}','${FA}',true)`),
  turnOffOwn: await as(A,`update reminder_prefs set email_on=false where user_id='${A}'`),
  readOwn: await as(A,`select email_on from reminder_prefs`),
  turnOnSomeoneElses: await as(A,`insert into reminder_prefs(user_id,family_id,email_on) values ('${B}','${FB}',true)`),
  defaultIsOff: (await db.query(`select column_default from information_schema.columns where table_name='reminder_prefs' and column_name='email_on'`)).rows[0].column_default,
  browserWritesSendLog: await as(A,`insert into reminder_log(user_id,family_id,school_id,kind,deadline_date,days_before) values ('${A}','${FA}','x','Regular','2026-11-01',30)`),
};
await db.exec(`insert into reminder_log(user_id,family_id,school_id,kind,deadline_date,days_before) values ('${B}','${FB}','x','Regular','2026-11-01',30)`);
out.readOthersSendLog = await as(A,`select * from reminder_log`);
try{ await db.exec(`insert into reminder_log(user_id,family_id,school_id,kind,deadline_date,days_before) values ('${B}','${FB}','x','Regular','2026-11-01',30)`); out.duplicateBlocked=false; }catch(e){ out.duplicateBlocked=true; }
console.log(JSON.stringify(out,null,1));
