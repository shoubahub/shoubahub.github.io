// قراءة صفحة خطة قراءة ضوئية ثم بناء جدولها بـtableFrom نفسه (2026-09-12)
// للخطط الممسوحة (صورة بلا نص — رياضيات الابتدائي) وذات الخط المرمز (نص لا يقرأ — رياضيات المتوسط):
// الخطوط تستخرج من البكسل والنص من محرك Vision في النظام (ocr.swift) — لا ارسال لاي خادم.
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { tableFrom } from './lib3.mjs';

const SRC = new URL('./ocr.swift', import.meta.url).pathname;
/* ⚠ الاداة المترجمة خارج سطح المكتب: iCloud يخلي الملفات فيتعلق تشغيلها بلا خطأ */
const BIN = `${os.homedir()}/.cache/shouba-lab/ocr`;
/* يرفع حين يتغير ما يخرجه ocr.swift لمدخل بعينه (العتبات، طريقة الرسم) — فيبطل المخبأ */
const OCR_VER = 4;   /* 3: الخانات تحمل dash (الشرطة) · 4: ارتفاع حبر الرقم موحد ٤٨ بكسلا */
/* واصدار الخطوط وحدها (--lines): مد البكسل للمسح المائل غير خطوط الصفحة لا غير — فلا يعاد ما سواها */
const OCR_VER_LINES = 3;
/* واصدار الخانات وحدها (--cells): اضيف dims (ابعاد حبر كل خانة، 2026-09-13) — فتعاد قراءة الخانات وحدها، وقراءة
   الصفحات كاملة في المخبأ كما هي (مفتاحها باصدارها) */
const OCR_VER_CELLS = 6;   /* 6: sig (صورة الحبر مصغرة) */
function bin() {
  const fresh = fs.existsSync(BIN) && fs.statSync(BIN).mtimeMs >= fs.statSync(SRC).mtimeMs;
  if (!fresh) { fs.mkdirSync(BIN.replace(/\/[^/]+$/, ''), { recursive: true }); execFileSync('swiftc', ['-O', SRC, '-o', BIN], { stdio: 'inherit' }); }
  return BIN;
}
/* المخبأ لمخرج المحرك الخام لا للجدول المبني: تعديل طريقة البناء لا يعيد القراءة الضوئية */
let CACHE = null;
function run(args) {
  const key = CACHE && `${CACHE}/${crypto.createHash('sha1').update(args.join('') + '|' + fs.statSync(args[0]).size + '|v' + (args.includes('--lines') ? OCR_VER_LINES : args.includes('--cells') ? OCR_VER_CELLS : OCR_VER)).digest('hex').slice(0, 24)}.json`;
  if (key && fs.existsSync(key)) return JSON.parse(fs.readFileSync(key, 'utf8'));
  const out = execFileSync(bin(), args, { maxBuffer: 256 << 20 }).toString();
  if (key) { fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(key, out); }
  return JSON.parse(out);
}
/* الارقام الهندية الى لاتينية — الجدول والمجموع والتواريخ تطابق بـ\d */
export const latin = s => s.replace(/[٠-٩]/g, d => d.charCodeAt(0) - 0x660).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 0x6F0);
const isStart = s => /^\s*[()]/.test(s);
/* الخانة تقرأ بثلاث نسخ متلاصقة («٢٢٢» · «١٠١٠١٠») — بنسخة او نسختين لا يقرأ الرقم البتة (جرب 2026-09-12).
   يرد الى نسخة واحدة ان تكرر تاما، او كان حرفا واحدا مكررا؛ وما سواه شك فيترك فارغا لا يخمن */
const detile = (s, k) => {
  const c = [...s]; if (!c.length) return '';
  /* ⚠ حرف واحد مكرر يرد الى نفسه اولا: «١١١١١١» ملتبس بين «١» و«١١» — قرئت «١١» مرتين في رياضيات
     الحادي عشر أدبي (٤٣ حصة والمعلن ٢٥). والحصة الواحدة لدرس اغلب من احدى عشرة، والمجموع المعلن حكم */
  if (c.every(x => x === c[0])) return c[0];
  if (c.length % k === 0) { const p = c.slice(0, c.length / k).join(''); if (p.repeat(k) === s) return p; }
  return '';
};
/* «١» خط رأسي مجرد — قد يقرؤه المحرك حرفا لاتينيا (l · I · |) */
const cellValue = s => { const v = (detile(latin(s).replace(/[lI|!]/g, '1').replace(/\s+/g, ''), 3).match(/\d+/g) || []).map(Number).filter(v => v > 0 && v <= 30); return v.length ? v[0] : 0; };
/* نص الصفحة سطرا سطرا ومن اليمين: الترتيب بالارتفاع وحده بعثر سطر العنوان
   («2027/2026 توزيع منهج مادة: الرياضيات …») فظنت الخطة متعددة المقررات */
function pageText(items) {
  const lines = [];
  for (const i of [...items].sort((p, q) => q.y - p.y)) {
    const L = lines.find(L => Math.abs(L.y - i.y) < 5);
    if (L) L.items.push(i); else lines.push({ y: i.y, items: [i] });
  }
  return lines.map(L => L.items.sort((p, q) => q.x - p.x).map(i => i.s).join(' ')).join(' ');
}
/* ── ميل المسح (2026-09-12): الورقة الممسوحة مائلة نصف درجة فينزل خط الجدول ٤ نقاط من طرف الى طرف —
   فخرج حد الاسبوع في طرف عمود الاسبوع عن سماح التجميع (٢٫٥ نقطة) وسقطت صفحتان من رياضيات السادس.
   يقاس الميل من خطوط الصفحة نفسها: خط البكسل المائل يصل شرائح متتابعة، كل شريحة ازيحت يمينا ونزلت قليلا،
   فميل كل خط = انحدار ارتفاع شرائحه على مواضعها (الوسيط بين الخطوط). ثم تعدل الخطوط والنص معا دورانا صغيرا
   (x + م·y ، y − م·x)، وترد مواضع الخانات الى اطار الصورة الاصلي عند قصها. */
/* ⚠ الميل من شرائح خط واحد متتابعة فقط — متداخلة، كل تالية تبدأ ابعد يمينا وترتفع او تنزل اقل من نقطة.
   الانحدار على كل ما في النطاق خلط خطا كاملا بقطعة جزئية قريبة منه، فقدر للصفحات المستقيمة ٠٫٩° */
function skewOf(lines) {
  const hs = lines.filter(r => r.h <= 2.5 && r.w > 30).map(r => ({ x1: r.x, x2: r.x + r.w, y: r.y })).sort((a, b) => a.y - b.y);
  const groups = [];
  for (const s of hs) { const g = groups.find(g => Math.abs(g.y - s.y) < 3); if (g) { g.p.push(s); g.y += (s.y - g.y) / g.p.length; } else groups.push({ y: s.y, p: [s] }); }
  const sl = [];
  for (const g of groups) {
    const p = g.p.sort((a, b) => a.x1 - b.x1);
    for (let i = 1; i < p.length; i++) {
      const dx = p[i].x1 - p[i - 1].x1, dy = p[i].y - p[i - 1].y;
      if (dx > 5 && p[i].x1 < p[i - 1].x2 && Math.abs(dy) <= 1) sl.push(dy / dx);
    }
  }
  if (sl.length < 6) return 0;
  sl.sort((a, b) => a - b);
  return sl[sl.length >> 1];
}
/* شواهد كل ملف: خانات حصص عرفت قيمها (من نص الصفحة او الجولة الاولى) — للجولة الثانية.
   مواضعها في اطار الصورة الاصلي لصفحتها، فتقص كما هي ولو اختلف ميل الصفحتين */
const POOL = new Map();
/* صور حبر خانات عرفت قيمها في الملف — لتطابق الصور عبر صفحاته (الجولة الرابعة): صفحة الملف الممسوح الواحد
   بتكبير واحد، والاسبوع الاخير قد يقع وحده في صفحته فلا شقيق له فيها (المواد الحرة #4370، 2026-09-13) */
const GLYPHS = new Map();
const fmt = (p, r) => p + '@' + r.map(v => v.toFixed(1)).join(',');
/* شواهد متنوعة القيم، الاقرب صفحة اولا: قيمة لكل شاهد ما امكن، والى اربعة */
function pickRefs(pool, n) {
  const byV = new Map();
  for (const e of [...pool].sort((a, b) => Math.abs(a.p - n) - Math.abs(b.p - n))) if (!byV.has(e.v)) byV.set(e.v, e);
  const refs = [...byV.values()].slice(0, 4);
  for (const e of pool) { if (refs.length >= 3) break; if (!refs.includes(e)) refs.push(e); }
  return refs;
}

/* نص الصفحة وحده — لترويسة لا يقرأ صفها من نص الملف (خط مشوه «الصف: ا») */
export function ocrText(file, n, { cache } = {}) {
  if (cache) CACHE = cache;
  const d = run([file, String(n), '--scale', '3', '--json']);
  return pageText(d.items.filter(i => i.s.trim()).map(i => ({ s: latin(i.s.normalize('NFKC')), x: i.x, y: i.y + i.h * 0.3, w: i.w })));
}

export function ocrTable(file, n, { cache } = {}) {
  if (cache) CACHE = cache;
  if (!POOL.has(file)) POOL.set(file, []);
  const pool = POOL.get(file);
  const d = run([file, String(n), '--scale', '3', '--json', '--lines']);
  /* يبنى الجدول بالاطار المعدل وبدونه، ويؤخذ ما يقرأ دروسا اكثر (والتساوي بلا تعديل) —
     فلا يفسد تقدير خاطئ للميل صفحة كانت تقرأ سليمة */
  const build = tl => {
    const fwd = (x, y) => [x + tl * y, y - tl * x];
    const lines = tl ? d.lines.map(r => { const [x, y] = fwd(r.x + r.w / 2, r.y + r.h / 2); return { x: x - r.w / 2, y: y - r.h / 2, w: r.w, h: r.h }; }) : d.lines;
    /* y خط الكتابة لا اسفل الصندوق: صندوق المحرك ينزل بالذيول («ي ع») تحت خط الخانة في المسح المائل،
       فينسب السطر الاخير من الدرس الملتف الى الدرس التالي («10000 مع إعادة التسمية» ⟵ (12-2)) — وpdf.js
       يعطي خط الكتابة اصلا، فيتفق المصدران */
    const items = d.items.filter(i => i.s.trim()).map(i => {
      const [cx, y] = fwd(i.x + i.w / 2, i.y + i.h * 0.3);
      return { s: latin(i.s.normalize('NFKC')), x: cx - i.w / 2, y, w: i.w, rot: false };
    });
    return { tl, items, t: tableFrom(lines, items) };
  };
  const lessonsOf = b => b.t ? b.t.weeks.reduce((a, w) => a + w.دروس.length, 0) : -1;
  const s = skewOf(d.lines);
  const plain = build(0), tilted = Math.abs(s) > 0.0015 ? build(s) : null;
  const best = tilted && lessonsOf(tilted) > lessonsOf(plain) ? tilted : plain;
  const tilt = best.tl, items = best.items, t = best.t;
  const back = (x, y) => [x - tilt * y, y + tilt * x];
  /* خانة بالاطار المعدل ⟵ مستطيل في الصورة الاصلية (المركز يرد، والابعاد كما هي) */
  const orig = r => { const [cx, cy] = back(r[0] + r[2] / 2, r[1] + r[3] / 2); return [cx - r[2] / 2, cy - r[3] / 2, r[2], r[3]]; };
  const text = pageText(items);
  let cellsRead = 0, cellsMissed = 0, cellsAnchored = 0, anchor = null, glyph = 0;
  if (t) {
    for (const w of t.weeks) for (const l of w.دروس) {
      /* سطر الدرس الملتف («(٢-١) قراءة الاعداد العشرية …» ثم «وكتابتها») تتمة لما قبله لا درس جديد */
      l.دروس = l.دروس.reduce((a, s) => { if (a.length && !isStart(s) && isStart(a[0])) a[a.length - 1] += ' ' + s; else a.push(s); return a; }, []);
    }
    /* تسمية الاسبوع مكتوبة رأسيا — قراءة الصفحة تفوت بعضها («الثاني» في رياضيات السادس):
       تقرأ خانة الاسبوع مدارة افقيا، وتعتمد ان حملت نصا */
    const wk = t.weeks.filter(w => w.band);
    if (wk.length) {
      const cells = wk.map(w => orig([t.weekX[0] + 2, w.band[1] + 2, t.weekX[1] - t.weekX[0] - 4, w.band[0] - w.band[1] - 4]).map(v => v.toFixed(1)).join(',')).join(';');
      const r = run([file, String(n), '--scale', '4', '--cells', cells, '--rot', '-90', '--text']);
      r.cells.forEach((s, i) => { if (s.trim()) { wk[i].أسبوع = latin(s.normalize('NFKC')).replace(/\s+/g, ' ').trim(); wk[i].rotRead = true; } });
    }
    const fp = fillPeriods(file, n, t, orig);
    cellsRead = fp.read; cellsAnchored = fp.anchored; cellsMissed = fp.missed; anchor = fp.anchor; glyph = fp.glyph;
  }
  return { t, text, cellsRead, cellsAnchored, cellsMissed, anchor, glyph, skew: tilt };
}

/* ── خانات الحصص الفارغة تقرأ ضوئيا — للصفحة الممسوحة، ولجدول الرسم الذي ارقام حصصه بخط مرمز
   (رياضيات الأدبي في الثانوي: ٣ حصص من ٢٥ ثم صفر). orig يرد الخانة من الاطار المعدل الى الصورة الاصلية
   (المسح المائل)، وهو الهوية لصفحات الرسم. ولا تعد فائتة الا خانة فيها حبر. */
function fillPeriods(file, n, t, orig = r => r, vector = false) {
  if (!POOL.has(file)) POOL.set(file, []);
  const pool = POOL.get(file);
  const [x0, x1] = t.periodsX;   /* موضع عمود الحصص صراحة — الجدول المعكوس وذو الستة */
  const rect = l => orig([x0 + 3, l.band[1] + 2, x1 - x0 - 6, l.band[0] - l.band[1] - 4]);
  let read = 0, anchored = 0, anchor = null;
  const need = [];
  for (const w of t.weeks) for (const l of w.دروس) {
    /* ⚠ في جدول الرسم لا تقرأ الا خانة فيها نص لم يقرأ رقما (رقم بخط مرمز): خانة الرسم الخالية من النص
       وفيها حبر خط او شرطة مرسومة لا رقم — عدها فائتة جعل خططا سليمة «تراجع» (العلوم، الأحياء، الجيولوجيا) */
    const raw = String(l.حصصنص || '').trim();
    if (l.حصص && +l.حصص <= 9) pool.push({ p: n, r: rect(l), v: +l.حصص, src: 'نص' });
    /* نصها شرطة او خط مكتوب: درس بلا حصص في الخطة نفسها — لا يرسل للمحرك (قرأ «-» «١» في الحادي عشر أدبي) */
    /* والشرطة باشكالها كلها («‐» «‒» «―» «−»، 2026-09-13) — احتياط عام. ⚠ لم يصلح الكيمياء ١٢: شرطة خانة «معلق» فيها تقرأ
       «١» فيزيد المجموع حصة (٤٠ والمعلن ٣٩)، ونص خانتها ليس شرطة — سببها لم يعرف بعد */
    else if (!l.حصص && raw && /^[-–—ـ_.·\s‐-―−﹘﹣－]+$/.test(raw)) l.noPeriods = true;
    /* وفي جدول الرسم: نص فيه حروف عربية فاض من عمود الدرس («في خلق») لا رقم مرمز — لا يرسل.
       الرقم المرمز يصل رموزا لا حروفا («˺» مكان ١ و«˻» مكان ٢ في رياضيات الأدبي) */
    else if (!l.حصص && l.band && (!vector || (raw && !/[ء-ي]/.test(raw)))) need.push(l);
  }
  let miss = [];
  if (need.length) {
    /* الجولة الاولى: سطر واحد بثلاث نسخ لكل خانة (الرقم المفرد يسقط في قراءة الصفحة) */
    const r = run([file, String(n), '--scale', '6', '--cells', need.map(l => fmt(n, rect(l))).join(';'), '--tile', '3']);
    r.cells.forEach((s, i) => {
      const v = cellValue(s);
      if (v) { need[i].حصص = String(v); read++; pool.push({ p: n, r: rect(need[i]), v }); }
      else if (r.dash && r.dash[i]) need[i].noPeriods = true;   /* شرطة «-»: بلا حصص في الخطة نفسها */
      else if (!r.ink || r.ink[i]) miss.push(need[i]);
    });
  }
  /* الجولة الثانية: كل خانة فائتة وحدها بين شاهدين عرفت قيمتاهما، في سطر قصير — تنوع السطر يعين المحرك
     (سطر من «١» وحدها لم يقرأ في رياضيات الثالث ص١١)، والسطر الطويل غير مستقر عنده (قرأ نصفه واسقط
     الباقي). والشاهدان حكم: لا تقبل القيمة الا ان قرئا كلاهما صحيحين. ثلاث محاولات بشواهد مختلفة. */
  if (miss.length && pool.length) {
    const refs = pickRefs(pool.filter(e => !miss.some(m => e.p === n && e.r[1] === rect(m)[1])), n);
    if (refs.length) {
      anchor = [];
      for (const m of miss) for (let a = 0; a < 3; a++) {
        const A = refs[a % refs.length], B = refs[(a + 1) % refs.length];
        const r = run([file, String(n), '--scale', '6', '--cells', [fmt(A.p, A.r), fmt(n, rect(m)), fmt(B.p, B.r)].join(';'), '--tile', '3']);
        const [va, vm, vb] = r.cells.map(cellValue);
        const honest = va === A.v && vb === B.v;
        anchor.push({ try: a + 1, expect: [A.v, '?', B.v], read: [va, vm, vb], honest });
        if (honest && vm) { m.حصص = String(vm); anchored++; break; }
      }
      miss = miss.filter(l => !l.حصص);
    }
  }
  /* الجولة الثالثة: شاهد مصطنع «٣١» يرسم قبل الخانة — ملف ارقامه كلها واحدة لا شاهد فيه (التربية الفنية:
     «٢» في كل خانة، و«٢٢٢ ٢٢٢ ٢٢٢» واضحة لا يقرؤها المحرك). لا تقبل القيمة الا ان قرئ الشاهد «٣١» تماما */
  if (miss.length) {
    for (const m of miss) {
      /* الشاهد بكلمات عربية: «٣١» وحده لم يقرأ، و«عدد الحصص ٣١» قرئ — ويقارن ما فيه من ارقام */
      const r = run([file, String(n), '--scale', '6', '--cells', fmt(n, rect(m)), '--tile', '3', '--anchor', 'عدد الحصص ٣١']);
      if (latin(r.anchor || '').replace(/[^\d]/g, '') === '31') { const v = cellValue(r.cells[0]); if (v) { m.حصص = String(v); anchored++; pool.push({ p: n, r: rect(m), v }); } }
    }
    miss = miss.filter(l => !l.حصص);
  }
  /* الجولة الرابعة — تطابق الصور (2026-09-13): المحرك لا يقرأ الرقم المفرد في خانات كثيرة («1» اللاتينية بذيلها
     ورأسها — ١٤ خانة من ٢٣ في التربية الإسلامية ١١)، والرقم المرسوم بخط واحد صورته واحدة. فتقرن خانات الصفحة بصور
     حبرها المصغرة (فرق ٦ نقاط من ١٤٠ على الاكثر): المجموعة التي اتفق ما عرف من قيمها تعطي قيمتها لما لم يقرأ منها،
     والمجموعة التي اختلفت قراءاتها توسم — والحكم بينها المجموع المعلن في batch.mjs (الصورة الواحدة لا تكون رقمين) */
  let glyph = 0;
  const cellsAll = [];
  for (const w of t.weeks) for (const l of w.دروس) if (l.band && !l.noPeriods) cellsAll.push(l);
  /* ولو خانة واحدة: المخزن من صفحات الملف السابقة يكفيها (كان الشرط ثلاثا فلم تدخل صفحات المواد الحرة البتة — بها خانتان) */
  if (cellsAll.length) {
    const r = run([file, String(n), '--scale', '6', '--cells', cellsAll.map(l => fmt(n, rect(l))).join(';'), '--tile', '1']);
    const sig = r.sig || [], ham = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d; };
    const groups = [];
    cellsAll.forEach((l, i) => { const s = sig[i]; if (!s || !s.includes('1')) return; const g = groups.find(g => ham(g.s, s) <= 6); if (g) g.m.push(l); else groups.push({ s, m: [l] }); });
    if (!GLYPHS.has(file)) GLYPHS.set(file, []);
    const store = GLYPHS.get(file);
    /* ما عرف في الصفحة يضاف الى المخزن بعد الحكم فيها — والمملوء بالتطابق لا يضاف، فلا يبنى تخمين على تخمين */
    const known = cellsAll.map((l, i) => l.حصص && sig[i] ? { s: sig[i], v: +l.حصص } : null).filter(Boolean);
    groups.forEach((g, k) => {
      const vals = [...new Set([...g.m.filter(l => l.حصص).map(l => +l.حصص), ...store.filter(e => ham(e.s, g.s) <= 6).map(e => e.v)])];
      if (vals.length === 1) g.m.forEach(l => { if (!l.حصص) { l.حصص = String(vals[0]); l.glyph = true; glyph++; } });
      else if (vals.length > 1) g.m.forEach(l => { l.glyphGroup = file.split('/').pop() + ':' + n + ':' + k; l.glyphVals = vals; });
    });
    miss = miss.filter(l => !l.حصص);
    store.push(...known);
  }
  return { read: read + anchored + glyph, anchored, glyph, missed: miss.length, anchor };
}
/* لجدول قرئ من رسم الملف وبقيت خانات حصصه فارغة */
export function fillVectorPeriods(file, n, t, { cache } = {}) {
  if (cache) CACHE = cache;
  return fillPeriods(file, n, t, undefined, true);
}

/* خانة الاسبوع في جدول الرسم ونصها لا يقرأ (تواريخ مبعثرة «29 / 0 1 / 2026» — إنجليزي الابتدائي): تقرأ
   الخانة ضوئيا مدارة في الاتجاهين وبلا ادارة، ويؤخذ ما فيه تاريخ كامل او ترتيبي. تعيد عدد ما قرئ */
export function readWeekCells(file, n, t, weeks, { cache } = {}) {
  if (cache) CACHE = cache;
  if (!weeks.length) return 0;
  const cells = weeks.map(w => [t.weekX[0] + 2, w.band[1] + 2, t.weekX[1] - t.weekX[0] - 4, w.band[0] - w.band[1] - 4].map(v => v.toFixed(1)).join(',')).join(';');
  const reads = ['-90', '90', '0'].map(rot => run([file, String(n), '--scale', '4', '--cells', cells, '--rot', rot, '--text']).cells);
  const score = s => (latin(s).match(/\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*20\d\d|20\d\d\s*\/\s*\d{1,2}\s*\/\s*\d{1,2}/g) || []).length * 2
    + (/الأول|الاول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر|عشر/.test(s) ? 1 : 0);
  let got = 0;
  weeks.forEach((w, i) => {
    const best = reads.map(r => r[i] || '').sort((a, b) => score(b) - score(a))[0];
    if (score(best) > 0) { w.أسبوع = latin(best.normalize('NFKC')).replace(/\s+/g, ' ').trim(); w.rotRead = true; got++; }
  });
  return got;
}
