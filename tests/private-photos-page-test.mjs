import { launch, newPage } from '/tmp/claude-0/audit-ui/lib.mjs'; import http from 'http'; import fs from 'fs'; import path from 'path';
const CAT=fs.readFileSync('/home/claude/zoescolleges-data/colleges.json');
const srv=http.createServer((q,r)=>{const f=path.join('/tmp/claude-0/f15/site',decodeURIComponent(q.url.split('?')[0])); fs.readFile(f,(e,d)=>{ if(e){r.writeHead(404);return r.end();} r.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':'text/html'}); r.end(d);});}).listen(8786);
const b=await launch(); const {ctx,page,log}=await newPage(b,{width:1280,height:900},{plan:'family'});
await page.route(/jsdelivr.*colleges\.json/,r=>r.fulfill({contentType:'application/json',body:CAT}));
await page.goto('http://localhost:8786/index.html'); await page.waitForFunction(()=>typeof state!=="undefined"&&state.catalog&&state.catalog.length>0&&state.me,null,{timeout:60000});
const r=await page.evaluate(async()=>{
  const st=sb.storage.from('campus-photos').__proto__||{}; 
  const realFrom=sb.storage.from.bind(sb.storage);
  sb.storage.from=(bk)=>{ const o=realFrom(bk); o.createSignedUrls=async(paths,exp)=>({data:paths.map(p=>({path:p,signedUrl:'https://signed.example/'+p+'?token=x&exp='+exp})),error:null}); o.upload=async()=>({data:{path:'x'},error:null}); return o; };
  const sid=state.schools[0].school_id;
  state.photos=[{id:'p1',school_id:sid,path:`${state.family.id}/${sid}/old.jpg`,url:'https://heppy.supabase.co/storage/v1/object/public/campus-photos/old.jpg'}];
  await signPhotoUrls(state.photos);
  const signedOnLoad=state.photos[0].url;
  BACKEND.photos=true; BACKEND.photostore=true; window.__writes.length=0;
  const blob=new Blob([new Uint8Array(100)],{type:'image/jpeg'}); const realResize=window.resizeImage; window.resizeImage=async()=>blob;
  let addErr=null; try{ await addPhoto(sid, blob, 'test'); }catch(e){ addErr=String(e); }
  const ins=window.__writes.find(w=>w.table==='photos'&&w.op==='insert');
  return {signedOnLoad, insertedUrl: ins? ins.p.url : 'no insert', insertedPath: ins? !!ins.p.path : null, addErr};
});
r.pageErrors=log.pageerr; console.log(JSON.stringify(r,null,1)); await b.close(); srv.close();
