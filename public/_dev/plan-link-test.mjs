// اختبار ربط مواد الشعبة بخططها — node public/_dev/plan-link-test.mjs (2026-09-13، الخطوة ج)
// يحمل refdata.js ثم derive.js في سياق معزول بمخزن مؤقت (كاختبار المحرك)، بشعبة رياضيات ثانوية وجدول
// حقيقي الشكل، وخطط ملف المختبر plans/plans-2026-2027-t1.json والسليمة منها معتمدة. ويفحص: صف الفصل من
// رقمه · ازواج المادة والصف من الجداول (ولا تمسها) · خطة كل زوج · «يجب رفع الخطة» · الاسبوع من التقويم · بنين/بنات.
import fs from 'fs';
import vm from 'vm';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const PLANS = JSON.parse(fs.readFileSync(path.join(ROOT, '..', 'plans', 'plans-2026-2027-t1.json'), 'utf8'));

function world(data) {
  const store = { 'shouba.setup': JSON.stringify(data) };
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const c = { console, localStorage: ls, setTimeout, clearTimeout, Date, JSON, Math };
  c.window = c;
  vm.createContext(c);
  vm.runInContext(read('refdata.js'), c, { filename: 'refdata.js' });
  vm.runInContext(read('derive.js'), c, { filename: 'derive.js' });
  return c;
}
/* الخطط كما يعيدها الخادم لرئيس شعبة ثانوية: المعتمد لمرحلته (هنا السليمة) */
function served(stageId) {
  return { stage: 'x', v: 't', set: { id: '2026-2027-t1' }, calendar: PLANS.calendar,
    plans: PLANS.plans.filter(p => p.stageId === stageId && p.status === 'ok').map(p => ({ key: p.key, grade: p.grade, subject: p.subject, source: p.source, weeks: p.weeks })) };
}

let pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? '— ' + JSON.stringify(extra) : ''); } };

const SEC = {
  stage: 'ثانوي', department: 'الرياضيات', schoolType: 'بنين', year: '٢٠٢٦/٢٠٢٧', term: 'الفصل الأول', teachers: ['فهد المطيري', 'خالد العنزي', 'ناصر العجمي'],
  schedules: {
    'فهد المطيري': { 'الأحد': ['10/2 · الرياضيات', '', '11/1 · الرياضيات'], 'الاثنين': ['', '١٢/٣ · الرياضيات'] },
    'خالد العنزي': { 'الأحد': ['10/4 · الرياضيات'], 'الثلاثاء': ['11/3 · الإحصاء'] },
    'ناصر العجمي': { 'الأربعاء': ['12/1 · الفلك'] }   /* مادة بلا خطة معتمدة */
  }
};
const W = world(SEC), S = W.Shouba, data = served('17');
const before = JSON.stringify(W.Shouba.data().schedules);

ok(S.gradeOfClass('10/2') === 'العاشر' && S.gradeOfClass('11/1') === 'الحادي عشر' && S.gradeOfClass('١٢/٣') === 'الثاني عشر' && S.gradeOfClass('9/1') === '',
   'صف الفصل من رقمه (والارقام الهندية) — ورقم خارج المرحلة لا صف له');
const pairs = S.planPairs();
ok(pairs.map(p => p.subject + '·' + p.grade).join(' | ') === 'الرياضيات·العاشر | الإحصاء·الحادي عشر | الرياضيات·الحادي عشر | الرياضيات·الثاني عشر | الفلك·الثاني عشر',
   'ازواج المادة والصف من الجداول، بترتيب الصفوف ثم المواد', pairs.map(p => p.subject + '·' + p.grade));
ok(pairs[0].classes.join(',') === '10/2,10/4' && pairs[0].teachers.join(',') === 'فهد المطيري,خالد العنزي', 'لكل زوج فصوله ومعلموه', pairs[0]);
ok(JSON.stringify(W.Shouba.data().schedules) === before && !('خالد العنزي' in W.Shouba.data().schedules && W.Shouba.data().schedules['خالد العنزي']['الخميس']), 'الازواج تقرأ الجداول ولا تمسها');

const L = S.planLinks(data, new Date(2026, 9, 14));
const got = Object.fromEntries(L.pairs.map(p => [p.subject + '·' + p.grade, p.plan && p.plan.subject + '·' + p.plan.grade]));
ok(got['الرياضيات·العاشر'] === 'الرياضيات·العاشر' && got['الرياضيات·الحادي عشر'] === 'الرياضيات·الحادي عشر' && got['الإحصاء·الحادي عشر'] === 'الإحصاء·الحادي عشر'
   && got['الرياضيات·الثاني عشر'] === 'الرياضيات·الثاني عشر', 'لكل زوج خطته المعتمدة بالمادة والصف', got);
ok(L.missing.length === 1 && L.missing[0].subject === 'الفلك', 'المادة بلا خطة معتمدة وحدها في «يجب رفع الخطة»', L.missing.map(p => p.subject));
ok(L.ready === true && L.week && L.week.n === 5 && L.week.from === '2026-10-11', 'الاسبوع من التقويم: ١٤ أكتوبر في الخامس (١١ أكتوبر)', L.week);
ok(S.planWeek(PLANS.calendar, new Date(2026, 8, 13)).n === 1 && S.planWeek(PLANS.calendar, new Date(2026, 8, 19)).n === 1
   && S.planWeek(PLANS.calendar, new Date(2026, 8, 20)).n === 2, 'الاحد ١٣ سبتمبر اول الاسبوع الاول، والسبت بعده منه، والاحد التالي الثاني');
ok(S.planWeek(PLANS.calendar, new Date(2026, 8, 1)).n === 0, 'قبل بدء الفصل: الاسبوع صفر');
ok(S.planWeek([], new Date()) === null && S.planWeek(null) === null, 'بلا تقويم: لا اسبوع (والشاشة ترجع الى تاريخ رئيس الشعبة)');

const none = S.planLinks(null, new Date(2026, 9, 14));
ok(none.ready === false && none.missing.length === 0 && none.pairs.length === 5 && none.pairs.every(p => p.plan === null),
   'قبل جلب الخطط: لا «يجب رفع الخطة» ظلما — الازواج بلا حكم');

/* بنين وبنات: خطتان للزوج الواحد، ونوع المدرسة يختار */
const twin = [{ grade: 'السابع', subject: 'الدراسات العلمية الديكور', source: { desc: 'خطة توزيع المنهج - 2026 -2027 - ( بنات )' }, weeks: [] },
              { grade: 'السابع', subject: 'الدراسات العلمية الديكور', source: { desc: 'خطة توزيع المنهج - 2026 -2027 - ( بنين )' }, weeks: [] }];
const Wb = world({ stage: 'متوسط', schoolType: 'بنين', schedules: {} }), Wg = world({ stage: 'متوسط', schoolType: 'بنات', schedules: {} });
const pr = { subject: 'الدراسات العلمية الديكور', grade: 'السابع' };
ok(/بنين/.test(Wb.Shouba.planFor(pr, twin).source.desc) && /بنات/.test(Wg.Shouba.planFor(pr, twin).source.desc), 'بين خطتي البنين والبنات نوع المدرسة يختار');
ok(Wb.Shouba.planFor({ subject: 'التربية البدنية', grade: 'السابع' }, [{ grade: 'السابع', subject: 'التربية البدنية- بنين', weeks: [] }]).subject === 'التربية البدنية- بنين',
   'المادة بالبادئة حين لا تامة («التربية البدنية» ⟵ «التربية البدنية- بنين»)');

/* ما قطع من المنهج (الخطوة هـ): الدروس مسطحة · الحكم المقترح · مواد المعلم */
const math10 = data.plans.find(p => p.subject === 'الرياضيات' && p.grade === 'العاشر');
const F = S.planFlat(math10);
ok(F.length > 0 && F[0].n === 1 && F.every((l, i) => !i || l.n >= F[i - 1].n), 'دروس الخطة مسطحة بترتيب اسابيعها', F.slice(0, 3));
const spanPlan = { weeks: [{ n: 5, lessons: [{ t: 'د', p: 4 }] }, { n: 1, lessons: [{ t: 'أ', p: 2 }, { t: 'أ', p: 2 }, { t: 'ب', p: 1 }] }, { n: 2, span: 3, lessons: [{ t: 'ج', p: 4 }] }] };
const SF = S.planFlat(spanPlan);
ok(SF.map(l => l.t + l.p + ':' + l.n + '-' + l.end).join(' ') === 'أ4:1-1 ب1:1-1 ج4:2-4 د4:5-5', 'المكرر في اسبوعه مدموج بحصصه، والممتد درس واحد بمداه، والترتيب بالاسبوع', SF);
ok(S.paceOf(SF[3], 3) === 'ahead' && S.paceOf(SF[2], 4) === 'match' && S.paceOf(SF[2], 5) === 'match' && S.paceOf(SF[2], 6) === 'behind'
   && S.paceOf(SF[1], 2) === 'match' && S.paceOf(SF[0], 3) === 'behind', 'الحكم المقترح: متقدم بعد الجاري · مطابق فيه او قبله باسبوع · متأخر قبل ذلك');
ok(S.paceOf(SF[0], 0) === 'match' && S.paceOf(SF[2], 0) === 'ahead' && S.paceOf(null, 3) === '', 'قبل بدء الفصل يقاس بالاسبوع الاول، وبلا درس لا حكم');
const fp = S.planPairsOf('فهد المطيري', data, new Date(2026, 9, 14));
ok(fp.ready && fp.week.n === 5 && fp.pairs.map(p => p.grade).join(',') === 'العاشر,الحادي عشر,الثاني عشر' && fp.pairs.every(p => p.plan),
   'مواد المعلم وصفوفه بخططها — من جدوله وحده', fp.pairs.map(p => p.grade));
ok(S.planPairsOf('ناصر العجمي', data).pairs.every(p => !p.plan) && S.planPairsOf('غير موجود', data).pairs.length === 0,
   'مادة بلا خطة تبقى بلا خطة، ومن لا جدول له لا مواد له');

console.log('\n' + (fail ? '✗' : '✓') + ' ' + pass + ' سليم · ' + fail + ' معيب');
process.exit(fail ? 1 : 0);
