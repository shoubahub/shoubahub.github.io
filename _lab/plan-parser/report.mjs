import { openDoc } from './lib2.mjs';
import { readTable, norm } from './lib3.mjs';

const ORD = ['الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر',
 'الحادي عشر','الثاني عشر','الثالث عشر','الرابع عشر','الخامس عشر','السادس عشر','السابع عشر','الثامن عشر',
 'التاسع عشر','العشرون','الحادي والعشرون','الثاني والعشرون','الثالث والعشرون','الرابع والعشرون'];
/* ⚠ تسمية الأسبوع المُدارة تصل مقطّعة («ال رابع» · «الثا ني عشر»)، فالمطابقة بلا فراغات */
const bare = s => norm(s).replace(/\s+/g,'');
const ordIndex = s => { const i = ORD.findIndex(o => bare(o) === bare(s)); return i < 0 ? null : i+1; };

for (const file of process.argv.slice(2)){
  const doc = await openDoc(file);
  let weeks = 0, lessons = 0, periods = 0, noTable = 0, unlabeled = 0, stated = null;
  const seq = [];
  for (let p = 1; p <= doc.numPages; p++){
    const page = await doc.getPage(p);
    const txt = (await page.getTextContent()).items.map(i=>i.str).join(' ');
    const m = txt.match(/المجموع\s*الكلي[^\d]{0,60}(\d+)/);
    if (m) stated = parseInt(m[1]);
    const t = await readTable(page);
    if (!t){ noTable++; continue; }
    for (const w of t.weeks){
      weeks++;
      const oi = ordIndex(w.أسبوع);
      if (oi) seq.push(oi); else unlabeled++;
      for (const l of w.دروس){ lessons++; periods += parseInt(l.حصص||'0') || 0; }
    }
  }
  const uniq = [...new Set(seq)];
  const gaps = [];
  for (let i = 1; i <= Math.max(0,...uniq); i++) if (!uniq.includes(i)) gaps.push(i);
  const dups = seq.filter((v,i)=> seq.indexOf(v) !== i);
  console.log('\n■ ' + file.split('/').pop());
  console.log(`  صفحات: ${doc.numPages} · بلا جدول: ${noTable} · أسابيع: ${weeks} · دروس: ${lessons} · مجموع الحصص: ${periods}`);
  console.log(`  تسلسل الأسابيع: ${uniq.length ? uniq[0]+'…'+uniq[uniq.length-1] : '—'} · فجوات: ${gaps.length?gaps.join(','):'لا شيء'} · تكرار: ${dups.length?[...new Set(dups)].join(','):'لا شيء'} · بلا تسمية: ${unlabeled}`);
  console.log(`  المجموع المعلن في الوثيقة: ${stated ?? '—'} ${stated!=null ? (stated===periods ? '✔ مطابق' : '✘ الفارق '+(periods-stated)) : ''}`);
}
