import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
const APP = '/home/claude/zoescolleges-app/';
const db = new PGlite();
await db.exec(`create function public.gen_random_bytes(n int) returns bytea language sql volatile as $$ select substring(decode(md5(random()::text)||md5(random()::text),'hex') from 1 for n) $$;
create schema auth; create table auth.users(id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
create role anon; create role authenticated;`);
await db.exec(fs.readFileSync(APP+'migration-001-core.sql','utf8').replace(/create extension[^;]*;/gi,''));
// an existing user + family BEFORE the gate (must be unaffected)
await db.exec(`insert into auth.users(id,email) values ('aaaaaaaa-0000-0000-0000-000000000001','obie@x.com')`);
await db.exec(`set test.uid='aaaaaaaa-0000-0000-0000-000000000001'`); await db.query(`select public.create_family('Arthur','Obie')`);
const fam = (await db.query(`select invite_code, referral_code from families`)).rows[0];
const before = (await db.query(`select count(*)::int n from auth.users`)).rows[0].n;
await db.exec(fs.readFileSync(APP+'migration-007-server-beta-gate.sql','utf8'));
await db.exec(`insert into private.beta_codes(code,note) values ('NEWCODE26','test')`);
await db.exec(`insert into private.beta_codes(code,active) values ('OLDCODE',false)`);
const tryUser = async (label, meta) => { try { await db.query(`insert into auth.users(email, raw_user_meta_data) values ($1,$2)`, [label+'@t.com', meta]); return 'CREATED'; } catch(e){ return 'REJECTED ('+e.message.split(':')[0]+')'; } };
const out = {
  existing_users_untouched: (await db.query(`select count(*)::int n from auth.users`)).rows[0].n === before,
  no_code_api_signup:      await tryUser('nocode', {}),
  wrong_code:              await tryUser('wrong', {access_code:'ZOE2027'}),
  retired_code:            await tryUser('retired', {access_code:'OLDCODE'}),
  valid_code:              await tryUser('valid', {access_code:'NEWCODE26'}),
  valid_code_lowercase:    await tryUser('lower', {access_code:'newcode26 '}),
  family_invite_link:      await tryUser('invitee', {join_code: fam.invite_code}),
  fake_invite:             await tryUser('fakeinv', {join_code:'deadbeef0000'}),
  referral_link:           await tryUser('referred', {ref_code: fam.referral_code}),
  fake_referral:           await tryUser('fakeref', {ref_code:'zzzz'}),
};
await db.exec(`set role authenticated`);
try { await db.query(`select * from private.beta_codes`); out.browser_can_read_codes = 'YES (BAD)'; } catch(e){ out.browser_can_read_codes = 'no — '+e.message.split('\n')[0]; }
console.log(JSON.stringify(out,null,1));
