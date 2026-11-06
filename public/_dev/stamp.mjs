/* ختم الإصدار — يُشغَّل من جذر المشروع مع كل نشر:  node public/_dev/stamp.mjs [رقم] [نسخة] [--note "نبذة"]
   ① يرفع SHOUBA_BUILD في public/build.js  ② يكتب version.json بالرقم نفسه
   ③ يبصم كل ملفّات CSS/JS المشتركة في **كل** الشاشات بـ ?v=الرقم.
   السبب: بصمة منسيّة على شاشة واحدة تُبقي المستخدم على نسخة قديمة فيها بلا أن يشعر. */
import fs from 'fs';
const DIR = 'public';
const ASSETS = ['components.css','shell.css','frame.css','components.js','derive.js',
                'refdata.js','icons.js','build.js','identity/tokens.css',
                /* محرك السجلات (2026-09-11) — كانت خارج القائمة فتبقى على بصمتها القديمة */
                'rec-templates.js','rec-engine.js','rec-form.js','rec-print.js','rec-print.css','rec-files.js',
                'plan-data.js',    /* جالب الخطط المعتمدة (2026-09-13، شريط الخطة) */
                'face-data.js','face.css'];   /* واجهة الشعبة (2026-10-20) */

/* --note: نبذة سطر واحد عما في البناء، تحفظ في version.json فيضعها الخادم في إشعار التحديث (push.js) —
   طلب المستخدم 2026-11-06: «نبذة بسيطة عم ماذا تم اضافته في الاشعار». بلا نبذة يبقى الإشعار على نصه */
const args = process.argv.slice(2);
const ni = args.indexOf('--note');
const note = ni > -1 ? String(args.splice(ni, 2)[1] || '').replace(/\s+/g, ' ').trim().slice(0, 120) : '';
process.argv = process.argv.slice(0, 2).concat(args);

const buildFile = `${DIR}/build.js`;
let build = fs.readFileSync(buildFile, 'utf8');
const cur  = +(build.match(/SHOUBA_BUILD\s*=\s*(\d+)/) || [0, 0])[1];
const next = process.argv[2] ? +process.argv[2] : cur + 1;
/* الوسيط الثاني (اختياري) يضع الترقيم الدلالي: node stamp.mjs 9 0.2 — ميزة جديدة ترفع الأوسط
   ⚠ وبلا وسيط ثان يرفع الأخير (0.31.0 ← 0.31.1): كل ختم يغير النسخة، لأنها الرقم الظاهر للمستخدم
     في الرأس (قرار المستخدم 2026-10-22: بقيت 0.31.0 من بناء 111 إلى 115 فلم يميز بينها) */
const curV = (build.match(/SHOUBA_VERSION\s*=\s*'([^']+)'/) || [0, '?'])[1];
const ver  = process.argv[3] || (/^\d+\.\d+\.\d+$/.test(curV)
  ? curV.replace(/\d+$/, n => String(+n + 1)) : undefined);

build = build.replace(/SHOUBA_BUILD\s*=\s*\d+/, 'SHOUBA_BUILD   = ' + next);
if (ver) build = build.replace(/SHOUBA_VERSION\s*=\s*'[^']*'/, `SHOUBA_VERSION = '${ver}'`);
fs.writeFileSync(buildFile, build);
fs.writeFileSync(`${DIR}/version.json`, JSON.stringify(note ? { build: next, note } : { build: next }) + '\n');

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
console.log(`بناء ${cur} ← ${next} · دلالي ${curV}${ver ? ' ← ' + ver : ''} · بُصمت ${touched} شاشة · وعامل الخدمة${note ? ' · نبذة: ' + note : ' · بلا نبذة'}`);
