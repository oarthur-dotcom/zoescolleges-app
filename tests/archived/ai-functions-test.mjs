// Local test of the AI functions with fake Supabase + Gemini (no real calls, no real key).
process.env.GEMINI_API_KEY = "test-key";
const calls = [];
let geminiFail = new Set();          // models that should return 404
globalThis.fetch = async (url, opts={}) => {
  url = String(url); calls.push(url.replace(/key=[^&]+/,'key=***'));
  if (url.includes("/auth/v1/user")) {
    const a = (opts.headers||{}).Authorization || "";
    return a === "Bearer GOOD" ? new Response(JSON.stringify({id:"u1"}),{status:200}) : new Response("{}",{status:401});
  }
  if (url.includes("generativelanguage")) {
    const m = url.match(/models\/([^:]+):/)[1];
    if (geminiFail.has(m)) return new Response("not found",{status:404});
    const isTx = String(opts.body).includes("inline_data");
    const text = isTx ? JSON.stringify({gpa:3.7,gpaScale:4,apIb:3,honors:2,dualEnrollment:0,sat:null,act:null,courses:[],confidence:"high"}) : `answer from ${m}`;
    return new Response(JSON.stringify({candidates:[{content:{parts:[{text}]}}]}),{status:200});
  }
  return new Response("unexpected",{status:599});
};
const zoe = (await import("./netlify/functions/zoe-ai.mjs")).default;
const tx  = (await import("./netlify/functions/transcript-read.mjs")).default;
const req = (fn, {method="POST", origin="https://zoescolleges.com", token, body}={}) => fn(new Request("https://zoescolleges.com/x", {method, headers:{origin, "content-type":"application/json", ...(token?{authorization:"Bearer "+token}:{})}, body: method==="POST"?JSON.stringify(body||{}):undefined}));
const show = async r => ({status:r.status, acao:r.headers.get("access-control-allow-origin"), body: r.status===204?null:await r.json()});
const out = {};
out.preflight_from_our_site  = await show(await req(zoe,{method:"OPTIONS"}));
out.preflight_from_evil_site = await show(await req(zoe,{method:"OPTIONS", origin:"https://evil.example"}));
out.ask_no_login     = await show(await req(zoe,{body:{q:"what is early action?"}}));
out.ask_bad_login    = await show(await req(zoe,{token:"FORGED", body:{q:"what is early action?"}}));
calls.length=0;
out.ask_signed_in    = await show(await req(zoe,{token:"GOOD", body:{q:"what is early action?"}}));
out.ask_signed_in_gemini_calls = calls.filter(c=>c.includes("generativelanguage")).map(c=>c.match(/models\/([^:]+)/)[1]);
geminiFail = new Set(["gemini-flash-lite-latest"]); calls.length=0;
out.ask_when_first_model_down = await show(await req(zoe,{token:"GOOD", body:{q:"hi"}}));
geminiFail = new Set();
const small = Buffer.alloc(200*1024,1).toString("base64"), big = Buffer.alloc(5*1024*1024,1).toString("base64");
out.tx_no_login   = await show(await req(tx,{body:{file:small,mime:"image/png"}}));
out.tx_too_big    = await show(await req(tx,{token:"GOOD", body:{file:big,mime:"image/png"}}));
calls.length=0;
out.tx_signed_in  = await show(await req(tx,{token:"GOOD", body:{file:small,mime:"image/png"}}));
out.tx_first_model = calls.filter(c=>c.includes("generativelanguage")).map(c=>c.match(/models\/([^:]+)/)[1])[0];
console.log(JSON.stringify(out,null,1));
