// Zoe long-tail answers via Gemini (free tier). Rules run first on the client;
// this is only called when the rules engine has no answer.
// Privacy: receives DE-IDENTIFIED context only (no names, no emails).
// Cost guard: global daily hard cap via Netlify Blobs (free tier never charges,
// this just keeps request volume sane).

// Lite first: higher free-tier quota, faster, and cheaper at scale; fall
// through to full flash, then the self-updating aliases. Each model is a
// separate quota pool, so a 429 on one tries the next.
const MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-flash-lite-latest", "gemini-flash-latest"];
const DAILY_CAP = 400;              // global requests/day across all users
const MAXQ = 600;                   // max question length (chars)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", ...CORS } });
const today = () => new Date().toISOString().slice(0, 10);

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
  if (Array.isArray(c.activities)) out.activities = c.activities.slice(0, 10).map(a => ({ what: String(a && a.name || "").slice(0, 50), tier: num(a && a.tier) || 4, hrsPerWeek: a && a.hrs != null ? String(a.hrs).slice(0, 8) : null, years: a && a.yrs != null ? String(a.yrs).slice(0, 8) : null })).filter(a => a.what);
  if (c.boardCount != null) out.collegesOnBoard = num(c.boardCount);
  if (c.bands) out.listBalance = { reach: num(c.bands.reach) || 0, target: num(c.bands.target) || 0, likely: num(c.bands.likely) || 0 };
  if (c.collegePower) out.collegePower = { likelyPctOfAllColleges: num(c.collegePower.likely) || 0, targetPct: num(c.collegePower.target) || 0, reachPct: num(c.collegePower.reach) || 0 };
  const sch = a => (Array.isArray(a) ? a.slice(0, 25).map(s => ({ name: String(s && s.name || "").slice(0, 80), where: String(s && s.where || "").slice(0, 60), appBand: (s && s.band) ? String(s.band).slice(0, 10) : undefined })).filter(s => s.name) : undefined);
  const board = sch(c.schools); if (board && board.length) out.schoolsOnBoard = board;
  const trip = sch(c.trip); if (trip && trip.length) out.schoolsOnTrip = trip;
  return out;
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ reply: null, unconfigured: true });

  let body; try { body = await req.json(); } catch { return json({ error: "bad request" }, 400); }
  const q = String(body.q || "").slice(0, MAXQ).trim();
  if (!q) return json({ error: "empty" }, 400);

  // Global daily hard cap (best-effort; skips silently if Blobs unavailable).
  let used = 0;
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore({ name: "zoe-ai-usage", consistency: "strong" });
    const d = today();
    const cur = (await store.get(d, { type: "json" })) || { n: 0 };
    used = cur.n || 0;
    if (used >= DAILY_CAP) return json({ reply: null, capped: true });
    await store.setJSON(d, { n: used + 1 });
  } catch (e) { /* no persistent cap available — carry on */ }

  const ctx = sanitizeCtx(body.ctx);
  const sys = [
    "You are Zoe, a warm, upbeat, concise college-planning assistant inside the \"Zoe's Colleges\" app, used by a high-school student and their family.",
    "Answer in 2-5 short sentences by default, plain and encouraging — minimal jargon. For an explicit 'analyze my whole profile' request you may use up to ~8 sentences or a few short bullet-style lines.",
    "You help with: college search, admissions chances and fit, ESSAYS and applications, deadlines, financial-aid basics, campus visits, and candid read-outs of a student's overall profile strength.",
    "RESUME / PROFILE STRENGTH: when asked how strong a student is (or to analyze their profile), reason about ALL the signals TOGETHER, not one at a time — rigorAdjustedGpa vs raw gpa, course rigor (apIbTaken) read against highSchool.apOffered (taking most of what's offered is strong; a school offering few APs is NOT a weakness), test scores or test-optional, activityStrength and the activities' tiers (tier 1 = national, 4 = participant; depth beats a long list), and intendedMajor (majorIsCompetitive admits tougher). Give an honest, encouraging read: 1-2 real strengths, the single biggest gap, and the 2-3 highest-impact things they could do next.",
    "STAY CONSISTENT WITH THE APP: each school in schoolsOnBoard has an appBand (Reach/Target/Likely) the app already computed, and collegePower shows how all colleges break down for this student. Treat those as the source of truth — never give a school a different tier than its appBand, and never invent a percentage chance. If pressed for a number, explain the app uses transparent bands, not false percentages.",
    "You can help plan campus-visit road trips: use schoolsOnTrip (or schoolsOnBoard) with their cities/states to suggest a sensible order that groups nearby schools and a rough day-by-day flow, and remind them the Trips tab builds the real route on a map and can find nearby food and places to stay.",
    "Do NOT invent specific statistics (admit rates, costs, test ranges) for a named college, and do NOT invent exact drive times or distances; reason from the cities/states generally and point them to the Trips tab map for real routing.",
    "For medical, legal, mental-health, or crisis topics, respond briefly with care and suggest a trusted adult or professional.",
    "Here is de-identified context about this family's situation (no names). Use it only if relevant: " + JSON.stringify(ctx)
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
    const gen = { temperature: 0.6, maxOutputTokens: 800, topP: 0.95 };
    if (noThink) gen.thinkingConfig = { thinkingBudget: 0 };
    return { systemInstruction: { parts: [{ text: sys }] }, contents: [{ role: "user", parts: [{ text: q }] }], generationConfig: gen, safetySettings };
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
        return json({ reply: null, error: "upstream", status: r.status, detail: lastErr }); // 5xx — stop
      }
      let reply = extract(await r.json());
      if (!reply) { const r2 = await call(model, false); if (r2.ok) reply = extract(await r2.json()); } // empty → one retry
      if (reply) return json({ reply, model, used: used + 1, cap: DAILY_CAP });
      lastStatus = 200; lastErr = "empty response";
    } catch (e) { lastErr = "fetch failed"; }
  }
  return json({ reply: null, error: "upstream", status: lastStatus, detail: lastErr });
};
