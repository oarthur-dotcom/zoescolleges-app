// #75 transcript reader: calculates GPA when the school prints none (Brookline-style), counts "… H" as honors,
// always answers before Netlify's 60s cut-off, and retries without the thinking setting if a model rejects it. No network.
import fs from 'fs';
const mod = await import(new URL('../netlify/functions/transcript-read.mjs', import.meta.url)); const fn = mod.default;
const req = () => new Request("https://zoescolleges.com/x", { method: "POST", headers: { origin: "https://zoescolleges.com", "content-type": "application/json" }, body: JSON.stringify({ file: "aGVsbG8=", mime: "image/jpeg" }) });
const reply = t => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] }), { status: 200 });
const base = { user: { id: "u1" }, key: "k", cap: { capped: false } };
const ok = {}, R = {};
// A Brookline-style transcript: letter grades + credits, "GPA 0" printed, honors marked with a trailing H. (Course names/grades only.)
const C = (name, grade, credits, year) => ({ name, level: "Regular", grade, credits, year });
const courses = [
  C("Advisory FR16","P",0,9), C("Drawing: Foundations","A",0.5,9), C("Geometry","A-",1,9), C("Latin I","B+",1,9), C("Lifetime Wellness Z","A",0.5,9),
  C("Physics I H","C",1,9), C("Restaurant Culinary Careers I","A",0.5,9), C("Rsp To Lit H","B",1,9), C("SELT Tutorial","P",1,9), C("Wrld Hst I","B",1,9),
  C("Advisory SO16","P",0,10), C("Chemistry I","A-",1,10), C("Culinary Exploratory","B+",0.5,10), C("Digital Photo Foundations","A",0.5,10), C("Global Studies H","B",1,10),
  C("Interact Math Pgrm II H","B-",1,10), C("Latin II H","B",1,10), C("Real World Lit H","B",1,10), C("SELT Tutorial","B+",1,10), C("ST Field Hockey","P",0.25,10),
  C("Advisory JR16","P",0,11), C("American Literature H","A-",1,11), C("Interact Math Pgrm III H","B",1,11), C("Investigative Bio I H","B",1,11), C("Latin III H","B+",1,11),
  C("SELT Tutorial","P",1,11), C("ST Rugby","P",0.25,11), C("US History H","B-",1,11)];
let sent = [];
let j = await (await fn(req(), {}, { ...base, fetch: async (u, o) => { sent.push(JSON.parse(o.body)); return reply(JSON.stringify({ gpa: 0, honors: 3, apIb: 0, courses, confidence: "high" })); } })).json();
R.brookline = j.fields && { gpa: j.fields.gpa, calc: j.fields.gpaCalculated, honors: j.fields.honors, apIb: j.fields.apIb, n: j.fields.courses.length };
// hand check: 3 years of letter grades, credit-weighted, P excluded. SELT Tutorial 10th grade shows B+ on the transcript (1 credit).
const expect = mod.calcGpa(courses).gpa;
ok.calculatesGpaWhenSchoolPrintsZero = j.fields && j.fields.gpa === expect && j.fields.gpaScale === 4 && j.fields.gpaCalculated && j.fields.gpaCalculated.courses === 21;
ok.gpaValueRight = Math.abs(expect - 3.2) < 0.02;
ok.honorsFromTrailingH = j.fields && j.fields.honors === 11 && j.fields.apIb === 0;
ok.keepsAllCourses = j.fields && j.fields.courses.length === 28 && j.fields.courses.some(c => c.grade === "B+" && c.name === "Latin III H");
ok.thinkingKeptLow = sent[0] && sent[0].generationConfig.thinkingConfig && sent[0].generationConfig.thinkingConfig.thinkingLevel === "low";
// printed GPA wins over the calculation
j = await (await fn(req(), {}, { ...base, fetch: async () => reply(JSON.stringify({ gpa: 3.61, gpaScale: 4, courses })) })).json();
ok.printedGpaWins = j.fields && j.fields.gpa === 3.61 && !j.fields.gpaCalculated;
// grade scale
ok.gradeScale = mod.gradePoints("A-") === 3.7 && mod.gradePoints("b+") === 3.3 && mod.gradePoints("P") === null && mod.gradePoints("94") === 4 && mod.gradePoints("3.5") === null;
// a model rejects the thinking setting (400) -> same model again without it
let calls = 0; j = await (await fn(req(), {}, { ...base, fetch: async (u, o) => { calls++; const b = JSON.parse(o.body); if (b.generationConfig.thinkingConfig) return new Response("bad thinking", { status: 400 }); return reply(JSON.stringify({ courses })); } })).json();
ok.retriesWithoutThinking = j.fields && calls === 2;
// a hung model never runs past the deadline; the page gets a clear "took too long" answer
const t0 = Date.now();
j = await (await fn(req(), {}, { ...base, deadlineMs: 1500, perTryMs: 600, minLeftMs: 100, fetch: (u, o) => new Promise((res, rej) => { o.signal.addEventListener('abort', () => rej(new Error('aborted'))); }) })).json();
R.slowMs = Date.now() - t0; R.slow = j;
ok.answersBeforeDeadline = R.slowMs >= 550 && R.slowMs < 2500 && j.slow === true && /too long/.test(j.error);
// 5xx from one model -> next model
calls = 0; j = await (await fn(req(), {}, { ...base, fetch: async () => (++calls === 1 ? new Response("down", { status: 503 }) : reply(JSON.stringify({ courses }))) })).json();
ok.skipsServerError = !!j.fields;
R.ok = ok; R.allPass = Object.values(ok).every(Boolean); console.log(JSON.stringify(R, null, 1));
fs.writeFileSync(new URL('./transcript-gpa-result-2026-10-11.json', import.meta.url), JSON.stringify(R, null, 1));
