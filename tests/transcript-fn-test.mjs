// #65 transcript reader: unwraps odd shapes, counts from the course list, reports an empty read honestly. No network.
process.env.GEMINI_API_KEY = "test-key";
let replies = [], sent = [];
globalThis.fetch = async (url, opts = {}) => { url = String(url);
  if (url.includes("/auth/v1/user")) return new Response(JSON.stringify({ id: "u1" }), { status: 200 });
  if (url.includes("generativelanguage")) { sent.push(JSON.parse(opts.body)); const t = replies.length ? replies.shift() : "{}"; return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] }), { status: 200 }); }
  return new Response("x", { status: 599 }); };
const fn = (await import(new URL('../netlify/functions/transcript-read.mjs', import.meta.url))).default;
const call = async (r) => { replies = r.slice(); sent = []; const res = await fn(new Request("https://zoescolleges.com/x", { method: "POST", headers: { origin: "https://zoescolleges.com", "content-type": "application/json", authorization: "Bearer t" }, body: JSON.stringify({ file: "aGVsbG8=", mime: "image/jpeg" }) })); return res.json(); };
const ok = {}, R = {};
let j = await call([JSON.stringify({ transcript: { unweighted_gpa: 3.8, gpa_scale: 4, courses: [{ name: "English 10 Honors", level: "Honors" }, { name: "Chem Honors", level: "Honors" }, { name: "AP Bio", level: "AP" }, { name: "Gym", level: "Regular" }] } })]);
R.wrapped = j; ok.unwrapsAndAliases = j.fields && j.fields.gpa === 3.8 && j.fields.gpaScale === 4;
ok.countsFromCourses = j.fields && j.fields.honors === 2 && j.fields.apIb === 1;
j = await call(["{}", "{}", "{}", "{}"]); R.empty = j; ok.emptyIsHonest = j.empty === true && !j.fields;
j = await call(["{}", JSON.stringify({ gpa: 3.5, honors: 6, apIb: 0, dualEnrollment: 0, courses: [] })]); R.second = j; ok.triesNextModelOnEmpty = j.fields && j.fields.honors === 6;
j = await call([JSON.stringify({ error: "not_a_transcript" })]); ok.notTranscript = j.notTranscript === true;
await call([JSON.stringify({ gpa: 3.2 })]); ok.roomToAnswer = sent[0].generationConfig.maxOutputTokens >= 4000;
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R.ok, null, 1), R.allPass);
