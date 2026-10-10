// Zoe long-tail answers via Gemini (free tier). Rules run first on the client;
// this is only called when the rules engine has no answer.
// Privacy: receives DE-IDENTIFIED context only (no names, no emails).
// Cost guard: global daily hard cap via Netlify Blobs (free tier never charges,
// this just keeps request volume sane).

// Primary is the self-updating alias so a model rename never breaks us again;
// the rest are explicit fallbacks tried in order until one responds.
const MODELS = ["gemini-flash-latest", "gemini-3.8-flash", "gemini-2.5-flash", "gemini-1.5-flash"];
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
  if (c.sat != null) out.sat = num(c.sat);
  if (c.testOptional != null) out.testOptional = !!c.testOptional;
  if (c.major) out.intendedMajor = String(c.major).slice(0, 60);
  if (c.notes) out.preferencesText = String(c.notes).slice(0, 240);
  if (c.boardCount != null) out.collegesOnBoard = num(c.boardCount);
  if (c.activities != null) out.activitiesCount = num(c.activities);
  if (c.bands) out.listBalance = { reach: num(c.bands.reach) || 0, target: num(c.bands.target) || 0, likely: num(c.bands.likely) || 0 };
  if (c.gradYear) out.gradYear = num(c.gradYear);
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
    "Answer in 2-5 short sentences, plain and encouraging — no headers, minimal jargon.",
    "You help with: college search, admissions chances and fit, essays and applications, deadlines, financial-aid basics, and campus visits.",
    "Do NOT invent specific statistics (admit rates, costs, test ranges) for a named college; speak generally or tell them to open that school's page in the app for the numbers.",
    "For medical, legal, mental-health, or crisis topics, respond briefly with care and suggest a trusted adult or professional.",
    "Here is de-identified context about this family's situation (no names). Use it only if relevant: " + JSON.stringify(ctx)
  ].join(" ");

  const payload = {
    systemInstruction: { parts: [{ text: sys }] },
    contents: [{ role: "user", parts: [{ text: q }] }],
    generationConfig: { temperature: 0.6, maxOutputTokens: 400, topP: 0.95 },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
    ]
  };
  let lastErr = null, lastStatus = 0;
  for (const model of MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      if (!r.ok) {
        const t = await r.text();
        lastStatus = r.status; lastErr = t.slice(0, 300);
        if (r.status === 404 || r.status === 400) continue; // bad/renamed model — try next
        return json({ reply: null, error: "upstream", status: r.status, detail: lastErr }); // 429/5xx — stop
      }
      const j = await r.json();
      const reply = ((j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [])
        .map(p => p.text || "").join("").trim();
      return json({ reply: reply || null, model, used: used + 1, cap: DAILY_CAP });
    } catch (e) { lastErr = "fetch failed"; }
  }
  return json({ reply: null, error: "upstream", status: lastStatus, detail: lastErr });
};
