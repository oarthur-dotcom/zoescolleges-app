// Free in-browser aid-letter reader: rules that turn text lines into grants, loans, work-study and cost of attendance.
import fs from "fs"; import vm from "vm";
const src=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
const code=src.slice(src.indexOf("/* AIDLOCAL-START"),src.indexOf("/* AIDLOCAL-END */"));
const ctx={console}; vm.createContext(ctx); vm.runInContext(code+";this.aidFields=aidFields;",ctx);
let pass=0,fail=0; const eq=(a,b,m)=>{ JSON.stringify(a)===JSON.stringify(b)?pass++:(fail++,console.log("FAIL",m,"got",JSON.stringify(a),"want",JSON.stringify(b))); };
let f=ctx.aidFields(["Boston College","Financial Aid Award Letter 2027-28","Cost of Attendance $85,000","Boston College Scholarship $42,000","Federal Pell Grant $0","Merit Award $10,000","Direct Subsidized Loan $3,500","Direct Unsubsidized Loan $2,000","Federal Work-Study $2,500","Total Grants and Scholarships $52,000","Estimated Family Contribution $33,000"]);
eq(f.school,"Boston College","A school"); eq(f.academicYear,"2027–28","A year"); eq(f.costOfAttendance,85000,"A coa");
eq(f.grants.map(g=>g.amount),[42000,10000],"A grants (no totals, no $0)"); eq(f.loans.map(l=>[l.amount,l.kind]),[[3500,"subsidized"],[2000,"unsubsidized"]],"A loans"); eq(f.workStudy,2500,"A work-study");
// semester columns are added up to a year
f=ctx.aidFields(["Tufts University","2027-2028 Offer of Financial Aid","Fall Spring","Presidential Scholarship $10,000 $10,000","Direct Unsubsidized Loan $2,750 $2,750","Cost of Attendance $90,000"]);
eq(f.grants.map(g=>g.amount),[20000],"B semester grant"); eq(f.loans.map(l=>l.amount),[5500],"B semester loan"); eq(f.period,"year","B period"); eq(f.academicYear,"2027–28","B year");
// only a total is printed
f=ctx.aidFields(["State University","Cost of attendance 31,200","Total grants and scholarships 12,000"]);
eq(f.grants,[{name:"Total grants and scholarships",amount:12000}],"C total only");
// not an aid letter
f=ctx.aidFields(["Brookline High School","Official Transcript","English 9 H A- 1.0"]); eq(f._n,0,"D nothing found");
console.log(`aid-local ${pass} pass, ${fail} fail`); process.exit(fail?1:0);
