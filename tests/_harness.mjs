// Shared helper for the Oct 28 review-fix tests: static server + sample-family demo at a given width.
import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
export const ROOT = new URL('..', import.meta.url).pathname;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4'};
export function serve(){ const srv=http.createServer((q,r)=>{ let p=decodeURIComponent(q.url.split('?')[0]); if(p==='/')p='/index.html'; fs.readFile(path.join(ROOT,p),(e,d)=>{ if(e){r.writeHead(404);return r.end();} r.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(d); }); }).listen(0); return {srv, port:srv.address().port}; }
export const launch = () => chromium.launch({ executablePath: process.env.CHROME || undefined, args:['--no-sandbox'] });
export async function demo(b, port, W, H=844){
  const ctx = await b.newContext({ viewport:{width:W,height:H}, deviceScaleFactor: W<500?2:1, hasTouch: W<500, isMobile: W<500 });
  const page = await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  await page.goto(`http://localhost:${port}/index.html`); await page.waitForFunction(()=>typeof startDemo==='function' && document.getElementById('demo-start'),null,{timeout:60000});
  await page.evaluate(()=>startDemo()); await page.waitForFunction(()=>state.me && state.catalog && state.catalog.length>0 && state.dl2627,null,{timeout:60000}); await page.waitForTimeout(700);
  return {ctx,page,errs};
}
