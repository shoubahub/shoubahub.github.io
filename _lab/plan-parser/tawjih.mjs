import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
const file = process.argv[2];
const doc = await getDocument({ data: new Uint8Array((await import('fs')).readFileSync(file)), useSystemFonts:true }).promise;
let out = [];
for (let p = 1; p <= Math.min(doc.numPages, 2); p++) {
  const c = await (await doc.getPage(p)).getTextContent();
  out.push(c.items.map(i => i.str).join(' '));
}
const txt = out.join('\n').replace(/\s+/g, ' ');
const hit = txt.match(/توجيه\s+[^\s]+(\s+[^\s]+)?/g);
console.log('طول النصّ:', txt.length);
console.log('مطابقات «توجيه»:', hit ? [...new Set(hit)].join(' | ') : '✗ لا شيء');
console.log('عيّنة:', txt.slice(0, 260));
