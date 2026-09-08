import fs from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
const S = process.argv[2], TREE = JSON.parse(fs.readFileSync(S + '/moe-tree.json', 'utf8'));
const DIR = S + '/moe-docs'; fs.mkdirSync(DIR, { recursive: true });

/* pdf.js يعكس العربية حرفاً حرفاً فينكسر محرف «لا» إلى «ال» — نصلحه بالاستبدال */
const fix = s => s.replace(/اال/g, 'الا').replace(/لال/g, 'للا').replace(/اإل/g, 'الإ').replace(/اآل/g, 'الآ');

async function search(t, st, g, sub, term) {
  const r = await fetch('https://elibrary.moe.edu.kw/api/librarysearch', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ BooksFor: 2, MoeYear: 2023, EducationTypeID: t, EducationStageID: st, EducationGradeID: g, EducationSubjectID: sub, Term: term })
  });
  if (!r.ok) return [];
  return (await r.json()).books || [];
}
async function tawjih(id) {
  const f = `${DIR}/b${id}.pdf`;
  if (!fs.existsSync(f)) {
    const r = await fetch(`https://elibrary.moe.edu.kw/api/File/preview/book/${id}`);
    if (!r.ok) return null;
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  }
  try {
    const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(f)), useSystemFonts: true }).promise;
    let txt = '';
    for (let p = 1; p <= Math.min(doc.numPages, 2); p++)
      txt += (await (await doc.getPage(p)).getTextContent()).items.map(i => i.str).join(' ') + ' ';
    txt = fix(txt.replace(/\s+/g, ' '));
    const m = txt.match(/(?:مدير\s+)?إدارة\s+توجيه\s+([^\s]+(?:\s+[^\s]+)?)/) || txt.match(/التوجيه\s+الفني\s+ل?([^\s]+)/);
    return m ? m[1].replace(/[:،.]/g, '').trim() : null;
  } catch { return null; }
}

const gen = Object.values(TREE).find(x => /العام/.test(x.name));
for (const want of ['الإبتدائية', 'المتوسط']) {
  const st = Object.entries(gen.stages).find(([, v]) => v.name.trim() === want);
  if (!st) continue;
  console.log(`\n══════ ${want} ══════`);
  const seen = new Set();
  for (const [gid, G] of Object.entries(st[1].grades)) {
    for (const s of G.subjects) {
      const name = s.text.trim();
      if (seen.has(name)) continue;
      let found = null, book = null;
      for (const term of [1, 2]) {
        const books = await search(8, +st[0], +gid, s.value, term);
        const plans = books.filter(b => /توز/.test(b.fileDescription || ''));
        if (plans.length) { book = plans.sort((a, b) => b.bookFileID - a.bookFileID)[0]; break; }
      }
      if (!book) continue;
      seen.add(name);
      found = await tawjih(book.bookFileID);
      console.log(`  ${name}  ←  ${found || '✗ بلا ختم'}   [${G.name.trim()} · ${book.bookFileID}]`);
    }
  }
}
