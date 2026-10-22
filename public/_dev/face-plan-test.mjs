// اختبار «هذا الاسبوع في المنهج» في واجهة الشعبة — node public/_dev/face-plan-test.mjs (2026-10-22)
// يحمل refdata.js وderive.js وface-data.js في سياق معزول بشعبة رياضيات ثانوية وخطط ملف المختبر، ويفحص:
// بلا خطة لا قسم · المادة بلا خطة لا تذكر · لا شيء عن الانجاز في النسخة · اسبوع الزائر من تاريخه · ومفتاح الاخفاء.
import fs from 'fs';
import vm from 'vm';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const PLANS = JSON.parse(fs.readFileSync(path.join(ROOT, '..', 'plans', 'plans-2026-2027-t1.json'), 'utf8'));

const SEC = {
  stage: 'ثانوي', department: 'الرياضيات', schoolType: 'بنين', year: '٢٠٢٦/٢٠٢٧', term: 'الفصل الأول', teachers: ['فهد المطيري', 'خالد العنزي', 'ناصر العجمي'],
  schedules: {
    'فهد المطيري': { 'الأحد': ['10/2 · الرياضيات', '', '11/1 · الرياضيات'] },
    'خالد العنزي': { 'الأحد': ['10/4 · الرياضيات'], 'الثلاثاء': ['11/3 · الإحصاء'] },
    'ناصر العجمي': { 'الأربعاء': ['12/1 · الفلك'] }   /* مادة بلا خطة معتمدة */
  }
};
const store = { 'shouba.setup': JSON.stringify(SEC) };
const c = { console, setTimeout, clearTimeout, Date, JSON, Math,
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } };
c.window = c;
vm.createContext(c);
['refdata.js', 'derive.js', 'face-data.js'].forEach(f => vm.runInContext(read(f), c, { filename: f }));
const S = c.Shouba, F = c.ShoubaFace;
const data = { calendar: PLANS.calendar,
  plans: PLANS.plans.filter(p => p.stageId === '17' && p.status === 'ok').map(p => ({ key: p.key, grade: p.grade, subject: p.subject, source: p.source, weeks: p.weeks })) };

let pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? '— ' + JSON.stringify(extra) : ''); } };

// ١) بلا خطة: لا قسم
ok(F.planPack(data.calendar, [], S.planLessons) === null, 'بلا مواد: لا قسم');
ok(F.planPack(data.calendar, S.planLinks({ calendar: data.calendar, plans: [] }).pairs, S.planLessons) === null, 'بلا خطط معتمدة: لا قسم');
ok(F.planPack([], S.planLinks(data).pairs, S.planLessons) === null, 'بلا تقويم: لا قسم');
const base = { doc: SEC, roster: SEC.teachers, times: [], days: [], today: '2026-10-22' };
ok(F.snapshot(base).plan === null, 'النسخة بلا خطة: plan فارغ');

// ٢) المادة بلا خطة لا تذكر، ولا شيء عن الانجاز
const pack = F.planPack(data.calendar, S.planLinks(data).pairs, S.planLessons);
ok(pack && pack.rows.map(r => r.name + '·' + r.grade).join(' | ') === 'الرياضيات·العاشر | الإحصاء·الحادي عشر | الرياضيات·الحادي عشر',
  'سطر لكل مادة لها خطة — والفلك (بلا خطة) لا يذكر', pack && pack.rows.map(r => r.name + '·' + r.grade));
ok(!JSON.stringify(pack).includes('الفلك'), 'ولا اثر للمادة بلا خطة في النسخة');
ok(pack.rows.every(r => Object.keys(r).sort().join() === 'grade,name,w')
  && pack.rows.every(r => Object.values(r.w).every(ls => ls.every(l => Object.keys(l).sort().join() === 'p,t'))),
  'السطر: اسمه وصفه ودروس اسابيعه (عنوان وحصص) وحدها');
ok(Object.keys(pack).sort().join() === 'rows,weeks' && pack.weeks.every(w => Object.keys(w).sort().join() === 'from,n,to'),
  'القسم: الاسابيع بتواريخها والسطور — لا نسبة ولا ما قطع ولا «يجب رفع الخطة»');
ok(!/pct|percent|done|missing|unpicked|choose|behind|ahead|pace|teachers|classes|source|key/i.test(JSON.stringify(Object.keys(pack)) + JSON.stringify(pack.rows.map(r => Object.keys(r)))),
  'ولا حقل من حقول المتابعة');
const r10 = pack.rows[0], lw = S.planLessons(S.planLinks(data).pairs[0].plan, 5);
ok(JSON.stringify(r10.w[5]) === JSON.stringify(lw), 'دروس الاسبوع كما في شريط اللوحة (planLessons)', r10.w[5]);
const bytes = Buffer.byteLength(JSON.stringify(pack));
ok(bytes < 64 * 1024, 'حجمه صغير (' + bytes + ' بايت لثلاث مواد في ١٦ اسبوعا)');

// ٣) اسبوع الزائر من تاريخه
const at = d => { const P = F.planNow(pack, d); return P ? P.n : 0; };
ok(at('2026-10-11') === 5 && at('2026-10-15') === 5, 'الاحد والخميس: اسبوعهما (الخامس)');
ok(at('2026-10-16') === 5 && at('2026-10-17') === 5 && at('2026-10-18') === 6, 'الجمعة والسبت للاسبوع الذي مضى، والاحد التالي السادس');
ok(at('2026-09-01') === 0 && at('2026-09-12') === 0 && at('2026-09-13') === 1, 'قبل الفصل: لا قسم — ويظهر من احده الاول');
const last = pack.weeks[pack.weeks.length - 1];
ok(at(F.addDays(last.to, 2)) === last.n && at(F.addDays(last.to, 3)) === 0, 'بعد آخر اسبوع: لا قسم');
const gap = Object.assign({}, pack, { weeks: pack.weeks.filter(w => w.n !== 7) });
ok(F.planNow(gap, '2026-10-27') === null, 'اسبوع ليس في التقويم (عطلة): لا قسم');
const P5 = F.planNow(pack, '2026-10-14');
ok(P5.from === '2026-10-11' && P5.to === '2026-10-15' && P5.rows.length === 3
  && P5.rows[0].per === P5.rows[0].lessons.reduce((a, l) => a + l.p, 0), 'وفيه تواريخه وسطوره بحصصها', P5);
const only = { weeks: pack.weeks, rows: [{ name: 'س', grade: 'العاشر', w: { 3: [{ t: 'درس', p: 2 }] } }] };
ok(F.planNow(only, '2026-10-14') === null && F.planNow(only, '2026-09-29').rows.length === 1, 'اسبوع بلا دروس لاي مادة: لا قسم');
const part = { weeks: pack.weeks, rows: [only.rows[0], { name: 'ص', grade: 'العاشر', w: { 5: [{ t: 'د', p: 1 }] } }] };
ok(F.planNow(part, '2026-10-14').rows.map(r => r.name).join() === 'ص', 'والمادة بلا دروس في الاسبوع لا تظهر فيه');

// ٣ب) شريط الاسابيع (2026-10-22): اسابيع الفصل متصلة من الاول الى آخر اسبوع فيه دروس، والزائر يختار اسبوعا
ok(pack.weeks.map(w => w.n).join() === Array.from({ length: pack.weeks.length }, (_, i) => i + 1).join(), 'الاسابيع متصلة من الاول', pack.weeks.map(w => w.n));
ok(pack.weeks.length === Math.max(...pack.rows.flatMap(r => Object.keys(r.w).map(Number))), 'وتنتهي بآخر اسبوع فيه دروس');
const W8 = F.planWeek(pack, 8);
ok(W8 && W8.n === 8 && W8.from === '2026-11-01' && W8.rows.every(r => r.lessons.length), 'planWeek: الاسبوع المختار بتواريخه وسطوره ذات الدروس', W8);
ok(F.planWeek(only, 5).rows.length === 0 && F.planWeek(only, 99) === null, 'اسبوع بلا دروس: سطور فارغة · واسبوع ليس في النسخة: null');
ok(F.planWeek(JSON.parse(JSON.stringify(pack)), '8').n === 8, 'ويقبل رقم الاسبوع نصا');

// ٤) في النسخة ومفتاح الاخفاء
const snap = F.snapshot(Object.assign({}, base, { plan: pack }));
ok(snap.plan === pack, 'النسخة تحمل القسم ظاهرا افتراضا');
ok(F.snapshot(Object.assign({}, base, { plan: pack, doc: Object.assign({}, SEC, { face: { plan: false } }) })).plan === null,
  'face.plan = false: لا قسم في النسخة');
ok(F.snapshot(Object.assign({}, base, { plan: { weeks: [], rows: [] } })).plan === null, 'قسم بلا سطور: لا قسم');
const rt = JSON.parse(JSON.stringify(snap));
ok(F.planNow(rt.plan, '2026-10-14').n === 5, 'ويعمل بعد ارساله نصا (مفاتيح الاسابيع نصوص)');

// ٥) عنوان الدرس للعرض (معاينة السلوك 2026-10-22): علامات المصدر تحذف في الواجهة، وملف الخطط كما هو
const T = F.planTitle;
[
  ['4-الاتجاه البرجماتي · * جون ديوي', '4. الاتجاه البرجماتي · جون ديوي'],
  ['*برتراند رسل', 'برتراند رسل'],
  ['▪ Make arrangements and plans.', 'Make arrangements and plans.'],
  ['(القوة والتحمل). •', '(القوة والتحمل).'],
  ['1- ربنا الله تعالى', '1. ربنا الله تعالى'],
  ['1 - فقه الوضوء', '1. فقه الوضوء'],
  ['3 -تمايز مكونات الأرض.', '3. تمايز مكونات الأرض.'],
  ['1 .البناء الداخلي للبلورات', '1. البناء الداخلي للبلورات'],
  ['2.المعادن السيليكاتية', '2. المعادن السيليكاتية'],
  ['تابع)3-2( · تشابه المثلثات', 'تابع (3-2) · تشابه المثلثات'],
  ['تابع )1-2( · التناسب', 'تابع (1-2) · التناسب'],
  ['8 - محمد -*- المثل الأعلى للمعلم والمربي.', '8. محمد — المثل الأعلى للمعلم والمربي.'],
  ['8. محمد -*- المثل الأعلى للمعلم والمربي.', '8. محمد — المثل الأعلى للمعلم والمربي.'],
  ['دراسة السكتات ص 4 - 2 -*- ) 13', 'دراسة السكتات ص 4 - 2 — ) 13'],
  ['الدرس * التالي', 'الدرس — التالي']
].forEach(([a, b]) => ok(T(a) === b, 'ينظف: ' + a, T(a)));
[
  '2-1 الأفلاك المهجنة', '6-2) ضرب عدد مكون رمزه من رقمين في اخر', 'تابع)5 -(3', '( ١ - ١ ) الأعداد',
  'الأسبوع التمهيدي', '8. محمد — المثل الأعلى للمعلم والمربي.', 'أ **مهم** ب', '2-1 · 3-2 الدرس'
].forEach(a => ok(T(a) === a, 'يبقى كما هو: ' + a, T(a)));
ok(T('* · •') === '' && T('  الدرس   الأول  ') === 'الدرس الأول', 'المقطع الفارغ يسقط والمسافات تضم');
const allT = [...new Set(PLANS.plans.flatMap(p => (p.weeks || []).flatMap(w => (w.lessons || []).map(l => l.t))))];
ok(allT.every(t => T(T(t)) === T(t)), 'التنظيف ثابت: اعادته لا تغير شيئا (' + allT.length + ' عنوانا)');
ok(allT.every(t => !/^[*•▪]|[*•▪]$/.test(T(t)) && T(t).split(' · ').every(x => !/^[*•▪\s]|[*•▪\s]$/.test(x))), 'ولا علامة في اول مقطع ولا آخره');
ok(allT.every(t => T(t).replace(/[^0-9٠-٩]/g, '') === t.replace(/[^0-9٠-٩]/g, '')), 'والارقام كلها باقية بترتيبها');
ok(allT.every(t => !/(^|[^*])\*(?!\*)/.test(T(t))), 'ولا نجمة وحيدة داخل مقطع (تصير « — »)');
ok(allT.filter(t => /-\*-/.test(t)).every(t => T(t).includes(' — ') && !T(t).includes('-*-')), 'و«-*-» فاصل « — »');
const raw = { weeks: [{ n: 5, from: '2026-10-11', to: '2026-10-15' }], rows: [{ name: 'الفلسفة', grade: 'الثاني عشر', w: { 5: [{ t: '4-الاتجاه البرجماتي · * جون ديوي', p: 2 }, { t: '* · •', p: 1 }] } }] };
const PN = F.planNow(raw, '2026-10-12');
ok(PN.rows[0].lessons.length === 1 && PN.rows[0].lessons[0].t === '4. الاتجاه البرجماتي · جون ديوي' && PN.rows[0].per === 2,
  'planNow يعرض العنوان المنظف — ولو نشرت النسخة قبل التنظيف', PN.rows[0]);
ok(raw.rows[0].w[5][0].t === '4-الاتجاه البرجماتي · * جون ديوي', 'ولا يمس النسخة نفسها');
ok(JSON.stringify(pack.rows[0].w[5]) === JSON.stringify(lw), 'وplanPack ينقل نص الخطة كما هو (التنظيف عند العرض وحده)');

// ٦) فتح السطر: الملخص وحصصه يخفيان فلا يتكرران فوق القائمة (face.css)
const css = read('face.css');
ok(/\.ptr\.open \.ls,\s*\.face-pub \.ptr\.open \.pp\{visibility:hidden\}/.test(css), 'السطر المفتوح يخفي ملخصه وحصصه');
ok(!/\.ptr\.open \.(who|chev)\{[^}]*(visibility:hidden|display:none)/.test(css), 'والمادة والسهم باقيان');

console.log(`\n${fail ? '✗' : '✓'} ${pass} سليم · ${fail} معيب`);
process.exit(fail ? 1 : 0);
