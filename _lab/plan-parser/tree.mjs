// شجرة مكتبة المعلم (النوع ⟵ المراحل ⟵ الصفوف ⟵ المقررات) — node tree.mjs <مجلد العمل> [النوع=8]
// المخرج: <مجلد العمل>/moe-tree.json الذي يقرؤه batch.mjs وscan.mjs.
// (2026-09-12: كانت الشجرة تبنى يدويا في جلسة سابقة ولم يبق مصدرها، فضاعت من مجلد العمل وتوقف القياس —
//  فصارت اداة دائمة.) الواجهة مفتوحة بلا حساب؛ القاعدة elibrary.moe.edu.kw/api لا TeachersLibrary/api (٤٠٤).
import fs from 'fs';
import { execFileSync } from 'child_process';
const W = process.argv[2], TYPE = process.argv[3] || '8';
if (!W) { console.log('node tree.mjs <مجلد العمل> [النوع=8]'); process.exit(1); }
const API = 'https://elibrary.moe.edu.kw/api/LibraryLookups/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
/* curl لا fetch — كما في batch.mjs: رد مبتور من الخادم يفجر مجرى fetch خارج try */
async function get(path) {
  for (let a = 0; a < 3; a++) {
    try { return JSON.parse(execFileSync('curl', ['-s', '-f', '-m', '60', API + path]).toString()).data || []; }
    catch (e) { await sleep(2000 * (a + 1)); }
  }
  throw new Error('تعذر: ' + path);
}
const types = await get('EducationTypes');
const tree = {};
for (const ty of types.filter(x => String(x.value) === String(TYPE))) {
  const T = tree[ty.value] = { name: ty.text, stages: {} };
  for (const s of await get('EducationStages/' + ty.value)) {
    const S = T.stages[s.value] = { name: s.text, grades: {} };
    for (const g of await get('EducationGrades/' + s.value)) {
      S.grades[g.value] = { name: g.text, subjects: await get('EducationSubjects/' + g.value) };
      await sleep(250);
    }
    console.log(s.value, s.text.trim(), '—', Object.keys(S.grades).length, 'صفوف');
  }
}
fs.writeFileSync(`${W}/moe-tree.json`, JSON.stringify(tree, null, 1));
console.log('كتبت', `${W}/moe-tree.json`);
