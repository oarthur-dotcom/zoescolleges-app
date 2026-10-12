// Reads an uploaded high-school transcript (image or PDF) with Gemini vision and
// returns structured fields to pre-fill the Academic Profile. The student always
// reviews and confirms before anything is saved.
// Privacy: the file is sent to Google for parsing and NOT stored by us; we keep
// no copy. Cost guard: global daily hard cap via Netlify Blobs.

// Fix #8: both 2.5 models were failing live; the "-latest" aliases (also vision-capable) answer.
const MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
import { corsFor, requireUser, bumpDailyCap } from "../lib/guard.mjs";
const DAILY_CAP = 150;                 // global transcript reads/day
const MAX_BYTES = 4 * 1024 * 1024;     // 4MB file: base64 (+33%) must stay under Netlify's ~6MB request limit
const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"];

let CORS = {};
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

// #65: models sometimes wrap the answer ({"transcript":{...}}) or use other key names; an empty read
// used to come back as a "successful" table of blanks. Normalize, count from the course list, and
// tell the page honestly when nothing usable was found.
const ALIASES = { gpa: ["gpa", "unweightedGpa", "unweighted_gpa", "cumulativeGpa", "cumulative_gpa", "gpaUnweighted"],
  gpaScale: ["gpaScale", "gpa_scale", "scale"], weightedGpa: ["weightedGpa", "weighted_gpa", "gpaWeighted"],
  apIb: ["apIb", "ap_ib", "apIbCount", "ap", "apCount", "ap_courses"], honors: ["honors", "honorsCount", "honors_courses", "honorsCourses"],
  dualEnrollment: ["dualEnrollment", "dual_enrollment", "dual", "dualCount"], sat: ["sat", "satTotal", "sat_total"], act: ["act", "actComposite", "act_composite"],
  courses: ["courses", "courseList", "course_list"], confidence: ["confidence"], error: ["error"] };
function normalize(o) {
  if (!o || typeof o !== "object") return {};
  const keys = Object.keys(o);
  if (keys.length === 1 && o[keys[0]] && typeof o[keys[0]] === "object" && !Array.isArray(o[keys[0]])) o = o[keys[0]];   // unwrap {"transcript":{...}}
  const out = {};
  for (const [k, al] of Object.entries(ALIASES)) for (const a of al) if (o[a] !== undefined && o[a] !== null && o[a] !== "") { out[k] = o[a]; break; }
  return out;
}
function fromCourses(f) {
  const n = lv => f.courses.filter(c => c.level === lv).length;
  if (!f.apIb) f.apIb = n("AP") + n("IB");
  if (!f.honors) f.honors = n("Honors");
  if (!f.dualEnrollment) f.dualEnrollment = n("Dual");
  return f;
}
const isEmpty = f => f.gpa == null && f.weightedGpa == null && f.sat == null && f.act == null && !f.apIb && !f.honors && !f.dualEnrollment && !f.courses.length;

function clean(o) {
  // null/""/0 mean "not on the transcript" -> null (Number(null) is 0, which showed as "SAT 0")
  const num = (v, max) => { if (v == null || v === "") return null; const n = Number(v); return Number.isFinite(n) && n > 0 && (max == null || n <= max) ? n : null; };
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
  CORS = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const user = await requireUser(req);
  if (!user) return json({ error: "Please sign in again, then retry." }, 401);

  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: null, unconfigured: true });

  let body; try { body = await req.json(); } catch { return json({ error: "bad request" }, 400); }
  const mime = String(body.mime || "").toLowerCase();
  const data = String(body.file || "");
  if (!data || !ALLOWED.includes(mime)) return json({ error: "Please upload a PDF or a photo (PNG/JPG) of the transcript." }, 400);
  // base64 length ~= 4/3 of byte size
  if (data.length * 0.75 > MAX_BYTES) return json({ error: "That file is too large — keep it under 4MB (a phone photo or a PDF export works)." }, 413);

  // Global daily hard cap (Netlify Blobs). Errors are now logged instead of silently ignored.
  const capRes = await bumpDailyCap("transcript-usage", DAILY_CAP);
  if (capRes.capped) return json({ error: null, capped: true });

  const payload = {
    systemInstruction: { parts: [{ text: SYS }] },
    contents: [{ role: "user", parts: [
      { text: "Extract this transcript into the JSON shape. Return JSON only." },
      { inline_data: { mime_type: mime === "image/jpg" ? "image/jpeg" : mime, data } }
    ] }],
    generationConfig: { temperature: 0, maxOutputTokens: 8192, responseMimeType: "application/json" }   // #65: was 1200 — thinking models ran out before answering
  };

  let lastStatus = 0, lastErr = null, sawEmpty = false;
  for (const model of MODELS) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
      );
      if (!r.ok) { lastStatus = r.status; lastErr = (await r.text()).slice(0, 300); if (r.status === 404 || r.status === 400 || r.status === 429) continue; return json({ error: "The reader is unavailable right now — you can type your numbers in instead." }, 200); }
      const parsed = parseModelJson(extractText(await r.json()));
      if (!parsed) { lastStatus = 200; lastErr = "unparseable"; continue; }
      const norm = normalize(parsed);
      if (norm.error === "not_a_transcript") return json({ notTranscript: true });
      const fields = fromCourses(clean(norm));
      if (isEmpty(fields)) { sawEmpty = true; console.log("transcript-read: empty read from", model, "keys:", Object.keys(parsed).slice(0, 12).join(",")); continue; }   // keys only, never content
      return json({ fields, model });
    } catch (e) { lastErr = "fetch failed"; }
  }
  if (sawEmpty) return json({ empty: true });
  return json({ error: "I couldn't read that one — try a clearer photo or a PDF, or type your numbers in.", detail: lastErr, status: lastStatus }, 200);
};
