import { openDoc } from './lib2.mjs';
import { readTable } from './lib3.mjs';
const doc = await openDoc(process.argv[2]);
let n = 0, out = [];
out.push('الخطة كما استخرجتها المنصّة من ملفّ التوزيع — قابِلها بالورقة');
out.push('='.repeat(58));
for (let p=1;p<=doc.numPages;p++){
  const t = await readTable(await doc.getPage(p));
  if(!t) continue;
  for (const w of t.weeks){
    n++;
    out.push('');
    out.push(`الأسبوع ${n}${w.أسبوع ? ' («'+w.أسبوع+'»)' : ''}${w.وحدة ? '   —   '+w.وحدة.replace(/\s+/g,' ') : ''}`);
    for (const l of w.دروس){
      out.push(`   • [${l.حصص||'؟'} حصة] ${l.دروس.join(' · ').replace(/\s+/g,' ')}`);
      if (l.مراجع && !/^[-–—\s]+$/.test(l.مراجع)) out.push(`     المرجع: ${l.مراجع.replace(/\s+/g,' ')}`);
    }
  }
}
const total = out.filter(x=>x.includes('حصة]')).reduce((a,b)=> a + (parseInt(b.match(/\[(\d+)/)?.[1]||0)||0), 0);
out.push(''); out.push('='.repeat(58));
out.push(`المجموع: ${n} أسبوعاً · ${total} حصة`);
console.log(out.join('\n'));
