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
  "You read a student's high-school academic record and return ONLY JSON, no prose. It may be an official or UNOFFICIAL transcript, a report card, a progress report, a screenshot of a school portal (PowerSchool, Aspen, Infinite Campus, Naviance, Canvas), a counselor printout, a spreadsheet, or a typed or handwritten list of courses and grades — treat all of these as valid. Photos may be tilted, folded, cropped or held in a hand; read what you can.",
  "Shape: {\"gpa\":number|null,\"gpaScale\":number|null,\"weightedGpa\":number|null,\"apIb\":number,\"honors\":number,\"dualEnrollment\":number,\"sat\":number|null,\"act\":number|null,\"courses\":[{\"name\":string,\"level\":\"AP\"|\"IB\"|\"Honors\"|\"Dual\"|\"Regular\",\"grade\":string|null,\"credits\":number|null,\"year\":number|null}],\"confidence\":\"high\"|\"medium\"|\"low\"}",
  "Rules: list EVERY course on the transcript (up to 40) with its name, level, FINAL grade exactly as printed (e.g. \"A-\", \"B+\", \"P\", \"93\"; null if the course has no final grade yet) and credits (null if not shown) and the grade level 9-12 in year if shown. Final grade: use the Final/Year column when there is one; if the course is in progress with only term or quarter grades, use null (it is not final). Grades may be letters, percentages (0-100) or points — copy them as printed. Level: Honors if the name ends in \" H\" or \" (H)\" or contains Honors/Hon/Accelerated/ACC/Advanced (not Advanced Placement), or a level column or legend marks it honors (e.g. a higher level code like 03 vs 02 when the courses with that code are the H courses, or a weighting legend); AP if it says AP or Advanced Placement; IB if IB/HL/SL; Dual if dual-enrollment, college credit, or a college course code. Otherwise Regular (CP, College Prep, Standard, Level 02 are Regular). Count AP and IB courses together in apIb, Honors in honors, Dual in dualEnrollment.",
  "Copy a cumulative GPA into gpa ONLY if one is printed and it is greater than 0 (many schools print 0 or leave it blank — then use null; we calculate it from the grades). Put a printed weighted GPA in weightedGpa. Never invent a GPA or a test score. Set confidence from how legible the image is. Be quick: read, don't deliberate.",
  "Return {\"error\":\"not_a_transcript\"} ONLY if the document has no courses and no grades at all (e.g. a photo of a person, a receipt, a college brochure). If it lists any courses or grades, extract them."
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
  if (f.courses.length >= 4) { f.apIb = n("AP") + n("IB"); f.honors = n("Honors"); f.dualEnrollment = n("Dual"); return f; }   // #75: the list is the truth
  if (!f.apIb) f.apIb = n("AP") + n("IB");
  if (!f.honors) f.honors = n("Honors");
  if (!f.dualEnrollment) f.dualEnrollment = n("Dual");
  return f;
}
// #75 (Oct 11): many schools (e.g. Brookline) print no GPA. Calculate the UNWEIGHTED GPA ourselves from the final
// letter grades, weighted by credits, on the standard 4.0 scale. Pass/fail and ungraded courses don't count.
const POINTS = { "A+": 4.0, "A": 4.0, "A-": 3.7, "B+": 3.3, "B": 3.0, "B-": 2.7, "C+": 2.3, "C": 2.0, "C-": 1.7, "D+": 1.3, "D": 1.0, "D-": 0.7, "F": 0, "E": 0 };
export function gradePoints(g) {
  if (g == null) return null; const t = String(g).trim().toUpperCase().replace(/\s+/g, "");
  if (t in POINTS) return POINTS[t];
  const n = Number(t); if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  if (n <= 4.0 && /\./.test(t)) return null;   // a GPA-like number isn't a course grade
  return n >= 93 ? 4.0 : n >= 90 ? 3.7 : n >= 87 ? 3.3 : n >= 83 ? 3.0 : n >= 80 ? 2.7 : n >= 77 ? 2.3 : n >= 73 ? 2.0 : n >= 70 ? 1.7 : n >= 67 ? 1.3 : n >= 65 ? 1.0 : 0;
}
export function calcGpa(courses) {
  let pts = 0, cr = 0, n = 0;
  for (const c of courses || []) { const p = gradePoints(c.grade); if (p == null) continue;
    const w = (typeof c.credits === "number" && c.credits > 0 && c.credits <= 10) ? c.credits : 1; if (c.credits === 0) continue;
    pts += p * w; cr += w; n++; }
  return n >= 4 && cr > 0 ? { gpa: Math.round(pts / cr * 100) / 100, courses: n, credits: Math.round(cr * 100) / 100 } : null;
}
function addCalculatedGpa(f) {
  if (f.gpa != null) return f;
  const c = calcGpa(f.courses); if (c) { f.gpa = c.gpa; f.gpaScale = 4; f.gpaCalculated = c; }
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
    courses: Array.isArray(o.courses) ? o.courses.slice(0, 40).map(c => { const name = String(c && c.name || "").slice(0, 80);
      let level = ["AP", "IB", "Honors", "Dual", "Regular"].includes(c && c.level) ? c.level : "Regular";
      if (level === "Regular" && (/\sH$/.test(name.trim()) || /\bhonors\b/i.test(name))) level = "Honors";   // "Latin II H"
      if (level === "Regular" && /^(AP|IB)\b/.test(name.trim())) level = /^IB/.test(name.trim()) ? "IB" : "AP";
      const g = c && c.grade != null && c.grade !== "" ? String(c.grade).trim().slice(0, 6) : null;
      const cr = c && c.credits != null && c.credits !== "" && Number.isFinite(Number(c.credits)) ? Number(c.credits) : null;
      const yr = c && Number.isFinite(Number(c.year)) && +c.year >= 6 && +c.year <= 12 ? +c.year : null;
      return { name, level, grade: g, credits: cr, year: yr };
    }).filter(c => c.name) : []
  };
  return out;
}

export default async (req, ctx, deps = {}) => {
  const fetchImpl = deps.fetch || fetch;
  CORS = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const user = deps.user || await requireUser(req);
  if (!user) return json({ error: "Please sign in again, then retry." }, 401);

  const key = deps.key || process.env.GEMINI_API_KEY;
  if (!key) return json({ error: null, unconfigured: true });

  let body; try { body = await req.json(); } catch { return json({ error: "bad request" }, 400); }
  const mime = String(body.mime || "").toLowerCase();
  const data = String(body.file || "");
  if (!data || !ALLOWED.includes(mime)) return json({ error: "Please upload a PDF or a photo (PNG/JPG) of the transcript." }, 400);
  // base64 length ~= 4/3 of byte size
  if (data.length * 0.75 > MAX_BYTES) return json({ error: "That file is too large — keep it under 4MB (a phone photo or a PDF export works)." }, 413);

  // Global daily hard cap (Netlify Blobs). Errors are now logged instead of silently ignored.
  const capRes = deps.cap || await bumpDailyCap("transcript-usage", DAILY_CAP);
  if (capRes.capped) return json({ error: null, capped: true });

  const payload = {
    systemInstruction: { parts: [{ text: SYS }] },
    contents: [{ role: "user", parts: [
      { text: "Extract this transcript into the JSON shape. Return JSON only." },
      { inline_data: { mime_type: mime === "image/jpg" ? "image/jpeg" : mime, data } }
    ] }],
    generationConfig: { temperature: 0, maxOutputTokens: 8192, responseMimeType: "application/json" }   // #65: was 1200 — thinking models ran out before answering
  };

  // #75: a dense transcript made the thinking models take >60s and Netlify cut the request off, so the page showed a
  // generic failure. Now: thinking kept minimal, each try is capped, and we always answer before the platform limit.
  const started = Date.now(), DEADLINE = deps.deadlineMs || 50000, PER_TRY = deps.perTryMs || 38000, MIN_LEFT = deps.minLeftMs || 4000;
  let lastStatus = 0, lastErr = null, sawEmpty = false, timedOut = false;
  const call = async (model, thinking) => {
    const left = DEADLINE - (Date.now() - started); if (left < MIN_LEFT) return { skip: true };
    const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), Math.min(PER_TRY, left));
    const body = thinking ? { ...payload, generationConfig: { ...payload.generationConfig, thinkingConfig: thinking } } : payload;
    try { return { r: await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ac.signal }) }; }
    catch (e) { return { aborted: ac.signal.aborted, failed: true }; } finally { clearTimeout(tm); }
  };
  for (const model of MODELS) {
    try {
      // Gemini 2.5 takes thinkingBudget (0 = off); Gemini 3 takes thinkingLevel. Try the matching one, then plain.
      const tries = /2\.5/.test(model) ? [{ thinkingBudget: 0 }, null] : [{ thinkingLevel: "low" }, null];
      let res = null;
      for (const t of tries) { res = await call(model, t); if (res.skip || res.failed) break; if (res.r.status === 400 && t) { lastErr = "config"; continue; } break; }
      if (res.skip) { timedOut = true; break; }
      if (res.failed) { if (res.aborted) timedOut = true; lastErr = res.aborted ? "timeout" : "fetch failed"; continue; }
      const r = res.r;
      if (!r.ok) { lastStatus = r.status; lastErr = (await r.text()).slice(0, 300); if (r.status === 404 || r.status === 400 || r.status === 429 || r.status >= 500) continue; return json({ error: "The reader is unavailable right now — you can type your numbers in instead." }, 200); }
      const parsed = parseModelJson(extractText(await r.json()));
      if (!parsed) { lastStatus = 200; lastErr = "unparseable"; continue; }
      const norm = normalize(parsed);
      if (norm.error === "not_a_transcript") return json({ notTranscript: true });
      const fields = addCalculatedGpa(fromCourses(clean(norm)));
      if (isEmpty(fields)) { sawEmpty = true; console.log("transcript-read: empty read from", model, "keys:", Object.keys(parsed).slice(0, 12).join(",")); continue; }   // keys only, never content
      return json({ fields, model });
    } catch (e) { lastErr = "fetch failed"; }
  }
  if (sawEmpty) return json({ empty: true });
  if (timedOut) return json({ error: "That page took too long to read — try again in a minute, or a photo of just the grades section. You can also type the numbers in.", slow: true }, 200);
  return json({ error: "I couldn't read that one — try a clearer photo or a PDF, or type your numbers in.", detail: lastErr, status: lastStatus }, 200);
};
