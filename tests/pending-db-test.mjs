import { PGlite } from '@electric-sql/pglite'; import fs from 'fs';
const APP='/home/claude/zoescolleges-app/';
const STUB=`create function public.gen_random_bytes(n int) returns bytea language sql volatile as $$ select substring(decode(md5(random()::text)||md5(random()::text),'hex') from 1 for n) $$;
create schema auth; create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
create role anon; create role authenticated;
create schema storage; create table storage.buckets(id text primary key, name text, public boolean);
create table storage.objects(bucket_id text, name text); alter table storage.objects enable row level security;
create function storage.foldername(n text) returns text[] language sql as $$ select string_to_array(n,'/') $$;
grant usage on schema public, auth, storage to anon, authenticated;`;
const db=new PGlite(); await db.exec(STUB);
for (const f of fs.readdirSync(APP).filter(f=>/^migration-0\d\d-.*\.sql$/.test(f)).sort()) await db.exec(fs.readFileSync(APP+f,'utf8').replace(/create extension[^;]*;/gi,''));
await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated; alter table auth.users disable trigger enforce_beta_gate;`);
const A='aaaaaaaa-0000-0000-0000-000000000001',B='bbbbbbbb-0000-0000-0000-000000000002',C='cccccccc-0000-0000-0000-000000000003',X='dddddddd-0000-0000-0000-000000000004';
await db.exec(`insert into auth.users(id) values ('${A}'),('${B}'),('${C}'),('${X}');`);
const F=(await db.query(`insert into public.families(name,created_by) values ('Fam','${A}'),('Other','${X}') returning id`)).rows.map(r=>r.id);
await db.exec(`insert into public.members(user_id,family_id,display_name,role) values ('${A}','${F[0]}','Dad','parent'),('${B}','${F[0]}','Zoe','student'),('${C}','${F[0]}','Mom','parent'),('${X}','${F[1]}','Stranger','parent');`);
await db.exec(`insert into public.family_schools(family_id,school_id,name,added_by) values ('${F[0]}','sc-1','A','${A}'),('${F[0]}','sc-2','B','${A}');`);
async function as(uid, sql){ await db.exec(`set test.uid='${uid}'; set role authenticated;`); try{ const r=await db.query(sql); return {ok:true,rows:r.rows,n:r.affectedRows}; }catch(e){ return {ok:false,err:e.message.split('\n')[0]}; } finally{ await db.exec('reset role'); } }
const o={};
// Family F0 has no student yet in this scenario: remove Zoe's membership first (as the database owner).
await db.exec(`delete from public.members where user_id='${B}';`);
o.parentAdds=await as(A,`insert into pending_students(family_id,display_name,profile,created_by) values ('${F[0]}','Zoe','{"gpa":"3.7"}','${A}') returning display_name`);
o.otherParentEdits=await as(C,`update pending_students set profile='{"gpa":"3.9"}' where family_id='${F[0]}'`);
o.strangerSees=await as(X,`select * from pending_students`);
o.strangerEdits=await as(X,`update pending_students set display_name='Hacked' where family_id='${F[0]}'`);
o.strangerAddsToOther=await as(X,`insert into pending_students(family_id,display_name) values ('${F[0]}','Sneaky')`);
o.second=await as(A,`insert into pending_students(family_id,display_name) values ('${F[0]}','Another')`);
o.longName=await as(X,`insert into pending_students(family_id,display_name) values ('${F[1]}',repeat('x',41))`);
o.notObject=await as(X,`insert into pending_students(family_id,display_name,profile) values ('${F[1]}','Kid','[1,2]')`);
// Zoe joins her family as the student, reads the pending profile, copies it to her own profile, removes the row.
await db.exec(`reset role; insert into public.members(user_id,family_id,display_name,role) values ('${B}','${F[0]}','Zoe','student');`);
o.studentReads=await as(B,`select display_name, profile->>'gpa' gpa from pending_students`);
o.studentClaims=await as(B,`insert into profiles(user_id,family_id,gpa) values ('${B}','${F[0]}','3.9')`);
o.studentRemoves=await as(B,`delete from pending_students where family_id='${F[0]}'`);
o.gone=await as(A,`select count(*)::int n from pending_students`);
o.otherFamilyRowUntouched=await as(X,`select count(*)::int n from pending_students`);
await db.exec(`reset role;`);
const ok={
 parentAdds: o.parentAdds.ok && o.parentAdds.rows[0].display_name==='Zoe',
 otherParentEdits: o.otherParentEdits.ok && o.otherParentEdits.n===1,
 strangerCantSee: o.strangerSees.ok && o.strangerSees.rows.length===0,
 strangerCantEdit: !o.strangerEdits.ok || o.strangerEdits.n===0,
 strangerCantAddToOtherFamily: !o.strangerAddsToOther.ok,
 onePerFamily: !o.second.ok,
 nameCap40: !o.longName.ok,
 profileMustBeObject: !o.notObject.ok,
 studentReadsHeld: o.studentReads.ok && o.studentReads.rows[0].gpa==='3.9',
 studentClaims: o.studentClaims.ok,
 studentRemoves: o.studentRemoves.ok && o.studentRemoves.n===1 && o.gone.rows[0].n===0,
};
console.log(JSON.stringify({o,ok},null,1)); console.log(Object.values(ok).every(Boolean));
