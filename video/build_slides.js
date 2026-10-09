// Renders on-brand 1920x1080 slides for the Zoe's Colleges explainer using Playwright.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'frames');
fs.mkdirSync(OUT, {recursive:true});

const TEAL="#3cc2c4", AMBER="#e8ac45", PLUM="#d27fbd";
const slides = [
  { accent:TEAL,  kicker:"Beta", title:"Zoe’s <span>Colleges</span>", sub:"The college search, done as a family.", big:true },
  { accent:TEAL,  kicker:"Real data, not guesswork", title:"308 colleges.<br>Official federal data.", sub:"Admission rates · test scores · net price · graduation rates · 10-year earnings" },
  { accent:AMBER, kicker:"Made for you", title:"Your profile.<br>Your priorities.", sub:"Slide toward what matters — cost, size, selectivity, spirit. Every school gets a personal <b>match %</b> and an honest <b>admission-chance</b> read." },
  { accent:PLUM,  kicker:"Everyone’s voice counts", title:"Rate it together.", sub:"Add your whole family with one code. Everyone rates with stars — and you only ever control your own." },
  { accent:TEAL,  kicker:"Visit days", title:"Capture the campus.", sub:"Snap photos on your visits, save notes, and watch your shared favorites rise to the top." },
  { accent:AMBER, kicker:"", title:"Zoe’s <span>Colleges</span>", sub:"The biggest decision, made together — calmer, clearer, even a little fun.", cta:"Start your family’s board today", big:true },
];

function html(s){
  return `<!doctype html><html><head><meta charset="utf8">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Spline+Sans+Mono:wght@500&display=swap" rel="stylesheet">
  <style>
  *{margin:0;box-sizing:border-box}
  html,body{width:1920px;height:1080px;overflow:hidden}
  body{background:
      radial-gradient(1200px 700px at 18% -12%, ${s.accent}22, transparent 60%),
      radial-gradient(1100px 760px at 100% 118%, #8e3b7a2e, transparent 58%),
      #0d1322;
    color:#e9edf6;font-family:"Bricolage Grotesque",sans-serif;
    display:flex;flex-direction:column;justify-content:center;padding:150px 170px}
  .kicker{font-family:"Spline Sans Mono",monospace;font-size:30px;letter-spacing:.32em;text-transform:uppercase;color:${s.accent};margin-bottom:34px;height:36px}
  h1{font-weight:800;letter-spacing:-.02em;line-height:1.02;font-size:${s.big?'150px':'118px'};text-shadow:0 2px 40px rgba(0,0,0,.35)}
  h1 span{color:${s.accent}}
  .sub{margin-top:40px;font-size:46px;line-height:1.35;color:#b7c0d5;max-width:1360px;font-weight:400}
  .sub b{color:#e9edf6;font-weight:600}
  .rule{margin-top:52px;width:150px;height:8px;border-radius:99px;background:${s.accent};box-shadow:0 0 30px ${s.accent}aa}
  .cta{margin-top:56px;display:inline-block;background:${s.accent};color:#0d1322;font-weight:700;font-size:40px;padding:22px 42px;border-radius:18px;width:max-content}
  .url{position:absolute;bottom:70px;left:170px;font-family:"Spline Sans Mono",monospace;font-size:28px;color:#8792ab}
  .mark{position:absolute;top:70px;right:170px;font-family:"Spline Sans Mono",monospace;font-size:26px;color:#8792ab;letter-spacing:.1em}
  </style></head><body>
    ${s.kicker?`<div class="kicker">${s.kicker}</div>`:`<div class="kicker"></div>`}
    <h1>${s.title}</h1>
    ${s.sub?`<div class="sub">${s.sub}</div>`:""}
    ${!s.cta?`<div class="rule"></div>`:""}
    ${s.cta?`<div class="cta">${s.cta} →</div>`:""}
    <div class="mark">ZOE’S COLLEGES</div>
    ${s.cta?`<div class="url">zoescolleges.com</div>`:""}
  </body></html>`;
}

(async()=>{
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{width:1920,height:1080}, deviceScaleFactor:1 });
  for(let i=0;i<slides.length;i++){
    await page.setContent(html(slides[i]), {waitUntil:'networkidle'});
    try{ await page.evaluate(()=>document.fonts.ready); }catch(e){}
    await page.waitForTimeout(350);
    const f = path.join(OUT, `slide${i+1}.png`);
    await page.screenshot({ path:f });
    console.log("wrote", f);
  }
  await browser.close();
  console.log("DONE", slides.length, "slides");
})().catch(e=>{ console.error("ERR", e.message); process.exit(1); });
