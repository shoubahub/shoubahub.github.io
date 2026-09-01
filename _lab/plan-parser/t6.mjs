import { openDoc } from './lib2.mjs';
import { readTable } from './lib3.mjs';
const doc = await openDoc(process.argv[2]);
const to = Math.min(parseInt(process.argv[3]||'99'), doc.numPages);
for (let p=1;p<=to;p++){
  const t = await readTable(await doc.getPage(p));
  if (!t){ console.log(`\n— صفحة ${p}: لا جدول —`); continue; }
  console.log(`\n=== صفحة ${p} · ${t.weeks.length} أسبوعاً ===  [${t.header.join(' | ')}]`);
  for (const w of t.weeks){
    console.log(` ● ${w.أسبوع || '—'}  ${w.وحدة ? '· '+w.وحدة : ''}`);
    for (const l of w.دروس) console.log(`    - [${l.حصص||' '}] ${l.دروس.join(' / ')}${l.مراجع?'   («'+l.مراجع+'»)':''}`);
  }
}
