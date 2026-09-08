import fs from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
const DIR = process.argv[2];
const fix = s => s.replace(/اال/g,'الا').replace(/لال/g,'للا').replace(/اإل/g,'الإ').replace(/اآل/g,'الآ');
const map = JSON.parse(fs.readFileSync(process.argv[3],'utf8'));   // {id: "اسم المادة | المرحلة"}
for (const [id, label] of Object.entries(map)) {
  const f = `${DIR}/b${id}.pdf`;
  if (!fs.existsSync(f)) { console.log(`${label}\t→ (لا ملف)`); continue; }
  try {
    const doc = await getDocument({data:new Uint8Array(fs.readFileSync(f)), useSystemFonts:true}).promise;
    let txt='';
    for (let p=1;p<=Math.min(doc.numPages,2);p++)
      txt += (await (await doc.getPage(p)).getTextContent()).items.map(i=>i.str).join(' ')+' ';
    txt = fix(txt.replace(/\s+/g,' '));
    /* نأخذ كل نافذة حول «توجيه» ونستبعد الجملة النمطية «من قبل التوجيه الفني المختص» */
    const wins=[];
    const re=/توجيه/g; let m;
    while((m=re.exec(txt))) {
      const w = txt.slice(Math.max(0,m.index-45), m.index+45).trim();
      if (!/المختص/.test(w)) wins.push(w);
    }
    console.log(`${label}\t→ ${wins.length? [...new Set(wins)].slice(0,2).join('  ⟂  ') : '(بلا ختم)'}`);
  } catch(e){ console.log(`${label}\t→ (خطأ)`); }
}
