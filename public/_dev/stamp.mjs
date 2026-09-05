/* ختم الإصدار — يُشغَّل من جذر المشروع مع كل نشر:  node public/_dev/stamp.mjs [رقم]
   ① يرفع SHOUBA_BUILD في public/build.js  ② يكتب version.json بالرقم نفسه
   ③ يبصم كل ملفّات CSS/JS المشتركة في **كل** الشاشات بـ ?v=الرقم.
   السبب: بصمة منسيّة على شاشة واحدة تُبقي المستخدم على نسخة قديمة فيها بلا أن يشعر. */
import fs from 'fs';
const DIR = 'public';
const ASSETS = ['components.css','shell.css','frame.css','components.js','derive.js',
                'refdata.js','icons.js','build.js','identity/tokens.css'];

const buildFile = `${DIR}/build.js`;
let build = fs.readFileSync(buildFile, 'utf8');
const cur  = +(build.match(/SHOUBA_BUILD\s*=\s*(\d+)/) || [0, 0])[1];
const next = process.argv[2] ? +process.argv[2] : cur + 1;

fs.writeFileSync(buildFile, build.replace(/SHOUBA_BUILD\s*=\s*\d+/, 'SHOUBA_BUILD = ' + next));
fs.writeFileSync(`${DIR}/version.json`, JSON.stringify({ build: next }) + '\n');

let touched = 0;
for (const f of fs.readdirSync(DIR).filter(x => x.endsWith('.html'))) {
  const p = `${DIR}/${f}`;
  const before = fs.readFileSync(p, 'utf8');
  let s = before;
  for (const a of ASSETS) {
    const esc = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    /* المسارات نسبية (شرط العمل تحت مسار فرعي)، ونقبل المطلقة احتياطاً */
    s = s.replace(new RegExp(`(["'])(?:\\.?/)?${esc}(\\?v=[^"']*)?\\1`, 'g'), `$1${a}?v=${next}$1`);
  }
  if (s !== before) { fs.writeFileSync(p, s); touched++; }
}
/* ④ عامل الخدمة: رقم البناء واسم المخزن — وإلّا خدم المستخدمَ نسخةً قديمة من مخزنه */
const swPath = `${DIR}/sw.js`;
if (fs.existsSync(swPath)) {
  const sw = fs.readFileSync(swPath, 'utf8').replace(/var BUILD = \d+;/, `var BUILD = ${next};`);
  fs.writeFileSync(swPath, sw);
}
console.log(`النسخة ${cur} ← ${next} · بُصمت ${touched} شاشة · وعامل الخدمة`);
