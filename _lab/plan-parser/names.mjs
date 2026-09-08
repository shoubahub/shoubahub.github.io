import fs from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
const DIR = process.argv[2];
const fix = s => s.replace(/اال/g,'الا').replace(/لال/g,'للا').replace(/اإل/g,'الإ').replace(/اآل/g,'الآ');
const TARGETS = JSON.parse(process.argv[3]);
for (const [label, [grade, subj]] of Object.entries(TARGETS)) {
  let book = null;
  for (const term of [1,2]) {
    const r = await fetch('https://elibrary.moe.edu.kw/api/librarysearch', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({BooksFor:2,MoeYear:2023,EducationTypeID:8,EducationStageID:17,EducationGradeID:grade,EducationSubjectID:subj,Term:term})});
    if(!r.ok) continue;
    const plans = ((await r.json()).books||[]).filter(b=>/توز/.test(b.fileDescription||''));
    if(plans.length){ book = plans.sort((a,b)=>b.bookFileID-a.bookFileID)[0]; break; }
  }
  if(!book){ console.log(`${label}\t→ (لا خطة)`); continue; }
  const f = `${DIR}/n${book.bookFileID}.pdf`;
  if(!fs.existsSync(f)){
    const r = await fetch(`https://elibrary.moe.edu.kw/api/File/preview/book/${book.bookFileID}`);
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  }
  try{
    const doc = await getDocument({data:new Uint8Array(fs.readFileSync(f)),useSystemFonts:true}).promise;
    let txt = (await (await doc.getPage(1)).getTextContent()).items.map(i=>i.str).join(' ');
    txt = fix(txt.replace(/\s+/g,' '));
    const m = txt.match(/توزيع\s+منهج\s+مادة:?\s*(.{0,60}?)\s+(?:العام|الفصل|الصف)/) || txt.match(/مادة:?\s*([^:]{2,45}?)\s+(?:العام|الفصل)/);
    const g = txt.match(/الصف:?\s*(.{0,28}?)\s+(?:الجزء|العام|الفصل)/);
    console.log(`${label}\t→ «${m?m[1].trim():'؟'}»   [${g?g[1].trim():''}]   (${book.bookFileID})`);
  }catch(e){ console.log(`${label}\t→ (خطأ)`); }
}
