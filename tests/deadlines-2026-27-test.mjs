// 2026–27 deadlines (Oct 11) — reminder job + shared reader. Run from the repo root (copy here first):
//   cp tests/deadlines-2026-27-test.mjs ./_t.mjs && node _t.mjs
import fs from 'fs';
const { runReminders } = await import('./netlify/functions/deadline-reminders.mjs');
const { deadlineList } = await import('./netlify/lib/deadlines.mjs');
const CAT = fs.readFileSync('/home/claude/zoescolleges-data/colleges.json', 'utf8');
const DLF = fs.readFileSync('/tmp/claude-0/dl/deadlines-2026-27.json', 'utf8');
const cat = JSON.parse(CAT).colleges; const id = n => cat.find(c => c.name === n).id; const info = n => cat.find(c => c.name === n);
const DL = JSON.parse(DLF).schools;
const R = {}, ok = {};
R.mitOld = deadlineList(info('Massachusetts Institute of Technology')); R.mitNew = deadlineList(info('Massachusetts Institute of Technology'), DL[id('Massachusetts Institute of Technology')]);
ok.newRoundsWin = R.mitNew.length === 2 && R.mitNew[0].kind === 'Early Action' && R.mitNew[0].date === '2026-11-01';
ok.noFileFallsBack = JSON.stringify(deadlineList(info('Clemson University'), undefined)) === JSON.stringify(deadlineList(info('Clemson University')));
ok.badDateIgnored = deadlineList({}, { rounds: [{ kind: 'X', date: 'Nov 1' }, { kind: 'Early Action', date: '2026-11-01' }] }).length === 1;
const FAM = 'fam-1', U1 = 'user-on';
function world(withFile) { return { withFile, prefs: [{ user_id: U1, family_id: FAM, email_on: true }],
  board: ['Clemson University', 'College of Charleston', 'University of Arizona', 'Massachusetts Institute of Technology'].map(n => ({ family_id: FAM, school_id: id(n), name: n })),
  log: [], nextId: 1, emails: [] }; }
const fakeFetch = W => async (url, opts = {}) => { url = String(url); const m = opts.method || 'GET'; const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s });
  if (url.includes('colleges.json')) return new Response(CAT);
  if (url.includes('deadlines-2026-27.json')) return W.withFile ? new Response(DLF) : new Response('nf', { status: 404 });
  if (url.startsWith('https://api.resend.com/emails')) { W.emails.push(JSON.parse(opts.body)); return J({ id: 'e' }); }
  const u = new URL(url);
  if (u.pathname.startsWith('/auth/v1/admin/users/')) return J({ id: U1, email: 'zoe@example.org' });
  const t = u.pathname.replace('/rest/v1/', '');
  if (t === 'reminder_prefs') return J(W.prefs); if (t === 'family_schools') return J(W.board);
  if (t === 'reminder_log' && m === 'GET') return J(W.log);
  if (t === 'reminder_log' && m === 'POST') { const rows = JSON.parse(opts.body).map(r => ({ ...r, id: W.nextId++ })); W.log.push(...rows); return J(rows, 201); }
  return J({}, 599); };
const quiet = { log() {}, error() {} }; const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'svc', RESEND_API_KEY: 're', REMINDERS_LIVE: 'yes' };
const W1 = world(true); await runReminders({ env: ENV, fetchImpl: fakeFetch(W1), now: new Date('2026-10-11T13:00:00Z'), log: quiet });
R.withFile = { subject: W1.emails[0] && W1.emails[0].subject, text: W1.emails[0] && W1.emails[0].text };
ok.mitNowIncluded = /Massachusetts Institute of Technology — Early Action deadline Sun, Nov 1, 2026/.test(R.withFile.text || '');
ok.clemsonEarlyAction = /Clemson University — Early Action deadline Thu, Oct 15, 2026 \(in 4 days\)/.test(R.withFile.text || '');
ok.charlestonEarlyDecision = /College of Charleston — Early Decision deadline Sun, Nov 1, 2026/.test(R.withFile.text || '');
const W2 = world(false); await runReminders({ env: ENV, fetchImpl: fakeFetch(W2), now: new Date('2026-10-11T13:00:00Z'), log: quiet });
R.withoutFile = W2.emails[0] && W2.emails[0].text;
ok.missingFileStillWorks = W2.emails.length === 1 && !/Massachusetts Institute of Technology/.test(R.withoutFile);
R.ok = ok; R.allPass = Object.values(ok).every(Boolean);
console.log(JSON.stringify(R, null, 1));
fs.writeFileSync('tests/deadlines-2026-27-result-2026-10-11.json', JSON.stringify(R, null, 1));
