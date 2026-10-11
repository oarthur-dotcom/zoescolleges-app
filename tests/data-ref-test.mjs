// #37: the page and the functions read the SAME exact data release, and nothing reads "@live" any more.
import fs from 'fs'; import { execSync } from 'child_process';
const { DATA_REF } = await import('../netlify/lib/data-ref.mjs');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const pageRef = (html.match(/const DATA_REF = "([0-9a-f]{7,40})"/) || [])[1];
const live = execSync('git -C /home/claude/zoescolleges-data rev-parse --short origin/live').toString().trim();
const files = ['../index.html', '../netlify/functions/campus-pulse.mjs', '../netlify/functions/deadline-reminders.mjs', '../netlify/functions/pulse-weekly.mjs'];
const ok = { sameRefPageAndFunctions: pageRef === DATA_REF, refIsDataLive: live.startsWith(DATA_REF) || DATA_REF.startsWith(live),
  noLiveBranchLinks: files.every(f => !/zoescolleges-data@live/.test(fs.readFileSync(new URL(f, import.meta.url), 'utf8'))) };
console.log(JSON.stringify({ DATA_REF, pageRef, live, ok, allPass: Object.values(ok).every(Boolean) }));
