// Zoe long-tail answers via Gemini (free tier). Rules run first on the client;
// this is only called when the rules engine has no answer.
// Privacy: receives DE-IDENTIFIED context only (no names, no emails).
// Cost guard: global daily hard cap via Netlify Blobs (free tier never charges,
// this just keeps request volume sane).

// Lite first: higher free-tier quota, faster, and cheaper at scale; fall
// through to full flash, then the self-updating aliases. Each model is a
// separate quota pool, so a 429 on one tries the next.
// Fix #8: the self-updating "-latest" aliases answered every live test (Oct 11) while both 2.5
// models failed, costing ~6s per question. Try the working aliases first; 2.5 stay as backups.
const MODELS = ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-2.5-flash-lite", "gemini-2.5-flash"];
import { corsFor, requireUser, bumpDailyCap } from "../lib/guard.mjs";
const DAILY_CAP = 400;              // global requests/day across all users
const MAXQ = 600;                   // max question length (chars)
const MAXQ_ESSAY = 5000;            // essay coach: a pasted 650-word draft fits
const MODES = new Set(["chat", "essay", "huddle", "week"]);   // #46

// #46: what each Zoe mode adds to her instructions.
const MODE_RULES = {
  essay: "ESSAY COACH MODE. You are a coach, never a ghostwriter: do NOT write, rewrite or 'improve' the essay, and never produce a paragraph the student could paste in. " +
    "If they have no draft yet, help them brainstorm: ask 2-3 sharp questions and suggest 2-3 possible directions drawn from their activities and interests (what they did, a moment, a change in them). " +
    "If they paste a draft: give (1) what's working, in their own words, (2) the single biggest improvement, (3) 2-3 specific questions that would make it more personal, and (4) the word count vs. the 650-word Common App limit. You may quote at most one short phrase from the draft. Warm, honest, specific.",
  huddle: "FAMILY HUDDLE MODE. The family has rated and commented on colleges (people are labeled by role only). Your job is to help them talk calmly and productively, not to decide. " +
    "Summarize where they agree, where their views differ and what each person seems to care about (e.g. cost, distance, feel, programs) without blame or taking sides; validate that different priorities are normal; " +
    "then suggest the 1-2 most useful, non-loaded questions to discuss next, and one concrete step (e.g. visit, look up net price). Never mock or diagnose anyone. Keep it short and kind.",
  week: "WEEKLY PLAN MODE. Using upcomingDeadlines, checklistGaps and schoolsOnTrip, write a realistic plan for the next 7 days for a busy high-school student: 3-5 short dated items, most urgent first, each with a tiny next step. " +
    "If nothing is due soon, suggest the most valuable progress for this stage of the process. Don't invent deadlines; only use the ones provided."
};

let CORS = {};
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", ...CORS } });

function sanitizeCtx(c) {
  c = c || {};
  const out = {};
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
  if (c.gpa != null) out.gpa = num(c.gpa);
  if (c.gpaAdjusted != null) out.rigorAdjustedGpa = num(c.gpaAdjusted);
  if (c.sat != null) out.sat = num(c.sat);
  if (c.act != null) out.act = num(c.act);
  if (c.testOptional != null) out.testOptional = !!c.testOptional;
  if (c.major) out.intendedMajor = String(c.major).slice(0, 60);
  if (c.majorCompetitive != null) out.majorIsCompetitive = !!c.majorCompetitive;
  if (c.rank) out.classRank = String(c.rank).slice(0, 30);
  if (c.notes) out.preferencesText = String(c.notes).slice(0, 240);
  if (c.gradYear) out.gradYear = num(c.gradYear);
  if (c.rigor) out.courseRigor = { honorsTaken: num(c.rigor.honors) || 0, apIbTaken: num(c.rigor.ap) || 0, dualEnrollTaken: num(c.rigor.dual) || 0 };
  if (c.highSchool && (c.highSchool.apOffered || c.highSchool.name)) out.highSchool = { apOffered: num(c.highSchool.apOffered) || 0, honorsOffered: num(c.highSchool.honorsOffered) || 0 };
  if (c.activitiesCount != null) out.activitiesCount = num(c.activitiesCount);
  if (c.activityStrength) out.activityStrength = String(c.activityStrength).slice(0, 12); // strong/solid/light
  if (Array.isArray(c.activities)) out.activities = c.activities.slice(0, 10).map(a => ({ what: String(a && a.name || "").slice(0, 50), tier: num(a && a.tier) || 4, hrsPerWeek: a && a.hrs != null ? String(a.hrs).slice(0, 8) : null, years: a && a.yrs != null ? String(a.yrs).slice(0, 8) : null, description: a && a.desc ? String(a.desc).slice(0, 150) : undefined })).filter(a => a.what);
  // #46 family huddle: ratings and notes per school, people by ROLE only (no names).
  if (Array.isArray(c.huddle)) out.familyRatings = c.huddle.slice(0, 8).map(h => ({ school: String(h && h.school || "").slice(0, 80),
    views: (Array.isArray(h && h.views) ? h.views : []).slice(0, 6).map(v => ({ who: String(v && v.who || "").slice(0, 20), stars: num(v && v.stars), note: String(v && v.note || "").slice(0, 240) })) })).filter(h => h.school);
  // #46 weekly plan inputs
  if (Array.isArray(c.upcoming)) out.upcomingDeadlines = c.upcoming.slice(0, 12).map(d => ({ school: String(d && d.school || "").slice(0, 80), round: String(d && d.kind || "").slice(0, 30), date: String(d && d.date || "").slice(0, 10), daysLeft: num(d && d.days) }));
  if (Array.isArray(c.gaps)) out.checklistGaps = c.gaps.slice(0, 12).map(g => ({ school: String(g && g.school || "").slice(0, 80), stillToDo: (Array.isArray(g && g.todo) ? g.todo : []).slice(0, 6).map(t => String(t).slice(0, 30)) }));
  if (c.today) out.today = String(c.today).slice(0, 10);
  if (c.boardCount != null) out.collegesOnBoard = num(c.boardCount);
  if (c.bands) out.listBalance = { reach: num(c.bands.reach) || 0, target: num(c.bands.target) || 0, likely: num(c.bands.likely) || 0 };
  if (c.collegePower) out.collegePower = { likelyPctOfAllColleges: num(c.collegePower.likely) || 0, targetPct: num(c.collegePower.target) || 0, reachPct: num(c.collegePower.reach) || 0 };
  const sch = a => (Array.isArray(a) ? a.slice(0, 25).map(s => ({ name: String(s && s.name || "").slice(0, 80), where: String(s && s.where || "").slice(0, 60), appBand: (s && s.band) ? String(s.band).slice(0, 10) : undefined })).filter(s => s.name) : undefined);
  const board = sch(c.schools); if (board && board.length) out.schoolsOnBoard = board;
  const trip = sch(c.trip); if (trip && trip.length) out.schoolsOnTrip = trip;
  // Oct 12: the page the family asked from ("Ask Zoe about this page"), and the school they're looking at.
  if (c.page && typeof c.page === "object") { const s = v => v == null ? null : String(v).slice(0, 80); const p = { page: s(c.page.label), view: s(c.page.view) };
    if (c.page.school && typeof c.page.school === "object") { const k = c.page.school; p.schoolBeingViewed = { athletics: s(k.athletics), studentsTeamHere: s(k.myTeam), name: s(k.name), where: s(k.where), appChanceBand: s(k.chance), admitRate: s(k.admitRate), size: s(k.size), setting: s(k.setting), likelyCost: s(k.likelyCost), onTheirBoard: !!k.onBoard }; }
    out.askedFromPage = p; }
  // Oct 13: the app's own step-by-step reasoning for a school's band, for "why is X a reach / why did it change" questions.
  if (Array.isArray(c.bandReasons)) { const s = (v, n) => v == null ? null : String(v).slice(0, n);
    out.bandReasons = c.bandReasons.slice(0, 6).map(b => ({ school: s(b && b.school, 80), appBand: s(b && b.band, 12),
      inputsUsed: b && b.inputs && typeof b.inputs === "object" ? { gpa: s(b.inputs.gpaRaw, 6), rigorAdjustedGpa: b.inputs.gpaAdj == null ? null : num(b.inputs.gpaAdj), sat: num(b.inputs.sat), act: s(b.inputs.act, 4), testOptional: !!b.inputs.testOptional, intendedMajor: s(b.inputs.major, 60), majorIsCompetitive: !!b.inputs.majorImpacted, activityStrength: s(b.inputs.activityWord, 12), courseRigor: b.inputs.rigor && b.inputs.rigor.word ? s(b.inputs.rigor.word, 40) : null } : null,
      steps: (Array.isArray(b && b.steps) ? b.steps : []).slice(0, 12).map(t => ({ factor: s(t && t.k, 40), result: s(t && t.v, 40), because: s(t && t.why, 200) })) })).filter(b => b.school); }
  // #80: the student wants to play a sport in college (from their activities)
  if (c.athlete && typeof c.athlete === "object" && c.athlete.sport) out.collegeAthleteGoal = { sport: String(c.athlete.sport).slice(0, 40), team: c.athlete.side === "w" ? "women's" : c.athlete.side === "m" ? "men's" : null, levelWanted: c.athlete.level ? String(c.athlete.level).slice(0, 8) : null, wantsRecruiting: !!c.athlete.serious };
  return out;
}

export default async (req) => {
  CORS = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const user = await requireUser(req);
  if (!user) return json({ reply: null, error: "signin" }, 401);

  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ reply: null, unconfigured: true });

  let body; try { body = await req.json(); } catch { return json({ error: "bad request" }, 400); }
  const mode = MODES.has(body.mode) ? body.mode : "chat";
  const q = String(body.q || "").slice(0, mode === "essay" ? MAXQ_ESSAY : MAXQ).trim();
  // #46: short conversation memory so follow-ups make sense (text only, last 8 turns, capped).
  const history = (Array.isArray(body.history) ? body.history : []).slice(-8)
    .map(h => ({ role: h && h.role === "zoe" ? "model" : "user", text: String((h && h.text) || "").slice(0, 1500).trim() })).filter(h => h.text)
    .reduce((a, h) => { if (!a.length && h.role === "model") return a; const last = a[a.length - 1];   // must start with the user and alternate
      if (last && last.role === h.role) last.text += "\n" + h.text; else a.push({ ...h }); return a; }, []);
  if (history.length && history[history.length - 1].role === "user") history.pop();   // the new question is the user turn
  if (!q) return json({ error: "empty" }, 400);

  // Global daily hard cap (Netlify Blobs). Errors are now logged instead of silently ignored.
  const capRes = await bumpDailyCap("zoe-ai-usage", DAILY_CAP);
  if (capRes.capped) return json({ reply: null, capped: true });
  const used = capRes.used == null ? 0 : capRes.used - 1;

  const ctx = sanitizeCtx(body.ctx);
  const sys = [
    "You are Zoe, a warm, upbeat, concise college-planning assistant inside the \"Zoe's Colleges\" app, used by a high-school student and their family.",
    "Answer in 2-5 short sentences by default, plain and encouraging — minimal jargon. For an explicit 'analyze my whole profile' request you may use up to ~8 sentences or a few short bullet-style lines.",
    "You help with: college search, admissions chances and fit, ESSAYS and applications, deadlines, financial-aid basics, campus visits, and candid read-outs of a student's overall profile strength.",
    "RESUME / PROFILE STRENGTH: when asked how strong a student is (or to analyze their profile), reason about ALL the signals TOGETHER, not one at a time — rigorAdjustedGpa vs raw gpa, course rigor (apIbTaken) read against highSchool.apOffered (taking most of what's offered is strong; a school offering few APs is NOT a weakness), test scores or test-optional, activityStrength and the activities' tiers (tier 1 = national, 4 = participant; depth beats a long list), and intendedMajor (majorIsCompetitive admits tougher). Give an honest, encouraging read: 1-2 real strengths, the single biggest gap, and the 2-3 highest-impact things they could do next.",
    "STAY CONSISTENT WITH THE APP: each school in schoolsOnBoard has an appBand (Reach/Target/Likely) the app already computed, and collegePower shows how all colleges break down for this student. Treat those as the source of truth — never give a school a different tier than its appBand, and never invent a percentage chance. If pressed for a number, explain the app uses transparent bands, not false percentages.",
    "BAND QUESTIONS (\"why is X a reach/target/likely\", \"why did it change\"): if bandReasons is present, answer from it and nothing else. Name the 1-3 factors that decided the band, in plain words, using each step's result and reason; always give the school the exact appBand. The app starts from the school's admit rate and then moves the band using the student's GPA, test scores, course rigor, activities and intended major, and the SAME inputs always give the SAME band. If they say a band changed, you cannot see the earlier values, so say that honestly: the usual causes are a change to the profile (GPA, scores or test-optional, course rigor, activities, major) made on any family device, or an update to the school's data. Ask what they changed or point to the school's 'How this was calculated' and My Profile. Never guess a cause as fact and never invent numbers.",
    "If collegeAthleteGoal is present, the student wants to play that sport in college: factor team availability and division into school advice, and for recruiting point to the NCAA/NAIA eligibility centers and the coaches' recruiting questionnaires — never promise a roster spot or scholarship.",
    "If askedFromPage is present, the question was asked from that page of the app; read 'this', 'here' or 'this school' as that page or schoolBeingViewed, and use its appChanceBand and likelyCost exactly as given.",
    "You can help plan campus-visit road trips: use schoolsOnTrip (or schoolsOnBoard) with their cities/states to suggest a sensible order that groups nearby schools and a rough day-by-day flow, and remind them the Trips tab builds the real route on a map and can find nearby food and places to stay.",
    "Do NOT invent specific statistics (admit rates, costs, test ranges) for a named college, and do NOT invent exact drive times or distances; reason from the cities/states generally and point them to the Trips tab map for real routing.",
    "For medical, legal, mental-health, or crisis topics, respond briefly with care and suggest a trusted adult or professional.",
    "Here is de-identified context about this family's situation (no names). Use it only if relevant: " + JSON.stringify(ctx),
    MODE_RULES[mode] || ""
  ].join(" ");

  const safetySettings = [
    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
  ];
  // noThink disables the model's hidden reasoning so the whole token budget goes
  // to the visible answer (and responses are much faster). Older models reject
  // thinkingConfig with a 400, so we retry without it in that case.
  const buildPayload = (noThink) => {
    const gen = { temperature: 0.6, maxOutputTokens: mode === "essay" ? 1100 : 800, topP: 0.95 };
    if (noThink) gen.thinkingConfig = { thinkingBudget: 0 };
    return { systemInstruction: { parts: [{ text: sys }] }, contents: [...history.map(h => ({ role: h.role, parts: [{ text: h.text }] })), { role: "user", parts: [{ text: q }] }], generationConfig: gen, safetySettings };
  };
  const call = (model, noThink) => fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildPayload(noThink)) }
  );
  const extract = (j) => ((j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [])
    .map(p => p.text || "").join("").trim();

  let lastErr = null, lastStatus = 0;
  for (const model of MODELS) {
    try {
      let r = await call(model, true);
      if (r.status === 400) r = await call(model, false); // model rejects thinkingConfig → plain
      if (!r.ok) {
        lastStatus = r.status; lastErr = (await r.text()).slice(0, 300);
        // bad/renamed model (404/400) or this model's free quota spent (429) —
        // try the next model, which has its own separate quota pool.
        if (r.status === 404 || r.status === 400 || r.status === 429) continue;
        console.error("[zoe-ai] upstream", r.status, lastErr.slice(0, 200));
        return json({ reply: null, error: "upstream", status: r.status, detail: lastErr }); // 5xx — stop
      }
      let reply = extract(await r.json());
      if (!reply) { const r2 = await call(model, false); if (r2.ok) reply = extract(await r2.json()); } // empty → one retry
      if (reply) return json({ reply, model, mode, used: used + 1, cap: DAILY_CAP });
      lastStatus = 200; lastErr = "empty response";
    } catch (e) { lastErr = "fetch failed"; }
  }
  console.error("[zoe-ai] all models failed", lastStatus, String(lastErr || "").slice(0, 200));
  return json({ reply: null, error: lastStatus === 429 ? "busy" : "upstream", status: lastStatus, detail: lastErr });
};
