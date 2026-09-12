// قراءة خطط توزيع المنهج بالجملة — خطوة قياس (2026-09-11)
// node batch.mjs <مجلد العمل> [المرحلة=17] [الفصل=1]
// المدخل: <مجلد العمل>/plans/sec-t1.json (نتيجة librarysearch) و moe-tree.json
// المخرج: <مجلد العمل>/plans/extract-<المرحلة>-t<الفصل>.json — لكل خطة بنيتها وتقرير دقتها
// ⚠ ليست جزءا من المنصة: تقيس هل تقرأ الخطط كلها قراءة موثوقة قبل ان يبنى عليها شريط الخطة.
import fs from 'fs';
import { openDoc } from './lib2.mjs';
import { readTable, norm } from './lib3.mjs';
import { ocrTable, ocrText, fillVectorPeriods, readWeekCells, latin } from './ocrpage.mjs';
/* OCR=0 يعطل القراءة الضوئية (للمقارنة بما قبلها) */
const OCR = process.env.OCR !== '0';

const W = process.argv[2], STAGE = process.argv[3] || '17', TERM = +(process.argv[4] || 1);
/* قائمة المرحلة: list-<المرحلة>-t<الفصل>.json، وsec-t1.json لقياس الثانوي الاول (2026-09-12) */
const LISTF = fs.existsSync(`${W}/plans/list-${STAGE}-t${TERM}.json`) ? `${W}/plans/list-${STAGE}-t${TERM}.json` : `${W}/plans/sec-t1.json`;
const LIST = JSON.parse(fs.readFileSync(LISTF, 'utf8')).books || [];
const TREE = JSON.parse(fs.readFileSync(`${W}/moe-tree.json`, 'utf8'));
const DOCS = `${W}/moe-docs`; fs.mkdirSync(DOCS, { recursive: true });

const gen = Object.values(TREE).find(x => /العام/.test(x.name));
const st = gen.stages[STAGE];
const gname = {}, sname = {};
for (const [gid, G] of Object.entries(st.grades)) { gname[gid] = G.name.trim(); for (const s of G.subjects) sname[s.value || s.id] = s.text.trim(); }

/* ── الاختيار: خطة العام الجاري اولا، ونسخة «طلاب منازل» بديل لا اصل ── */
const CUR = x => /2026\s*[-–]\s*2027/.test(x.fileDescription || '') || String(x.createdDate || '') >= '2026-08-01';
/* نسخ بديلة لا اصل: طلاب منازل (الثانوي) · فصول خاصة وبطء تعلم (المتوسط والابتدائي) */
/* ⚠ «بطيء التعلم» بالياء — كان الشرط «بطء» وحده، فاختيرت نسخة بطيء التعلم خطة ثانية للرياضيات */
const HOME = x => /منازل|فصول\s*خاصة|الفصول\s*الخاصة|بطء|بطيء|بطئ/.test(x.fileDescription || '');
const plans = LIST.filter(x => /توز/.test(x.fileDescription || '') && x.term === TERM);
const groups = {};
for (const x of plans) (groups[x.educationGradeID + '|' + x.educationSubjectID] ||= []).push(x);
const picked = [];
for (const [k, arr] of Object.entries(groups)) {
  const [g, s] = k.split('|');
  const cur = arr.filter(x => CUR(x) && !HOME(x)).sort((a, b) => b.bookFileID - a.bookFileID);
  /* خطط المنازل لا شأن للمنصة بها البتة (قرار المستخدم 2026-09-13: «كل ما يخص المنازل للخطط احذفه») — تستبعد من
     القراءة كما كانت، ولا تسجل ارقامها بجانب الخطة الاصلية. والبديل الباقي: الفصول الخاصة وبطء التعلم */
  const home = arr.filter(x => CUR(x) && HOME(x) && !/منازل/.test(x.fileDescription || ''));
  const elective = gname[g] && /اختيار/.test(gname[g]);
  if (elective) cur.forEach(x => picked.push({ x, g, s, why: 'current', elective: true }));
  else if (cur.length) cur.forEach((x, i) => picked.push({ x, g, s, why: i ? 'current-extra' : 'current', homeVariant: home.map(h => h.bookFileID) }));
  else { const old = arr.filter(x => !HOME(x)).sort((a, b) => b.bookFileID - a.bookFileID)[0]; if (old) picked.push({ x: old, g, s, why: 'old' }); }
}

/* ── التسميات الترتيبية للأسابيع — تصل مقطعة من التسمية المدارة، فالمطابقة بلا فراغات ── */
const ORD = ['الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر',
  'الثالث عشر','الرابع عشر','الخامس عشر','السادس عشر','السابع عشر','الثامن عشر','التاسع عشر','العشرون'];
const bare = s => norm(s || '').replace(/\s+/g, '').replace(/[أإآ]/g, 'ا');
/* التسمية قد تحمل مدى الاسبوع («الرابع من 2026/10/4 إلى 2026/10/8» في الخطط الممسوحة) — يعزل الترتيبي قبل المطابقة */
/* التشكيل ينزع قبل المطابقة («الساّس» · «التَامن» في القراءة الضوئية) — لا يكتب حرفيا في النمط (قاعدة المنصة) */
const HARAKAT = new RegExp('[' + String.fromCharCode(0x064B) + '-' + String.fromCharCode(0x0652) + String.fromCharCode(0x0670) + ']', 'g');
const ordOnly = s => String(s || '').replace(HARAKAT, '').replace(/[\d٠-٩]+(?:\s*[\/\-]\s*[\d٠-٩]+)*/g, ' ').replace(/[:()«»\[\]]/g, ' ').replace(/(^|\s)(من|إلى|الى|حتى|تابع)(?=\s|$)/g, ' ');   /* و«تابع:» صف يكمل وحدة (إنجليزي المتوسط) */
/* تحذف ايضا بقايا الحرف المفرد («ن» من «من» في القراءة الضوئية)، ثم تطابق البقية تامة — او مقلوبة
   الكلمتين («عشر الثاني» كما يصل المدار من pdf.js). ⚠ لا بالاحتواء: جرب فوجد «الثاني» في «عشر الثاني»
   فعد الثاني عشر ثانيا، فظهرت فجوات وتكرار في خطط كانت سليمة (المستكشف الرقمي، الفلسفة) */
const ordIndex = s => {
  const toks = ordOnly(s).split(/\s+/).filter(t => t && bare(t).length > 1);
  const cands = [toks.join(' ')]; if (toks.length === 2) cands.push(toks[1] + ' ' + toks[0]);
  for (const c of cands) { const i = ORD.findIndex(o => bare(o) === bare(c)); if (i >= 0) return i + 1; }
  return null;
};
/* مدى الاسبوع من تسميته: تاريخان (سنة/شهر/يوم او يوم/شهر/سنة) — الاصغر بدايته والاكبر نهايته */
const weekDates = s => {
  const d = [...String(s || '').matchAll(/(\d{1,4})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,4})/g)].map(m => {
    const [a, b, c] = [+m[1], +m[2], +m[3]]; const [y, mo, da] = a > 999 ? [a, b, c] : [c, b, a];
    return y > 2000 && mo >= 1 && mo <= 12 && da >= 1 && da <= 31 ? `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}` : null;
  }).filter(Boolean).sort();
  return d.length ? { from: d[0], to: d[d.length - 1] } : {};
};
/* الترتيبيات في التسمية كلها: «الأسبوع الرابع و الخامس و السادس والسابع» صف واحد لاربعة اسابيع (إنجليزي
   الابتدائي) — فيعطي رقم اول اسبوع وعدد ما يغطيه. والتسمية المفردة («الرابع من … إلى …») كما كانت */
/* ⚠ مسح متتابع للكلمات لا تقسيم بـ«و»: خانة فيها «الحادي عشر … الثاني عشر» بلا فاصل (الاجتماعيات) —
   ذو الكلمتين اولا («الحادي عشر» قبل «الحادي»)، ومقلوبه («عشر الثاني» كما يصل من pdf.js) */
/* ثلاثة اخطاء قراءة (2026-09-12، مراجعة الخطط الباقية):
   ① «الصف الحادي عشر» في خانة الاسبوع ليس اسبوعا — عد الحادي عشر مرتين (عربي الحادي عشر).
   ② القراءة الضوئية تسقط الف «ال» اول الكلمة («لثاني» · «لثالث عشر» — إسلامية الثاني عشر).
   ③ pdf.js يبعثر حروف التسمية المدارة («ر لا ش عا» = العاشر — الفلسفة): فان لم يوجد ترتيبي طوبقت حروف
      التسمية كلها بحروف ترتيبي مطابقة تامة — لا اشتراك بين الترتيبيات في حروفها (فحص)، والزائد يمنع المطابقة */
const letters = s => bare(s).replace(/ى/g, 'ي').split('').sort().join('');
const ORDL = ORD.map(letters);
const ordsIn = s => {
  /* ⚠ خانة فيها «الصف» ليست تسمية اسبوع البتة — لا يحذف الاسم وحده: «الصف ا لثاني عشر» (فراغ داخل الكلمة) حذف منها
     «الصف ا» فبقي «لثاني عشر» فأصلحت الفه فعدت اسبوعا ثانيا عشر مكررا (عربي الثاني عشر، 2026-09-12) */
  if (/(^|\s)ا?\s?لصف(?=\s|:|$)/.test(String(s || '').replace(HARAKAT, ''))) return [];
  const clean = ordOnly(s)
    .replace(/(^|\s)(ال)?[أا]سابيع(?=\s|$)|(^|\s)(ال)?[أا]سبوع(?=\s|$)/g, ' ');
  /* و«ال» المنفصلة تلحق بما بعدها: «ال ثاني عشر» قرئت «الثاني» فعد الاسبوع الثاني عشر ثانيا (الكيمياء ١٢) */
  const raw = clean.split(/[\s،,\-–+]+/).filter(Boolean), joined = [];
  for (let i = 0; i < raw.length; i++) { if (bare(raw[i]) === 'ال' && i + 1 < raw.length) { joined.push('ال' + raw[i + 1]); i++; } else joined.push(raw[i]); }
  const toks = joined.map(t => t.replace(/^و(?=ال)/, '').replace(/^ل(?!ل|ا)/, 'ال')).filter(t => bare(t).length > 1);
  const hit = p => { const i = ORD.findIndex(o => bare(o) === bare(p)); return i < 0 ? null : i + 1; };
  const all = ordsInToks(toks, hit);
  if (all.length) return all;
  const L = letters(clean.replace(/[^ء-ي\s]/g, ''));
  const k = L.length > 3 ? ORDL.indexOf(L) : -1;
  return k < 0 ? [] : [k + 1];
};
const ordsInToks = (toks, hit) => {
  const out = [];
  for (let i = 0; i < toks.length; ) {
    const two = i + 1 < toks.length ? (hit(toks[i] + ' ' + toks[i + 1]) || hit(toks[i + 1] + ' ' + toks[i])) : null;
    if (two) { out.push(two); i += 2; continue; }
    const one = hit(toks[i]); if (one) out.push(one);
    i++;
  }
  return [...new Set(out)].sort((a, b) => a - b);
};
const spanOf = os => os.length > 1 && os[os.length - 1] - os[0] + 1 === os.length ? os.length : undefined;
/* و«األ» ⟵ «الأ» (2026-09-12): كانت ناقصة من الاخوات فبقي «األسبو» مبعثرا */
const fixLig = s => s.replace(/اال/g, 'الا').replace(/لال/g, 'للا').replace(/اإل/g, 'الإ').replace(/اآل/g, 'الآ').replace(/األ/g, 'الأ');
/* عنوان الدرس للمنصة (2026-09-13، الخطوة أ من البناء): «ٌ» وسط الكلمة ياء (ترميز خط الرياضيات «القٌمة» = القيمة — والتنوين
   لا يقع الا آخر الكلمة)، ثم ينزع التشكيل والتطويل (قاعدة المنصة)، وتسقط القطع التي كلها ارقام وعلامات (بقايا ترقيم الدرس
   المقلوب «1) · - · (1») والحرف المفرد الشارد. والكلمات المنقسمة تضم من اصلها في lib3 (نص الخانة بمواضع عناصره) */
const cleanTitle = s => String(s || '').replace(/([ء-ي])ٌ(?=[ء-ي])/g, '$1ي').replace(HARAKAT, '').replace(/ـ/g, '')
  .split(/\s*·\s*/).map(x => x.replace(/\s+/g, ' ').replace(/^[\s•\-–—.:،]+|[\s\-–—:،]+$/g, '').trim())
  .filter(x => x && !/^[\d()\[\]\-–—.:،\s]+$/.test(x) && !/^[ء-ي]$/.test(x)).join(' · ');
/* المجموع المعلن: «المجموع الكلي لعدد الحصص … للعام الدراسي ٢٠٢٦/٢٠٢٧ : ٣٩ حصة» (2026-09-12). كان يأخذ اول عدد بعده
   فأخذ من العام: «6» من «٢٠٢6» (ارقام مختلطة — القرآن الثامن، ولا مجموع فيها اصلا) و«202» من «202 7/2026» (الكيمياء ١٢)،
   واخذ «24» من «24 + 2 اختبار عملي = 26» (الأحياء). فالارقام توحد لاتينية، ويحذف العام ولو انقسمت ارقامه، ثم الحكم:
   ما بعد «=» ⟵ العدد قبل «حصة» (وقد ينقسم «7 6 حصة» = ٧٦) ⟵ ما بعد النقطتين ⟵ اول عدد باق. يعيد [النص، العدد] او null */
/* ⚠ والعام قد يأتي بين قوسين بشرطة ومقلوب الاجزاء «( 2026 – 7 202 )» (العلوم التاسع) — فيحذف ما بين القوسين من
   ارقام؛ والعدد قبل «حصة» قد ينقسم «6 4» (= ٦٤، الإنجليزي) او يلحقه رقم شارد «26 1» (= ٢٦، القراءة الضوئية): فالارقام
   المفردة كلها تضم، والا فالاول. ويعاد مع القراءات الاخرى الممكنة، ويحكم بينها مجموع الحصص المقروء ان طابق احداها */
const YEAR = /2\s?0\s?[12]\s?\d(?:\s*[\/\-–—]\s*2\s?0\s?[12]\s?\d)?/g;
const statedIn = txt => {
  const t = latin(String(txt || '')), i = t.search(/المجموع\s*الكلي/);
  if (i < 0) return null;
  const seg = t.slice(i, i + 170).replace(/\(\s*[\d\s\/\-–—]+\)/g, ' ').replace(YEAR, ' ');
  let m = seg.match(/=\s*(\d{1,3})(?!\d)/);
  if (m) return [m[0], m[1], []];
  m = seg.match(/(?<![\d\/])(\d{1,3}(?:\s\d{1,3}){0,2})\s*حص/);
  if (m) {
    const toks = m[1].split(/\s+/), joined = toks.join('');
    const primary = toks.length > 1 && toks.every(x => x.length === 1) ? joined : toks[0];
    return [m[0], primary, [...new Set([joined, ...toks])].filter(x => x.length <= 3).map(Number)];
  }
  m = seg.match(/[:：]\s*(\d{1,3})(?![\d\/])/) || seg.match(/^[^\d]{0,80}?(?<![\d\/])(\d{1,3})(?![\d\/])/);
  return m ? [m[0], m[1], []] : null;
};
/* صف الصفحة من اسماء صفوف المرحلة نفسها (لا «عاشر/حادي» الثانوي وحده) — الاطول اولا؛ و«ى» ياء (القراءة الضوئية «الحادى») */
/* ⚠ والقراءة الضوئية قد تسقط الف «الصف» وتشكل الاسم («لصف السادس» مشكلة — لغتي العربية للمتوسط، 2026-09-12):
   فالتشكيل ينزع، و«لصف» يقبل اول كلمة وحده — لا «للصف» في جملة من الجسم («يراجع ما درسه للصف الحادي عشر»
   قلبت صف عربي الثاني عشر حادي عشر فانقسم ملفه، 2026-09-12). فالمطابقة على النص بفراغاته، والفراغ داخل
   الاسم محتمل («الصف ا لثاني عشر») */
const spaced = s => s.split('').map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*');
const gradeIn = txt => {
  const T = norm(String(txt || '')).replace(HARAKAT, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي');
  return Object.values(gname).filter(g => !/اختيار/.test(g)).sort((a, b) => b.length - a.length)
    .find(g => new RegExp('(?:' + spaced('الصف') + '|(?:^|\\s)' + spaced('لصف') + ')\\s*:?\\s*' + spaced(bare(g).replace(/ى/g, 'ي'))).test(T)) || '';
};
/* المسار بعد الصف في الترويسة («الصف: الحادي عشر علمي») */
const trackIn = txt => { const m = String(txt).replace(/ى/g, 'ي').match(/الصف\s*:?\s*\S+(?:\s+عشر)?\s+(علمي|أدبي|ادبي)/); return m ? (/علمي/.test(m[1]) ? 'علمي' : 'أدبي') : ''; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ⚠ التنزيل بـcurl لا بـfetch: جاء رد مبتور من خادم الوزارة (Z_BUF_ERROR) فانفجر خطؤه من
   مجرى البيانات خارج try — فوقف القياس كله عند الملف الثاني. والملف لا يعتمد الا ان بدأ «%PDF». */
import { execFileSync } from 'child_process';
const isPdf = f => { try { const b = Buffer.alloc(5); const fd = fs.openSync(f, 'r'); fs.readSync(fd, b, 0, 5, 0); fs.closeSync(fd); return b.toString() === '%PDF-'; } catch (e) { return false; } };
process.on('unhandledRejection', e => console.log('  (خطأ عابر تجاوزناه: ' + (e && e.code || e) + ')'));
process.on('uncaughtException', e => console.log('  (خطأ عابر تجاوزناه: ' + (e && e.code || e) + ')'));
async function fetchPdf(id) {
  const f = `${DOCS}/b${id}.pdf`;
  if (fs.existsSync(f) && isPdf(f)) return f;
  for (let a = 0; a < 3; a++) {
    try {
      execFileSync('curl', ['-s', '-f', '-L', '--retry', '2', '-m', '90', '-o', f, `https://elibrary.moe.edu.kw/api/File/preview/book/${id}`]);
      if (isPdf(f)) return f;
    } catch (e) {}
    await sleep(2000 * (a + 1));
  }
  try { fs.unlinkSync(f); } catch (e) {}
  return null;
}

async function extract(p) {
  const out = { id: p.x.bookFileID, grade: gname[p.g] || p.g, gradeId: p.g, subject: sname[p.s] || p.s, subjectId: p.s,
    desc: (p.x.fileDescription || '').trim(), uploaded: String(p.x.createdDate || '').slice(0, 10), pick: p.why,
    elective: !!p.elective, homeVariant: p.homeVariant || [] };
  const f = await fetchPdf(out.id);
  if (!f) return { ...out, status: 'download-failed' };
  let doc;
  try { doc = await openDoc(f); } catch (e) { return { ...out, status: 'unreadable', error: String(e.message || e) }; }
  out.pages = doc.numPages;
  let head = '', all = '', noTable = 0, stated = null, ocrPages = 0, vecCells = 0, weekCells = 0, lastCols = null, glyphCells = 0;
  const ocrCells = [0, 0];
  let weeks = [];
  /* ⚠ الملف الواحد قد يحوي عدة مقررات (الرياضيات والاحصاء للصفين في ملف واحد من ٢٠ صفحة، رفع
     باربعة اسماء): تقسم الصفحات عند كل «المجموع الكلي» — لكل مقرر مجموعه في آخر صفحاته. */
  const segs = [{ pages: [], weeks: [], stated: null, grade: '' }];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    let txt = fixLig((await page.getTextContent()).items.map(i => i.str).join(' ').replace(/\s+/g, ' ')).normalize('NFKC');
    let t = null; try { t = await readTable(page); } catch (e) {}
    /* صفحة تكمل جدول سابقتها بلا ترويسة (إنجليزي الثانوي: الترويسة في الصفحات الفردية) ⟵ تقرأ باعمدة سابقتها */
    if (!t && lastCols) { try { t = await readTable(page, lastCols); } catch (e) {} }
    /* ⚠ جدول بلا صف واحد كلا جدول: وجدت ترويسته ولم تقرأ حدود اسابيعه (لغتي العربية للمتوسط ص١٢ و١٣ و١٨ —
       لا يعرف الا خطوط جدول الاعتماد اسفلها)، فكان لا يسقط الى القراءة الضوئية وتضيع اسابيع الصفحة صامتة (2026-09-12) */
    if (t && !t.weeks.length) t = null;
    if (t) lastCols = { colX: t.colX, roles: t.roles, ltr: t.ltr };
    /* لا جدول من رسم الملف ⟵ قراءة ضوئية (ocrpage.mjs): الصفحة الممسوحة (رياضيات الابتدائي) وذات الخط المرمز
       (رياضيات المتوسط). ونصها يحل محل نص الملف ان قرأت جدولا، او كان نص الملف فقيرا، او سبقتها صفحة قرئت
       ضوئيا — فمنه يلتقط الصف والمجموع الكلي والترويسة (2026-09-12) */
    let pageMissed = 0;
    /* جدول من رسم الملف وخانات حصص فارغة (ارقام بخط مرمز — رياضيات الأدبي) ⟵ تقرأ خاناتها ضوئيا */
    if (t && OCR && t.weeks.some(w => w.دروس.some(l => !l.حصص))) {
      try { const r = fillVectorPeriods(f, n, t, { cache: `${W}/ocr-cache` }); vecCells += r.read; glyphCells += r.glyph || 0; pageMissed = r.missed; ocrCells[0] += r.read; ocrCells[1] += r.missed; }
      catch (e) { console.log('  (تعذرت قراءة خانات الحصص ضوئيا في الصفحة ' + n + ': ' + String(e.message || e).slice(0, 80) + ')'); }
    }
    /* وتسمية الاسبوع بلا ترتيبي مقروء ⟵ تقرأ خانتها ضوئيا — ولو كان فيها تاريخان: الترتيبيات ادل
       («الأسبوع الأول والثاني والثالث والرابع» في إنجليزي الابتدائي، ونص الملف فيه التاريخان وحدهما) */
    if (t && OCR) {
      const bad = t.weeks.filter(w => w.band && !ordsIn(w.أسبوع).length);
      if (bad.length) try { weekCells += readWeekCells(f, n, t, bad, { cache: `${W}/ocr-cache` }); } catch (e) {}
    }
    if (!t && OCR) {
      try {
        const o = ocrTable(f, n, { cache: `${W}/ocr-cache` });
        const poor = (txt.match(/[ء-ي]/g) || []).length < 40;
        if (o.t) { t = { ...o.t, ocr: true }; ocrPages++; ocrCells[0] += o.cellsRead; ocrCells[1] += o.cellsMissed; pageMissed = o.cellsMissed; glyphCells += o.glyph || 0; }
        if (o.t || poor || ocrPages) txt = fixLig(o.text.replace(/\s+/g, ' '));
      } catch (e) { console.log('  (تعذرت القراءة الضوئية للصفحة ' + n + ': ' + String(e.message || e).slice(0, 80) + ')'); }
    }
    if (n <= 2) head += txt + ' ';
    all += txt + ' ';
    const pageGrade = gradeIn(txt);
    /* ⚠ وتبدل الصف في الترويسة يبدأ قسما جديدا: ملف رياضيات الابتدائي الواحد (٢٥ صفحة) يجمع الصفوف
       الخمسة ورفع باسم كل صف، ولا «مجموع كلي» فيه يقسم عنده — فقرئ ٧٢ اسبوعا للثالث (2026-09-12) */
    let seg = segs[segs.length - 1];
    /* ⚠ وعودة الاسابيع الى «الأول» بعد اسبوع متقدم تبدأ قسما جديدا: ملف لغتي العربية للمتوسط (٢٠ صفحة) يجمع
       الصفوف الاربعة خمس صفحات لكل صف، واسم الصف في ترويسته صورة لا نص ولا «مجموع كلي» فيه — فقرئت الاسابيع
       ١–١٢ اربع مرات (2026-09-12). وصف القسم يقرأ بعدئذ ضوئيا من اول صفحاته كسائر الملفات المجموعة */
    const firstN = t && t.weeks.length ? (ordsIn(t.weeks[0].أسبوع)[0] ?? null) : null;
    const segMax = seg.weeks.reduce((a, w) => Math.max(a, w.n || 0), 0);
    const restart = firstN === 1 && segMax >= 4;
    if (((pageGrade && seg.grade && pageGrade !== seg.grade) || restart) && seg.pages.length) { segs.push({ pages: [], weeks: [], stated: null, grade: '' }); seg = segs[segs.length - 1]; }
    seg.pages.push(n);
    if (!seg.grade && pageGrade) seg.grade = pageGrade;
    /* الخانات الفائتة تحسب لقسم المقرر لا للملف كله (ملف الابتدائي يجمع خمسة صفوف) */
    if (t && t.ocr) seg.ocrPages = (seg.ocrPages || 0) + 1;
    if (pageMissed) seg.ocrMissed = (seg.ocrMissed || 0) + pageMissed;
    /* المعلن: عدد من ثلاث خانات على الاكثر — كان يلتقط «2026» من سطر العام الدراسي */
    /* ⚠ والعدد قد يصل مقطعا بفراغ قبل «حصة» («7 6 حصة» = ٧٦) — فقرئ ٧ في ملف رياضيات الحادي عشر */
    const m = statedIn(txt);
    if (!t) noTable++;
    else for (const [wi, w] of t.weeks.entries()) { const row = { label: (w.أسبوع || '').replace(/\s+/g, ' ').trim(), n: ordsIn(w.أسبوع)[0] ?? null, spanOrd: spanOf(ordsIn(w.أسبوع)), ...weekDates(w.أسبوع),
      unit: (w.وحدة || '').replace(/\s+/g, ' ').trim(), ocr: !!t.ocr || undefined,
      lessons: (w.دروس || []).map(l => ({ title: cleanTitle((l.دروس || []).join(' · ')), periods: parseInt(l.حصص || '0') || 0,
        ...(l.glyphGroup ? { glyphGroup: l.glyphGroup, glyphVals: l.glyphVals } : {}) })) };
      /* ⚠ صف يمتد صفحات (إنجليزي الثانوي: وحدة واحدة على ثلاث صفحات بتسميتها نفسها، وحصصها في الاولى) —
         اول صف في الصفحة بترتيبيات سابقه (او تسميته) ووحدته نفسيهما تكملة له لا اسبوع جديد */
      const prev = seg.weeks[seg.weeks.length - 1];
      const key = r => (ordsIn(r.label).join(',') || bare(r.label)) + '|' + bare(r.unit);
      /* ⚠ وخانة الاسبوع تكتب في الصفحة الاولى وحدها: اول صف في الصفحة بلا تسمية ولا تاريخ تكملة لسابقه (الفرنسية ١٢:
         الحادي عشر ٣ دروس + درسان في اول الصفحة التالية = ٥ كسائر اسابيعها) — كان يعد صفا مجهولا فظهرت فجوة (2026-09-13).
         وان كان في الحق اسبوعا جديدا لم تقرأ تسميته، ظهرت فجوة فيراجع — لا يمر سليما خطأ */
      const bareRow = !bare(row.label) && !row.from;
      if (wi === 0 && prev && (bareRow || ((ordsIn(row.label).length || bare(row.label).length > 5) && key(prev) === key(row)))) { prev.lessons.push(...row.lessons); continue; }
      seg.weeks.push(row);
    }
    if (m && +m[1] > 0) { seg.stated = +m[1]; seg.statedAlts = m[2] || []; if (n < doc.numPages) segs.push({ pages: [], weeks: [], stated: null, grade: '' }); }
  }
  const real = segs.filter(s => s.weeks.length);
  /* الملف المجموع وصف قسمه لا يقرأ من نص الملف (خط مشوه «الصف: ا»): تقرأ ترويسة اول صفحة من كل قسم ضوئيا.
     فظهر ان ملف رياضيات الثانوي (٢٠ صفحة) يجمع الحادي عشر والثاني عشر بمساريهما — والإحصاء رياضيات الأدبي */
  if (OCR && real.length > 1) for (const s of real) if (!s.grade || !s.track) {
    try {
      const tx = ocrText(f, s.pages[0], { cache: `${W}/ocr-cache` });
      if (!s.grade) s.grade = gradeIn(tx);
      if (!s.track) s.track = trackIn(tx);
    } catch (e) {}
  }
  out.segments = real.length > 1 ? real.map(s => ({ pages: s.pages[0] + '–' + s.pages[s.pages.length - 1], grade: s.grade, track: s.track || undefined, weeks: s.weeks.length,
    periods: s.weeks.reduce((a, w) => a + w.lessons.reduce((b, l) => b + l.periods, 0), 0), stated: s.stated })) : null;
  /* للمقرر قسمه: بالصف ان حسمه عنوان القسم، والا يبقى الاول ويوسم للمراجعة */
  let chosen = real[0] || segs[0];
  if (real.length > 1) {
    const byGrade = real.filter(s => s.grade && bare(s.grade) === bare(out.grade));
    const unknown = real.filter(s => !s.grade);
    const isStats = /إحصاء|احصاء/.test(out.subject);
    /* الاحصاء: قسماه بلا صف مقروء في ترويستهما — ينسبان بالترتيب (الحادي عشر اولا) ويوسمان للمراجعة */
    /* المسار يفصل ما لم يفصله الصف: الإحصاء مقرر الأدبي وسائرها العلمي (ترويسة «الحادي عشر أدبي») */
    const byTrack = byGrade.filter(s => s.track === (isStats ? 'أدبي' : 'علمي'));
    if (byGrade.length > 1 && byTrack.length === 1) { chosen = byTrack[0]; out.segmentPick = 'track'; }
    else if (isStats && unknown.length) { chosen = unknown[/حادي/.test(out.grade) ? 0 : unknown.length - 1]; out.segmentPick = 'guess'; }
    else if (byGrade.length === 1) { chosen = byGrade[0]; out.segmentPick = 'grade'; }
    else { chosen = (byGrade[0] || real[0]); out.segmentPick = 'guess'; }
  }
  weeks = chosen.weeks; stated = chosen.stated;
  /* صف يمتد اسابيع (الخطط الموزعة بالوحدة): عدد اسابيعه من ترتيبياته («الرابع و… والسابع») او من مدى
     تاريخيه («من 14/9 إلى 6/10»)، الاكبر منهما — والحكم بمجموع ما تغطيه الصفوف لا بعددها (2026-09-12) */
  for (const w of weeks) {
    let sp = w.spanOrd || 1;
    if (w.from && w.to) { const days = (Date.parse(w.to) - Date.parse(w.from)) / 864e5; if (days > 7 && days < 120) sp = Math.max(sp, Math.round((days + 3) / 7)); }
    if (sp > 1) w.span = sp;
  }
  /* الترويسة: اسم المقرر كما تكتبه الوثيقة، والصف */
  const cm = head.match(/توزيع\s+منهج\s+(?:مادة|مقرر)?:?\s*(.{2,60}?)\s+(?:للعام|العام|الفصل|الصف|لل?صف)/) || head.match(/مادة:?\s*([^:]{2,45}?)\s+(?:العام|الفصل)/);
  out.courseTitle = cm ? cm[1].replace(/[-–:]+$/, '').trim() : null;
  /* اكثر من مقرر = عناوين مقررات مختلفة، لا تكرار «توزيع منهج» في ترويسة كل صفحة */
  const titles = new Set([...all.matchAll(/توزيع\s+منهج\s+(?:مادة|مقرر)?:?\s*(.{2,40}?)\s+(?:للعام|العام|الفصل|الصف|لل?صف)/g)].map(x => bare(x[1])));
  out.multiCourse = titles.size > 1;
  out.titles = titles.size;
  /* الختم: «مدير إدارة توجيه …» — ويستبعد «التوجيه الفني المختص» النمطي */
  const dm = all.match(/(?:مدير\s+)?إدارة\s+(?:ال)?توجيه\s+(?:الفني\s+)?(?:العام\s+)?(?:ل)?([^\s،.:]+(?:\s+(?:و|ال)[^\s،.:]+){0,3})/);
  const dm2 = !dm && all.match(/التوجيه\s+الفني\s+(?:العام\s+)?(?:ل|للغة\s+)?([^\s،.:]+(?:\s+[^\s،.:]+)?)/);
  out.directorate = dm ? 'إدارة توجيه ' + dm[1].trim() : dm2 && !/المختص/.test(dm2[0]) ? 'التوجيه الفني ' + dm2[1].trim() : null;
  out.hasDates = /\d{1,2}\s*[\/\-]\s*\d{1,2}\s*[\/\-]\s*20\d\d/.test(all);
  /* سبب تعذر الجدول: نص لا يقرأ (خط بترميز خاص — التربية الاسلامية والقران) ام جدول لم يتعرف عليه */
  const arCount = (all.match(/[ء-ي]/g) || []).length;
  out.cause = null;
  /* الجودة */
  /* رقم الاسبوع: التسمية تأكيد لا مصدر — المجهول بين معلومين يستنتج ان اتسع له المدى تماما
     («الساّس» بين الخامس والسابع ⟵ السادس · «الثان ً» بين الاول والثالث ⟵ الثاني)، ولا تعد فجوة
     الا قفزة لا يفسرها صف مجهول. والمستنتج يوسم (nInferred) فلا يعرض تأكيدا */
  const idx = weeks.map(w => w.n ?? null);
  for (let i = 0; i < idx.length; i++) if (idx[i] == null) {
    let a = i - 1; while (a >= 0 && idx[a] == null) a--;
    let b = i + 1; while (b < idx.length && idx[b] == null) b++;
    const lo = a >= 0 ? idx[a] : 0, hi = b < idx.length ? idx[b] : null;
    /* ولا يستنتج بين صفوف ممتدة — مداها يغير الحساب */
    if (hi != null && hi - lo === b - a && !weeks.slice(Math.max(a, 0), Math.min(b + 1, weeks.length)).some(x => (x.span || 1) > 1)) for (let k = a + 1; k < b; k++) { idx[k] = lo + (k - a); weeks[k].n = idx[k]; weeks[k].nInferred = true; }
  }
  /* والصف الممتد يعد كل اسابيعه («الرابع» بمدى ٤ = ٤،٥،٦،٧) — والا ظهرت فجوة لا وجود لها */
  /* ⚠ صف يبدأ داخل مدى الصف الذي قبله — «تابع» يكرر مدى وحدته (إنجليزي المتوسط)، او وحدة تبدأ في اسبوع
     حد سابقتها (إنجليزي الابتدائي: ١–٤ ثم ٤–٧) — بنية خطة لا تكرار: ما غطته السابقة لا يعد ثانية.
     ويبقى التكرار الحق: صف يعود الى اسبوع قبل مدى سابقه */
  const seq = []; let prevRange = null;
  weeks.forEach((w, i) => {
    if (!idx[i]) return;
    const s = idx[i], e = s + (w.span || 1) - 1;
    const overlap = prevRange && s >= prevRange[0] && s <= prevRange[1];
    for (let v = s; v <= e; v++) if (!(overlap && v <= prevRange[1])) seq.push(v);
    prevRange = overlap ? [prevRange[0], Math.max(prevRange[1], e)] : [s, e];
  });
  const uniq = [...new Set(seq)];
  const maxW = uniq.length ? Math.max(...uniq) : 0;
  const gaps = []; for (let i = 1; i <= maxW; i++) if (!uniq.includes(i)) gaps.push(i);
  const dups = [...new Set(seq.filter((v, i) => seq.indexOf(v) !== i))];
  const lessons = weeks.reduce((a, w) => a + w.lessons.length, 0);
  let periods = weeks.reduce((a, w) => a + w.lessons.reduce((b, l) => b + l.periods, 0), 0);
  /* المعلن المبهم («26 1 حصة»): ان خالف المقروء وطابقته قراءة اخرى ممكنة لارقامه اخذت ووسمت — حكم بين
     قراءات النص نفسه، لا تغطية لفرق حقيقي (ما لا تطابقه قراءة يبقى فرقا يراجع) */
  if (stated != null && stated !== periods && (chosen.statedAlts || []).includes(periods)) { stated = periods; out.statedAmbiguous = true; }
  /* خانات صورة حبرها واحدة وقراءاتها مختلفة (ocrpage.mjs، الجولة الرابعة): الصورة الواحدة لا تكون رقمين، فاحدى
     القراءتين خطأ. ان خالف المجموع المعلن، وجعلت قيمة واحدة لكل مجموعة من قيمها المقروءة يطابقه على وجه واحد لا
     غير — اخذ ووسم؛ وما لم يطابق او احتمل وجهين يبقى فرقا يراجع */
  if (stated != null && stated !== periods) {
    const G = new Map();
    for (const w of weeks) for (const l of w.lessons) if (l.glyphGroup) { if (!G.has(l.glyphGroup)) G.set(l.glyphGroup, []); G.get(l.glyphGroup).push(l); }
    const gs = [...G.values()].filter(m => m.length > 1).slice(0, 6), sols = [];
    const rec = (k, delta, pick) => {
      if (k === gs.length) { if (periods + delta === stated) sols.push(pick.slice()); return; }
      for (const v of gs[k][0].glyphVals) { pick.push(v); rec(k + 1, delta + gs[k].reduce((a, l) => a + v - l.periods, 0), pick); pick.pop(); }
    };
    if (gs.length) rec(0, 0, []);
    if (sols.length === 1) {
      gs.forEach((m, k) => m.forEach(l => { l.periods = sols[0][k]; }));
      periods = weeks.reduce((a, w) => a + w.lessons.reduce((b, l) => b + l.periods, 0), 0);
      out.glyphResolved = gs.length;
    }
  }
  Object.assign(out, { weeks: weeks.length, lessons, periods, stated, noTable, labeled: seq.length, gaps, dups,
    totalMatch: stated == null ? null : stated === periods, plan: weeks,
    ocr: ocrPages ? { pages: chosen.ocrPages || ocrPages, cellsMissed: chosen.ocrMissed || 0, filePages: ocrPages, fileCellsRead: ocrCells[0], fileCellsMissed: ocrCells[1] } : null });
  const issues = [];
  /* «قرئ ضوئيا» اعلام لا عيب — والعيب خانات حصص لم تقرأ في قسم المقرر نفسه */
  if (ocrPages) issues.push('قرئ ضوئيا (' + (chosen.ocrPages || ocrPages) + ' صفحة)');
  /* ومطابقة المجموع المعلن برهان اكتمال: ما بقي من خانات فيها حبر ليس حصصا */
  if (chosen.ocrMissed && !(stated != null && stated === periods)) issues.push(chosen.ocrMissed + ' خانة حصص لم تقرأ ضوئيا');
  if (vecCells) issues.push('أعداد حصص قرئت ضوئيا (' + vecCells + ')');
  /* اعلام لا عيب: ما عرف بتطابق الصور، وما صحح منها بالمجموع المعلن */
  if (glyphCells) issues.push('أعداد حصص عرفت بتطابق صورها (' + glyphCells + ')');
  if (out.glyphResolved) issues.push('خانات متماثلة الصورة صححت بالمجموع المعلن (' + out.glyphResolved + ')');
  if (!weeks.length) issues.push('لم يقرأ جدول');
  /* صف يمتد اسابيع (الخطط الموزعة بالوحدة: «من 14/9 إلى 6/10» صف واحد لاربعة اسابيع — إنجليزي الابتدائي):
     عدد اسابيعه من مدى تاريخيه، والحكم بمجموع ما تغطيه الصفوف لا بعددها (2026-09-12) */
  out.weekCellsRead = weekCells || undefined;
  /* ما تغطيه الصفوف: الاسابيع المرقمة بلا تكرار + ما لا رقم له بمداه */
  /* وما لا رقم له: اتحاد مدى تواريخه لا جمعها — صفوف وحدة تحمل مدى الوحدة كلها فجمعت ٥١ اسبوعا (الكهرباء الإلكترونية) */
  const iv = weeks.filter((w, i) => !idx[i] && w.from && w.to).map(w => [Date.parse(w.from), Date.parse(w.to)]).sort((p, q) => p[0] - q[0]);
  const merged = []; for (const [a, b] of iv) { const L = merged[merged.length - 1]; if (L && a <= L[1] + 864e5) L[1] = Math.max(L[1], b); else merged.push([a, b]); }
  const spanned = new Set(seq).size + merged.reduce((a, [p, q]) => a + Math.max(1, Math.round(((q - p) / 864e5 + 3) / 7)), 0)
    + weeks.filter((w, i) => !idx[i] && !(w.from && w.to)).length;
  out.weeksSpan = spanned !== weeks.length ? spanned : undefined;
  if (weeks.length && spanned < 8) issues.push('أسابيع قليلة (' + spanned + ')');
  if (spanned > 22) issues.push('أسابيع كثيرة (' + spanned + ') — قد يجمع الملف فصلين أو مقررين');
  if (gaps.length) issues.push('فجوات في ترقيم الأسابيع: ' + gaps.join('،'));
  if (dups.length) issues.push('تكرار أسابيع: ' + dups.join('،'));
  if (stated != null && stated !== periods) issues.push('مجموع الحصص ' + periods + ' والمعلن ' + stated);
  /* الملف المقسم تكفيه ملاحظة التقسيم */
  if (out.multiCourse && !out.segments) issues.push('قد يحوي أكثر من مقرر');
  if (weeks.length && !periods) issues.push('لم تقرأ أعداد الحصص');
  if (!weeks.length) out.cause = (arCount < 300 && !/week|unit|lesson|period/i.test(all)) ? 'encoding' : 'layout';
  if (out.segments) issues.push('ملف يجمع ' + out.segments.length + ' أقسام — ' + (out.segmentPick === 'grade' ? 'نسب القسم بالصف' : out.segmentPick === 'track' ? 'نسب القسم بالصف والمسار' : 'نسب القسم تقديرا ويراجع'));
  if (!out.directorate) issues.push('لم يقرأ الختم');
  out.issues = issues;
  out.status = !weeks.length ? 'no-table' : issues.filter(i => !/الختم|^قرئ ضوئيا \(|^أعداد حصص قرئت ضوئيا|^أعداد حصص عرفت بتطابق|متماثلة الصورة صححت|نسب القسم بالصف/.test(i)).length ? 'review' : 'ok';
  return out;
}

/* ── الاستئناف وقراءة خطط بعينها (2026-09-13، قرار المستخدم «يجب ان تكون العملية ان تواصل حيث توقفت»):
   • كل خطة تحفظ نتيجتها فور قراءتها في partial-…json مع بصمة الكود (batch · lib2 · lib3 · ocrpage · ocr.swift):
     فان انقطع القياس اكمل من حيث وقف — ما دام الكود نفسه (كود تغير يبطل النتائج فتعاد، والمخبأ يسرعها).
   • ONLY=٣٧٧٣,٤٣٧٠ يقرأ هذه وحدها ويبقي ما سواها من القياس السابق — لتجربة اصلاح على الباقي في دقائق،
     ثم قياس كامل واحد في الختام يحرس السليم من التراجع (لا قياس كامل بعد كل تعديل) */
import crypto from 'crypto';
const CODE = crypto.createHash('sha1').update(['batch.mjs', 'lib2.mjs', 'lib3.mjs', 'ocrpage.mjs', 'ocr.swift']
  .map(f => fs.readFileSync(new URL('./' + f, import.meta.url))).join('')).digest('hex').slice(0, 12);
const PART = `${W}/plans/partial-${STAGE}-t${TERM}.json`;
const ONLY = (process.env.ONLY || '').split(',').map(s => s.trim()).filter(Boolean);
let prevPart = null; try { prevPart = JSON.parse(fs.readFileSync(PART, 'utf8')); } catch (e) {}
const done = new Map(!ONLY.length && prevPart && prevPart.code === CODE ? prevPart.results.map(r => [String(r.id), r]) : []);
if (done.size) console.log(`(استئناف: ${done.size} خطة قرئت بالكود نفسه — تتخطى)`);
const OLD = new Map();
if (ONLY.length) try { JSON.parse(fs.readFileSync(`${W}/plans/extract-${STAGE}-t${TERM}.json`, 'utf8')).results.forEach(r => OLD.set(String(r.id), r)); } catch (e) {}
const results = [];
let i = 0;
for (const p of picked) {
  i++;
  const id = String(p.x.bookFileID);
  let r = done.get(id) || (ONLY.length && !ONLY.includes(id) ? OLD.get(id) : null);
  const fresh = !r;
  if (!r) r = await extract(p);
  results.push(r);
  if (fresh && !ONLY.length) fs.writeFileSync(PART, JSON.stringify({ code: CODE, results }));
  console.log(`[${i}/${picked.length}] ${r.status.padEnd(8)} ${r.grade} · ${r.subject} (#${r.id}) — ${r.weeks ?? '-'} أسبوعا · ${r.periods ?? '-'} حصة${r.stated != null ? ' / ' + r.stated : ''} · ${r.directorate || 'بلا ختم'}${r.issues && r.issues.length ? ' ⟵ ' + r.issues.join(' | ') : ''}`);
  if (fresh) await sleep(300);
}
/* المواد في شجرة الوزارة بلا خطة تختار */
const missing = [];
for (const [gid, G] of Object.entries(st.grades)) for (const s of G.subjects) {
  const id = String(s.value || s.id);
  if (!results.some(r => String(r.gradeId) === String(gid) && String(r.subjectId) === id)) missing.push({ grade: G.name.trim(), subject: s.text.trim() });
}
fs.writeFileSync(`${W}/plans/extract-${STAGE}-t${TERM}.json`, JSON.stringify({ stage: st.name.trim(), stageId: STAGE, term: TERM, at: new Date().toISOString(),
  grades: Object.values(gname), results, missing }, null, 1));
if (!ONLY.length) try { fs.unlinkSync(PART); } catch (e) {}   /* القياس تم — لا استئناف بعده */
const c = s => results.filter(r => r.status === s).length;
console.log(`\nالمجموع ${results.length} · سليم ${c('ok')} · يراجع ${c('review')} · بلا جدول ${c('no-table')} · تعذر تنزيله ${c('download-failed')} · لا يقرأ ${c('unreadable')} · مواد بلا خطة ${missing.length}`);
