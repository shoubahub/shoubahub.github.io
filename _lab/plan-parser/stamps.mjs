// اسم التوجيه من اختام الخطط — node stamps.mjs <مجلد العمل>
// ⚠ خطط ٢٠٢٦/٢٠٢٧ صار اسفلها جدول توقيع فارغ («مدير ادارة توجيه | مدير ادارة البحوث…») بلا اسم التوجيه،
//   فيقرأ الاسم من خطط الاعوام السابقة للمادة نفسها — وكانت تحمل الختم مكتوبا («ادارة توجيه الاجتماعيات»).
// المخرج: <مجلد العمل>/plans/stamps-17-t1.json — لكل (صف·مادة) الاسماء المقروءة ومصدرها
import fs from 'fs';
import { execFileSync } from 'child_process';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const W = process.argv[2], STAGE = process.argv[3] || '17';
const LISTF = fs.existsSync(`${W}/plans/list-${STAGE}-t1.json`) ? `${W}/plans/list-${STAGE}-t1.json` : `${W}/plans/sec-t1.json`;
const LIST = JSON.parse(fs.readFileSync(LISTF, 'utf8')).books || [];
const DOCS = `${W}/moe-docs`;
const fix = s => s.replace(/اال/g, 'الا').replace(/لال/g, 'للا').replace(/اإل/g, 'الإ').replace(/اآل/g, 'الآ');
const isPdf = f => { try { const b = Buffer.alloc(5); const fd = fs.openSync(f, 'r'); fs.readSync(fd, b, 0, 5, 0); fs.closeSync(fd); return b.toString() === '%PDF-'; } catch (e) { return false; } };
process.on('unhandledRejection', () => {}); process.on('uncaughtException', () => {});
function get(id) {
  const f = `${DOCS}/b${id}.pdf`;
  if (fs.existsSync(f) && isPdf(f)) return f;
  for (let a = 0; a < 3; a++) { try { execFileSync('curl', ['-s', '-f', '-L', '--retry', '2', '-m', '90', '-o', f, `https://elibrary.moe.edu.kw/api/File/preview/book/${id}`]); if (isPdf(f)) return f; } catch (e) {} }
  return null;
}
/* اسم حقيقي بعد «ادارة توجيه» — لا عنوان عمود («مدير») ولا الجملة النمطية («المختص») */
const STOP = /^(مدير|المختص|الفني$|إدارة|ادارة)/;
function names(txt) {
  const out = new Set();
  for (const m of txt.matchAll(/إدارة\s+(?:ال)?توجيه\s+(?:الفني\s+)?(?:العام\s+)?(?:ل(?=\S))?([^\s،.:|]+(?:\s+(?:و\S+|ال\S+|مادة\s+\S+)){0,3})/g)) {
    const n = m[1].replace(/^مادة\s+/, '').trim();
    if (n && !STOP.test(n)) out.add('إدارة توجيه ' + n.replace(/^ل(?=ال)/, ''));
  }
  for (const m of txt.matchAll(/التوجيه\s+الفني\s+(?:العام\s+)?(?:ل|لل)?(\S+(?:\s+(?:و\S+|ال\S+)){0,2})/g)) {
    const n = m[1].trim();
    if (n && !/المختص/.test(n) && !STOP.test(n)) out.add('التوجيه الفني ' + n);
  }
  return [...out];
}
const groups = {};
for (const x of LIST.filter(x => /توز/.test(x.fileDescription || '') && x.term === 1 && !/منازل|فصول\s*خاصة|الفصول\s*الخاصة|بطء/.test(x.fileDescription || '')))
  (groups[x.educationGradeID + '|' + x.educationSubjectID] ||= []).push(x);
const res = {};
let n = 0; const total = Object.values(groups).reduce((a, g) => a + g.length, 0);
for (const [k, arr] of Object.entries(groups)) {
  res[k] = [];
  for (const x of arr.sort((a, b) => b.bookFileID - a.bookFileID)) {
    n++;
    const f = get(x.bookFileID);
    if (!f) { res[k].push({ id: x.bookFileID, year: String(x.createdDate || '').slice(0, 4), err: 'تنزيل' }); continue; }
    let txt = '';
    try {
      const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(f)), useSystemFonts: true, verbosity: 0 }).promise;
      for (let p = 1; p <= doc.numPages; p++) txt += (await (await doc.getPage(p)).getTextContent()).items.map(i => i.str).join(' ') + ' ';
    } catch (e) { res[k].push({ id: x.bookFileID, err: 'قراءة' }); continue; }
    txt = fix(txt.replace(/\s+/g, ' '));
    const nm = names(txt);
    res[k].push({ id: x.bookFileID, year: String(x.createdDate || '').slice(0, 10), desc: (x.fileDescription || '').trim().slice(0, 50), names: nm, template: /مدير\s+إدارة\s+توجيه\s+مدير/.test(txt) });
    console.log(`[${n}/${total}] ${k} #${x.bookFileID} ${String(x.createdDate || '').slice(0, 10)} ⟵ ${nm.join(' | ') || '—'}`);
  }
}
fs.writeFileSync(`${W}/plans/stamps-${STAGE}-t1.json`, JSON.stringify(res, null, 1));
console.log(`✓ stamps-${STAGE}-t1.json`);
