/* تحويل المسارات المطلقة إلى نسبية — شرطُ العمل تحت مسار فرعي (GitHub Pages).
   كل الشاشات في مجلّد واحد، فالنسبيّ يعمل في الجذر وفي أي مسار فرعي معاً. */
import fs from 'fs';
const DIR = 'public';
let n = 0;
for (const f of fs.readdirSync(DIR).filter(x => x.endsWith('.html'))) {
  const p = `${DIR}/${f}`;
  const before = fs.readFileSync(p, 'utf8');
  let s = before;
  s = s.replace(/(href|src)="\/(?!\/)/g, '$1="');                    // href="/x" ⟵ href="x"
  s = s.replace(/(location\.(?:href|replace)\s*\(?\s*=?\s*)'\/(?!\/)/g, "$1'");
  s = s.replace(/(data-go=")\/(?!\/)/g, '$1');
  s = s.replace(/(location\.href\s*=\s*)'\/'/g, "$1'index.html'");
  if (s !== before) { fs.writeFileSync(p, s); n++; }
}
console.log('حُوّلت مسارات ' + n + ' شاشة');
