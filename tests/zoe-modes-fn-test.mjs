// #46 Zoe server: modes (essay coach, family huddle, weekly plan), conversation memory, clear "busy" errors. No network.
// Run from anywhere: node tests/zoe-modes-fn-test.mjs
import fs from 'fs';
process.env.GEMINI_API_KEY = "test-key";
let sent = [], mode429 = false;
globalThis.fetch = async (url, opts = {}) => { url = String(url);
  if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: "u1" }), { status: 200 });
  if (url.includes("generativelanguage")) { sent.push(JSON.parse(opts.body)); if (mode429) return new Response("quota", { status: 429 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok answer" }] } }] }), { status: 200 }); }
  return new Response("x", { status: 599 }); };
const zoe = (await import(new URL('../netlify/functions/zoe-ai.mjs', import.meta.url))).default;
const ask = async body => { sent = []; const r = await zoe(new Request("https://zoescolleges.com/x", { method: "POST", headers: { origin: "https://zoescolleges.com", "content-type": "application/json", authorization: "Bearer GOOD" }, body: JSON.stringify(body) })); return { status: r.status, j: await r.json(), g: sent[0] }; };
const sys = g => g.systemInstruction.parts[0].text;
const ok = {}, R = {};
const draft = "word ".repeat(700);
let a = await ask({ q: draft, mode: "essay", ctx: {} });
ok.essayModeRules = /ESSAY COACH MODE/.test(sys(a.g)) && /never a ghostwriter/.test(sys(a.g)); ok.essayLongDraftKept = a.g.contents.at(-1).parts[0].text.length > 3000; ok.essayMoreTokens = a.g.generationConfig.maxOutputTokens === 1100;
a = await ask({ q: draft, ctx: {} });
ok.chatStillCapped = a.g.contents.at(-1).parts[0].text.length <= 600 && !/ESSAY COACH/.test(sys(a.g));
a = await ask({ q: "and what about my second choice?", history: [{ role: "zoe", text: "Hi! I'm Zoe" }, { role: "user", text: "Which is my best fit?" }, { role: "zoe", text: "Clemson looks strong." }, { role: "user", text: "and what about my second choice?" }], ctx: {} });
R.historyRoles = a.g.contents.map(c => c.role);
ok.memoryAlternatesFromUser = JSON.stringify(R.historyRoles) === '["user","model","user"]' && /Clemson looks strong/.test(a.g.contents[1].parts[0].text);
a = await ask({ q: "Help us talk about Clemson", mode: "huddle", ctx: { huddle: [{ school: "Clemson University", views: [{ who: "Student", stars: 5, note: "Loved the vibe" }, { who: "Parent 1", stars: 2, note: "Too far from home", name: "Obie" }] }] } });
R.huddleCtx = (sys(a.g).match(/"familyRatings":\[.*?\]\}\]/) || [])[0];
ok.huddleRules = /FAMILY HUDDLE MODE/.test(sys(a.g)) && /Too far from home/.test(sys(a.g)) && !/Obie/.test(sys(a.g));
a = await ask({ q: "Plan my week", mode: "week", ctx: { today: "2026-10-11", upcoming: [{ school: "Clemson University", kind: "Early Action", date: "2026-10-15", days: 4 }], gaps: [{ school: "Clemson University", todo: ["Essays", "Submitted"] }] } });
ok.weekRules = /WEEKLY PLAN MODE/.test(sys(a.g)) && /"upcomingDeadlines":\[\{"school":"Clemson University","round":"Early Action","date":"2026-10-15","daysLeft":4\}\]/.test(sys(a.g)) && /checklistGaps/.test(sys(a.g));
a = await ask({ q: "hi", mode: "hack-me", ctx: {} }); ok.unknownModeIsChat = a.j.mode === "chat";
mode429 = true; a = await ask({ q: "hi", ctx: {} }); ok.allBusyReported = a.j.error === "busy" && a.j.reply === null;
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R, null, 1));
fs.writeFileSync(new URL('./zoe-modes-fn-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1));
