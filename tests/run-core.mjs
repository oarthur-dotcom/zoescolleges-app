// The suites that must pass before any deploy. Run: CHROME=/path/to/chrome ZC_DATA=/path/to/zoescolleges-data node tests/run-core.mjs
import { spawnSync } from 'child_process';
const SUITES = ['transcript-local-test', 'aid-local-test', 'rigor-offered-courses-test', 'acts-never-wipe-gpa-test', 'profile-roundtrip-test', 'activities-never-lower-test', 'cds-gpa-wired-test', 'parent-edits-student-grades-test', 'zoe-v2-test', 'admit-power-everywhere-test'];
let bad = 0;
for (const s of SUITES) { const r = spawnSync('node', [new URL(`./${s}.mjs`, import.meta.url).pathname], { encoding: 'utf8', timeout: 180000 }); const out = (r.stdout + r.stderr).trim().split('\n').slice(-1)[0].slice(0, 110);
  const passed = r.status === 0 && !/FAIL/.test(r.stdout.split('\n').filter(l => /^FAIL(?!ED: none)/.test(l)).join('')); if (!passed) bad++; console.log((passed ? 'PASS ' : 'FAIL ') + s + '  ' + out); }
console.log(bad ? `${bad} suite(s) failed` : 'all core suites passed'); process.exit(bad ? 1 : 0);
