// Reads an uploaded high-school transcript (image or PDF) with Gemini vision and
// returns structured fields to pre-fill the Academic Profile. The student always
// reviews and confirms before anything is saved.
// Privacy: the file is sent to Google for parsing and NOT stored by us; we keep
// no copy. Cost guard: global daily hard cap via Netlify Blobs.

const MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"]; // vision-capable; lite is the cheaper fallback
const DAILY_CAP = 150;                 // global transcript reads/day
const MAX_BYTES = 7 * 1024 * 1024;     // ~7MB decoded file ceiling
const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", ...CORS } });
const today = () => new Date().toISOString().slice(0, 10);

const SYS = [
  "You extract data from a U.S. high-school transcript image or PDF. Return ONLY JSON, no prose.",
  "Shape: {\"gpa\":number|null,\"gpaScale\":number|null,\"weightedGpa\":number|null,\"apIb\":number,\"honors\":number,\"dualEnrollment\":number,\"sat\":number|null,\"act\":number|null,\"courses\":[{\"name\":string,\"level\":\"AP\"|\"IB\"|\"Honors\"|\"Dual\"|\"Regular\"}],\"confidence\":\"high\"|\"medium\"|\"low\"}",
  "Rules: count AP and IB courses together in apIb; count Honors courses in honors; count dual-enrollment / college-credit courses in dualEnrollment. If counts are unknown use 0. Prefer the UNWEIGHTED cumulative GPA for gpa and note the scale (e.g. 4.0) in gpaScale; put any weighted GPA in weightedGpa. Do NOT guess a GPA or test score that is not visible — use null. List up to 25 courses in courses (name + level); omit if none are legible. Set confidence based on image legibility.",
  "If the document is clearly NOT a transcript, return {\"error\":\"not_a_transcript\"}."
].join(" ");

const extractText = (j) => ((j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [])
  .map(p => p.text || "").join("").trim();

function parseModelJson(txt) {
  if (!txt) return null;
  let s = txt.trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a === -1 || b === -1 || b < a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

function clean(o) {
  const num = (v, max) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && (max == null || n <= max) ? n : null; };
  const cnt = v => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= 40 ? Math.round(n) : 0; };
  const out = {
    gpa: num(o.gpa, 6), gpaScale: num(o.gpaScale, 6), weightedGpa: num(o.weightedGpa, 6),
    apIb: cnt(o.apIb), honors: cnt(o.honors), dualEnrollment: cnt(o.dualEnrollment),
    sat: num(o.sat, 1600), act: num(o.act, 36),
    confidence: ["high", "medium", "low"].includes(o.confidence) ? o.confidence : "medium",
    courses: Array.isArray(o.courses) ? o.courses.slice(0, 25).map(c => ({
      name: String(c && c.name || "").slice(0, 80),
      level: ["AP", "IB", "Honors", "Dual", "Regular"].includes(c && c.level) ? c.level : "Regular"
    })).filter(c => c.name) : []
  };
  return out;
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: null, unconfigured: true });

  let body; try { body = await req.json(); } catch { return json({ error: "bad request" }, 400); }
  const mime = String(body.mime || "").toLowerCase();
  const data = String(body.file || "");
  if (!data || !ALLOWED.includes(mime)) return json({ error: "Please upload a PDF or a photo (PNG/JPG) of the transcript." }, 400);
  // base64 length ~= 4/3 of byte size
  if (data.length * 0.75 > MAX_BYTES) return json({ error: "That file is too large — keep it under 7MB." }, 413);

  // Global daily hard cap (best-effort)
  let used = 0;
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore({ name: "transcript-usage", consistency: "strong" });
    const d = today();
    const cur = (await store.get(d, { type: "json" })) || { n: 0 };
    used = cur.n || 0;
    if (used >= DAILY_CAP) return json({ error: null, capped: true });
    await store.setJSON(d, { n: used + 1 });
  } catch (e) { /* no persistent cap available — carry on */ }

  const payload = {
    systemInstruction: { parts: [{ text: SYS }] },
    contents: [{ role: "user", parts: [
      { text: "Extract this transcript into the JSON shape. Return JSON only." },
      { inline_data: { mime_type: mime === "image/jpg" ? "image/jpeg" : mime, data } }
    ] }],
    generationConfig: { temperature: 0, maxOutputTokens: 1200, responseMimeType: "application/json" }
  };

  let lastStatus = 0, lastErr = null;
  for (const model of MODELS) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
      );
      if (!r.ok) { lastStatus = r.status; lastErr = (await r.text()).slice(0, 300); if (r.status === 404 || r.status === 400 || r.status === 429) continue; return json({ error: "The reader is unavailable right now — you can type your numbers in instead." }, 200); }
      const parsed = parseModelJson(extractText(await r.json()));
      if (!parsed) { lastStatus = 200; lastErr = "unparseable"; continue; }
      if (parsed.error === "not_a_transcript") return json({ notTranscript: true });
      return json({ fields: clean(parsed), model });
    } catch (e) { lastErr = "fetch failed"; }
  }
  return json({ error: "I couldn't read that one — try a clearer photo or a PDF, or type your numbers in.", detail: lastErr, status: lastStatus }, 200);
};
