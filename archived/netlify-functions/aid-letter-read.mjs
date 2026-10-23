// Reads a college financial-aid award letter (photo or PDF) with Gemini vision and returns the numbers so the
// family can review them (#52, Oct 11). Nothing is saved by us: the file goes to Google for reading and is not
// kept; the page stores only the reviewed numbers, on the family's device.
// Cost guard: global daily cap via Netlify Blobs. Signed-in users only; zoescolleges.com origins only.
import { corsFor, requireUser, bumpDailyCap } from "../lib/guard.mjs";
const MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
const DAILY_CAP = 100;
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"];
let CORS = {};
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", ...CORS } });

const SYS = [
  "You extract numbers from a U.S. college financial-aid award letter (offer letter) image or PDF. Return ONLY JSON, no prose.",
  "Shape: {\"school\":string|null,\"academicYear\":string|null,\"costOfAttendance\":number|null,\"directCost\":number|null,",
  "\"grants\":[{\"name\":string,\"amount\":number}],\"loans\":[{\"name\":string,\"amount\":number,\"kind\":\"subsidized\"|\"unsubsidized\"|\"parent_plus\"|\"private\"|\"other\"}],",
  "\"workStudy\":number|null,\"period\":\"year\"|\"semester\"|\"unknown\",\"confidence\":\"high\"|\"medium\"|\"low\"}.",
  "Rules: grants = free money (grants, scholarships, awards, tuition discounts) — NOT loans. Loans include Direct Subsidized/Unsubsidized, Parent PLUS and private loans.",
  "Use yearly amounts; if the letter shows per-semester amounts, add the semesters to get the year and set period to \"year\". costOfAttendance = total cost of attendance (tuition, fees, housing, food, books, personal, travel); directCost = only what the college bills (tuition, fees, on-campus housing and meals).",
  "Numbers are plain dollars (no $ or commas). Never invent a number: use null or omit the line if it isn't on the letter.",
  "If the document is clearly NOT a financial-aid offer, return {\"error\":\"not_an_aid_letter\"}."
].join(" ");
const extractText = j => ((j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || []).map(p => p.text || "").join("").trim();
function parseModelJson(txt) { if (!txt) return null; let s = txt.trim(); if (s.startsWith("```")) s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}"); if (a === -1 || b < a) return null; try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; } }
export function cleanAid(o) {
  const money = v => { if (v == null || v === "") return null; const n = Number(String(v).replace(/[$,\s]/g, "")); return Number.isFinite(n) && n >= 0 && n <= 200000 ? Math.round(n) : null; };
  const lines = (a, extra) => (Array.isArray(a) ? a : []).slice(0, 15).map(x => ({ name: String(x && x.name || "").slice(0, 80) || "Unnamed", amount: money(x && x.amount), ...(extra ? extra(x) : {}) })).filter(x => x.amount != null && x.amount > 0);
  return {
    school: o.school ? String(o.school).slice(0, 120) : null, academicYear: o.academicYear ? String(o.academicYear).slice(0, 20) : null,
    costOfAttendance: money(o.costOfAttendance), directCost: money(o.directCost),
    grants: lines(o.grants), loans: lines(o.loans, x => ({ kind: ["subsidized", "unsubsidized", "parent_plus", "private", "other"].includes(x && x.kind) ? x.kind : "other" })),
    workStudy: money(o.workStudy), period: ["year", "semester", "unknown"].includes(o.period) ? o.period : "unknown",
    confidence: ["high", "medium", "low"].includes(o.confidence) ? o.confidence : "medium"
  };
}
export default async (req) => {
  CORS = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const user = await requireUser(req);
  if (!user) return json({ error: "Please sign in again, then retry." }, 401);
  const key = process.env.GEMINI_API_KEY; if (!key) return json({ error: null, unconfigured: true });
  let body; try { body = await req.json(); } catch { return json({ error: "bad request" }, 400); }
  const mime = String(body.mime || "").toLowerCase(), data = String(body.file || "");
  if (!data || !ALLOWED.includes(mime)) return json({ error: "Please upload a PDF or a photo (PNG/JPG) of the aid letter." }, 400);
  if (data.length * 0.75 > MAX_BYTES) return json({ error: "That file is too large — keep it under 4MB (a phone photo or a PDF works)." }, 413);
  const capRes = await bumpDailyCap("aid-letter-usage", DAILY_CAP); if (capRes.capped) return json({ error: null, capped: true });
  const payload = { systemInstruction: { parts: [{ text: SYS }] },
    contents: [{ role: "user", parts: [{ text: "Extract this financial-aid offer into the JSON shape. Return JSON only." }, { inline_data: { mime_type: mime === "image/jpg" ? "image/jpeg" : mime, data } }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 1400, responseMimeType: "application/json" } };
  let lastStatus = 0, lastErr = null;
  for (const model of MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) { lastStatus = r.status; lastErr = (await r.text()).slice(0, 300); if ([400, 404, 429].includes(r.status)) continue; console.error("[aid-letter]", r.status); return json({ error: "The reader is busy right now — try again in a minute, or type the numbers in." }); }
      const parsed = parseModelJson(extractText(await r.json()));
      if (!parsed) { lastStatus = 200; lastErr = "unparseable"; continue; }
      if (parsed.error === "not_an_aid_letter") return json({ notAidLetter: true });
      return json({ fields: cleanAid(parsed), model });
    } catch (e) { lastErr = "fetch failed"; }
  }
  console.error("[aid-letter] all models failed", lastStatus, String(lastErr || "").slice(0, 200));
  return json({ error: "I couldn't read that one — try a clearer photo or a PDF, or type the numbers in.", status: lastStatus });
};
