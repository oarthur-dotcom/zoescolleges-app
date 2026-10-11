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
o.postOwn=await as(A,`insert into talk_posts(family_id,user_id,school_id,kind,feel,body) values ('${F[0]}','${A}','sc-1','voice','love','I love the campus') returning id`);
const pid=o.postOwn.rows&&o.postOwn.rows[0].id;
o.postAsOther=await as(A,`insert into talk_posts(family_id,user_id,body) values ('${F[0]}','${B}','pretending')`);
o.postOtherFamily=await as(A,`insert into talk_posts(family_id,user_id,body) values ('${F[1]}','${A}','sneaky')`);
o.familySees=await as(B,`select body from talk_posts`);
o.strangerSees=await as(X,`select body from talk_posts`);
o.editOthers=await as(B,`update talk_posts set body='changed' where id='${pid}'`);
o.react=await as(B,`insert into talk_reactions(post_id,user_id,family_id,emoji) values ('${pid}','${B}','${F[0]}','heard')`);
o.strangerReacts=await as(X,`insert into talk_reactions(post_id,user_id,family_id,emoji) values ('${pid}','${X}','${F[0]}','heard')`);
o.longBody=await as(A,`insert into talk_posts(family_id,user_id,body) values ('${F[0]}','${A}',repeat('x',801))`);
o.voteA=await as(A,`insert into family_ballots(user_id,family_id,ranks) values ('${A}','${F[0]}','["sc-1","sc-2"]')`);
o.voteB=await as(B,`insert into family_ballots(user_id,family_id,ranks) values ('${B}','${F[0]}','["sc-2","sc-1"]')`);
o.peekBallots=await as(A,`select user_id from family_ballots`);
o.results2of3=await as(A,`select ballot_results() r`);
o.strangerResults=await as(X,`select ballot_results() r`);
o.voteC=await as(C,`insert into family_ballots(user_id,family_id,ranks) values ('${C}','${F[0]}','["sc-1"]')`);
o.results3of3=await as(B,`select ballot_results() r`);
o.newRound=await as(B,`select ballot_new_round()`);
o.afterRound=await as(A,`select ballot_results() r`);
o.voteAgain=await as(A,`insert into family_ballots(user_id,family_id,ranks) values ('${A}','${F[0]}','["sc-2"]')`);
o.reveal=await as(A,`select ballot_reveal()`);
o.afterReveal=await as(C,`select ballot_results() r`);
o.strangerNewRound=await as(X,`select ballot_new_round()`);
o.afterStranger=await as(A,`select ballot_results() r`);
o.badRanks=await as(B,`insert into family_ballots(user_id,family_id,ranks) values ('${B}','${F[0]}','[]')`);

o.status=await as(B,`update family_schools set app_status='accepted', reply_by='2027-05-01' where family_id='${F[0]}' and school_id='sc-1' returning app_status`);
o.badStatus=await as(B,`update family_schools set app_status='maybe' where family_id='${F[0]}'`);
o.offer=await as(C,`insert into aid_offers(family_id,school_id,offer,updated_by) values ('${F[0]}','sc-1','{"coa":80000,"grants":[{"name":"Merit","amount":20000}]}','${C}')`);
o.offerSeen=await as(B,`select offer->>'coa' coa from aid_offers`);
o.offerStranger=await as(X,`select * from aid_offers`);
o.offerStrangerWrite=await as(X,`insert into aid_offers(family_id,school_id,offer) values ('${F[0]}','sc-2','{}')`);
o.offerEditByFamily=await as(A,`update aid_offers set offer='{"coa":79000}' where school_id='sc-1'`);
o.milestone=await as(B,`insert into talk_posts(family_id,user_id,school_id,kind,body) values ('${F[0]}','${B}','sc-1','decision','We decided!')`);
const r=x=>x.rows&&x.rows[0]&&x.rows[0].r;
const ok={
 ownVoice: o.postOwn.ok, cannotPostAsSomeoneElse: !o.postAsOther.ok, cannotPostToOtherFamily: !o.postOtherFamily.ok,
 familySeesVoices: o.familySees.rows.length===1, otherFamilySeesNothing: o.strangerSees.ok && o.strangerSees.rows.length===0,
 cannotEditOthers: o.editOthers.ok && o.editOthers.n===0, reactionsFamilyOnly: o.react.ok && !o.strangerReacts.ok, lengthCapped: !o.longBody.ok,
 ballotsSecret: o.peekBallots.rows.length===1 && r(o.results2of3).voted===2 && r(o.results2of3).revealed===false && r(o.results2of3).ballots===null,
 strangerGetsNothing: r(o.strangerResults).voted===0 && r(o.strangerResults).ballots===null,
 autoRevealWhenAllVote: r(o.results3of3).revealed===true && r(o.results3of3).ballots.length===3,
 newRoundClears: r(o.afterRound).voted===0 && r(o.afterRound).revealed===false,
 revealNow: r(o.afterReveal).revealed===true && r(o.afterReveal).ballots.length===1,
 decisionStatus: o.status.ok && o.status.rows.length===1 && !o.badStatus.ok, offersShared: o.offer.ok && o.offerSeen.rows[0].coa==='80000' && o.offerStranger.rows.length===0 && !o.offerStrangerWrite.ok && o.offerEditByFamily.ok && o.offerEditByFamily.n===1, decisionMoment: o.milestone.ok,
 strangerCantClearOurs: r(o.afterStranger).voted===1, emptyBallotRejected: !o.badRanks.ok };
console.log(JSON.stringify(ok,null,1), Object.values(ok).every(Boolean));
