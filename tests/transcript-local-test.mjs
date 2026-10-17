// Free in-browser transcript reader: rules that turn text lines into courses, grades, GPA and test scores.
import fs from "fs"; import vm from "vm";
const src=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
const code=src.slice(src.indexOf("/* TXLOCAL-START"),src.indexOf("/* TXLOCAL-END */"));
const ctx={window:{},document:{},console}; vm.createContext(ctx); vm.runInContext(code+";this.txFields=txFields;this.txEmpty=txEmpty;this.txLevel=txLevel;",ctx);
let pass=0,fail=0; const ok=(c,m)=>{ c?pass++:(fail++,console.log("FAIL",m)); };
const eq=(a,b,m)=>ok(JSON.stringify(a)===JSON.stringify(b),`${m}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);

// 1. Brookline-style rows, GPA printed as 0.00 (ignored; we calculate)
let f=ctx.txFields(["Student Name: Jane Doe","Grade 9  2023-2024","English 9 H A- 1.0","Geometry B+ 1.0","Biology ACC B 1.0","Spanish 2 A 1.0","Total Credits 4.0","Cumulative GPA 0.00","Grade 10","AP US History A 1.0","Algebra 2 H B+ 1.0","Chemistry H B 1.0","World Literature A- 1.0"]);
eq(f.courses.length,8,"1 course count"); eq(f.honors,4,"1 honors (H + ACC)"); eq(f.apIb,1,"1 ap");
ok(f.gpa>3.3&&f.gpa<3.6&&f.gpaCalculated,"1 calculated gpa "+f.gpa); eq(f.courses[0].year,9,"1 year 9"); eq(f.courses[4].year,10,"1 year 10");
// 2. percent grades with credits
f=ctx.txFields(["Course Final Credit","AP Calculus AB 94 0.5","English 11 88 0.5","Physics 91 0.5","US History 85 0.5","Spanish 3 H 96 0.5"]);
eq(f.courses.length,5,"2 count"); eq(f.courses[0].grade,"94","2 grade"); eq(f.courses[0].credits,0.5,"2 credit"); eq(f.honors,1,"2 honors"); eq(f.apIb,1,"2 ap");
// 3. quarter columns then final letter then credit: the LAST grade is the final
f=ctx.txFields(["Chemistry H 88 90 89 B+ 1.0","Geometry 92 94 93 A 1.0","English 10 85 84 86 B 1.0","History 90 91 92 A- 1.0"]);
eq(f.courses.map(c=>c.grade),["B+","A","B","A-"],"3 finals");
// 4. printed GPA, weighted, tests
f=ctx.txFields(["Cumulative GPA: 3.62","Weighted GPA 4.10","SAT Total 1380","ACT Composite 31","English 9 A 1.0","Math A 1.0","Art A 1.0","Gym P 0.5"]);
eq(f.gpa,3.62,"4 gpa"); eq(f.weightedGpa,4.1,"4 weighted"); eq(f.sat,1380,"4 sat"); eq(f.act,31,"4 act");
// 5. junk only -> empty
f=ctx.txFields(["Brookline High School","Official Transcript","Page 1 of 2","Counselor: Ms. Smith 617-555-0100"]);
ok(ctx.txEmpty(f),"5 empty");
// 6. levels
eq(["AP Biology","IB Chemistry HL","Dual Enrollment English","Honors Algebra","Latin II H","Physics"].map(ctx.txLevel),["AP","IB","Dual","Honors","Honors","Regular"],"6 levels");
eq(["English9H","APUS History","APCalculus AB","Spanish 3H"].map(ctx.txLevel),["Honors","AP","AP","Honors"],"7 OCR squashed levels");
console.log(`transcript-local ${pass} pass, ${fail} fail`); process.exit(fail?1:0);
