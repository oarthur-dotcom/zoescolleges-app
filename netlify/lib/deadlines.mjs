// Deadline reading shared by the reminder job — same rules as the page (Fix #11).
const MON = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11};
export function dateIn(str){
  const t = String(str || "");
  let m = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i);
  if (m) return ymd(+m[3], MON[m[1].toLowerCase()], +m[2]);
  m = t.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/); if (m) return ymd(+m[3], +m[1]-1, +m[2]);
  m = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/); if (m) return ymd(+m[1], +m[2]-1, +m[3]);
  return null;
}
function ymd(y, mo, d){ return `${y}-${String(mo+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`; }   // calendar date, no timezone
export function kindOf(str, fallback){
  const t = String(str || "").toLowerCase();
  if (/early decision ii|\bed ?2\b|\bedii\b/.test(t)) return "Early Decision II";
  if (/early decision|\bed\b|binding/.test(t)) return "Early Decision";
  if (/restrictive|single.choice/.test(t)) return "Restrictive Early Action";
  if (/early action|\bea\b/.test(t)) return "Early Action";
  if (/priority/.test(t)) return "Priority";
  return fallback;
}
// `chosen` (optional) is the plan a family recorded for this school, "Kind|YYYY-MM-DD" (same key the app writes as checklist._plan).
// When it matches one of the school's dated rounds only that round is returned; no choice, or one that no longer matches, returns every round.
function onlyChosen(list, chosen){
  if (!chosen) return list;
  const hit = list.filter(x => `${x.kind}|${x.date}` === chosen);
  // A chosen round that has already closed must not hide the later rounds that are still open.
  const today = new Date().toISOString().slice(0,10);
  return hit.length && hit[0].date >= today ? hit : list;
}
export function deadlineList(info, dl, chosen){
  // 2026–27 rounds from deadlines-2026-27.json (sourced from each school's site) win when present.
  if (dl && Array.isArray(dl.rounds) && dl.rounds.length)
    return onlyChosen(dl.rounds.filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.date)).map(r => ({ kind: r.kind, date: r.date, text: r.name || r.kind })).sort((a,b)=> a.date < b.date ? -1 : 1), chosen);
  const md = (info && info.muse && info.muse.deadlines) || {};
  const raw = [[info.earlyDeadline,"Early"],[md.early_date,"Early"],[info.regularDeadline,"Regular"],[md.regular_date,"Regular"]];
  const byKey = new Map();
  for (const [str, fb] of raw){ const d = dateIn(str); if (!d) continue; const k = kindOf(str, fb); const key = fb + d;
    const prev = byKey.get(key); if (!prev || (prev.kind === fb && k !== fb)) byKey.set(key, { kind:k, date:d, text:String(str) }); }
  return onlyChosen([...byKey.values()].sort((a,b)=> a.date < b.date ? -1 : 1), chosen);
}
// whole days from today (YYYY-MM-DD) to date (YYYY-MM-DD)
export function daysBetween(today, date){ return Math.round((Date.parse(date+"T00:00:00Z") - Date.parse(today+"T00:00:00Z")) / 86400000); }
// Reminder windows: 30 -> (14,30], 14 -> (3,14], 3 -> [0,3]. A missed day is caught up next run.
export const WINDOWS = [{d:30, lo:15, hi:30}, {d:14, lo:4, hi:14}, {d:3, lo:0, hi:3}];
export function windowFor(n){ const w = WINDOWS.find(w => n >= w.lo && n <= w.hi); return w ? w.d : null; }
