// اختبار حقائق واجهة الشعبة — node public/_dev/face-data-test.mjs (2026-10-20)
// يحمل face-data.js في سياق معزول ويفحص: نهاية خانة الاسبوع · حال الفعالية ومتى يلزم تأكيدها ·
// الحصة الجارية بساعة الزائر · ما يدخل النسخة المنشورة وما لا يدخلها · ما يراه الزائر · وعامل الخدمة يترك الواجهة.
import fs from 'fs';
import vm from 'vm';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const c = { console, Date, JSON, Math };
c.window = c;
vm.createContext(c);
vm.runInContext(read('face-data.js'), c, { filename: 'face-data.js' });
vm.runInContext(read('refdata.js'), c, { filename: 'refdata.js' });
const F = c.ShoubaFace, REF = c.SHOUBA_REF;

let pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? '— ' + JSON.stringify(extra) : ''); } };

// ١) خانة الاسبوع: من الاحد الى الخميس حتى سبت الاسبوع · الجمعة والسبت للاسبوع القادم
ok(F.weekEnd('2026-10-18') === '2026-10-24', 'الاحد: حتى السبت نفسه');
ok(F.weekEnd('2026-10-22') === '2026-10-24', 'الخميس: حتى السبت بعده');
ok(F.weekEnd('2026-10-23') === '2026-10-31', 'الجمعة: للاسبوع القادم');
ok(F.weekEnd('2026-10-24') === '2026-10-31', 'السبت: للاسبوع القادم');
const wk = { kind: 'quote', text: 'العلم نور', to: '2026-10-24' };
ok(F.weekLive(wk, '2026-10-24') && !F.weekLive(wk, '2026-10-25'), 'تختفي وحدها بانتهاء اسبوعها');
ok(!F.weekFilled({ kind: 'teacher', text: 'سبب', who: '' }), 'معلم الاسبوع بلا اسم: لا تظهر');
ok(F.weekFilled({ kind: 'teacher', text: '', who: 'فيصل' }), 'معلم الاسبوع باسمه وحده: تظهر');
ok(!F.weekFilled({ kind: 'nope', text: 'x' }), 'نوع خارج الثلاثة: لا تظهر');
const PH = { file: 'f' + 'c'.repeat(24), mime: 'image/jpeg' };
ok(F.weekPhoto({ kind: 'teacher', who: 'فيصل', photo: PH }) === PH.file && F.weekPhoto({ kind: 'feat', text: 'x', photo: PH }) === PH.file,
  'صورة الخانة لمعلم الاسبوع وانجازه');
ok(F.weekPhoto({ kind: 'quote', text: 'x', photo: PH }) === '', 'والعبارة التحفيزية بلا صورة');
ok(F.weekPhoto({ kind: 'teacher', who: 'فيصل', photo: { file: PH.file, mime: 'application/pdf' } }) === '', 'وPDF لا ينشر صورة');

// ٢) حال الفعالية
const T = '2026-10-20';
ok(F.status({ date: '2026-10-25', created: '2026-10-01' }, T) === 'soon', 'لم يأت يومها: قادمة');
ok(F.status({ date: '2026-10-20', created: '2026-10-01' }, T) === 'soon', 'يومها اليوم: قادمة');
ok(F.status({ date: '2026-10-10', created: '2026-10-01' }, T) === 'wait', 'مخطط لها ومضى يومها بلا تأكيد: بانتظار التأكيد');
ok(F.status({ date: '2026-10-10', created: '2026-10-01', done: true }, T) === 'done', 'وبتأكيدها: تمّت');
ok(F.status({ date: '2026-10-10', created: '2026-10-12' }, T) === 'done', 'كتب تقريرها بعد يومها: تمّت بلا سؤال');
ok(F.localDay('2026-10-19T22:30:00.000Z') === F.iso(new Date('2026-10-19T22:30:00.000Z')), 'يوم الانشاء بتوقيت الجهاز لا UTC');

// ٣) الفعاليات من السجل: الاخفاء لا يمس السجل، والصور وحدها
const rec = (id, title, date, created, extra) => ({ id, tpl: 'events', created, values: Object.assign({
  meta: { title, date, who: ['@all', 'فيصل'] }, body: { about: 'نبذة' },
  shots: { items: [{ file: 'f' + 'a'.repeat(24), mime: 'image/jpeg' }, { file: 'f' + 'b'.repeat(24), mime: 'application/pdf' }] } }, extra || {}) });
const recs = [
  rec('r1', 'ملتقى', '2026-10-25', '2026-10-01T08:00:00Z'),
  rec('r2', 'ركن التوعية', '2026-10-10', '2026-10-01T08:00:00Z'),
  rec('r3', 'لجنة', '2026-10-05', '2026-10-06T08:00:00Z'),
  rec('r4', 'مخفية', '2026-10-04', '2026-10-06T08:00:00Z'),
  rec('r5', '', '2026-10-04', '2026-10-06T08:00:00Z')
];
const groups = {}; REF.whoGroups.forEach(g => { groups[g.id] = g.t; });
const face = { hide: ['r4'], done: [], own: [
  { id: 'w1', title: 'زيارة الموجه', date: '2026-10-28', note: 'للواجهة', created: '2026-10-19', done: false },
  { id: 'w2', title: 'معرض قديم', date: '2026-10-12', note: '', created: '2026-10-01', done: false }
] };
const list = F.events(face, recs, T, groups);
ok(list.length === 6, 'بلا عنوان لا تذكر', list.map(e => e.title));
const byId = id => list.filter(e => e.id === id)[0];
ok(byId('r4').hidden && byId('r4').status === 'done', 'المخفية تبقى في القائمة بحالها');
ok(byId('r1').photos.length === 1, 'الصور وحدها — لا PDF', byId('r1').photos);
ok(byId('r1').who[0] === 'معلمو الشعبة', 'المجموعة باسمها لا برمزها', byId('r1').who);
ok(byId('r2').status === 'wait' && byId('w2').status === 'wait', 'الماضية بلا تأكيد من السجل ومن الواجهة');

// ٤) النسخة المنشورة: لا يدخلها مخفي ولا منتظر، والجدول لمن له جدول
const doc = {
  department: 'علم النفس والفلسفة', schoolName: 'ثانوية', year: '2026 / 2027', term: 'الفصل الأول', face,
  crest: { type: 'icon', id: 'book' },
  schedules: {
    'محمد البراك': { 'الأحد': ['12/1 ع · فلسفة', '', '12/2 د · فلسفة'] },
    'فيصل': { 'الأحد': ['', '11/1 ع · علم نفس'], 'الاثنين': ['11/2 د · علم نفس'] },
    'بدر': { 'الأحد': ['', '', ''] }
  }
};
const times = REF.periodTimes['ثانوي'];
const snap = F.snapshot({ doc, self: 'محمد البراك', roster: ['محمد البراك', 'فيصل', 'بدر'], times, days: REF.days, today: T, groups, recs, meetings: 3 });
ok(snap.people.length === 2 && snap.people.every(p => p.name !== 'بدر'), 'من لا جدول له لا يذكر', snap.people.map(p => p.name));
ok(snap.people[0].wk['الأحد'].length === times.filter(t => !t.brk).length, 'ايام الجدول بطول الحصص');
ok(snap.people[1].subj === 'علم نفس', 'المادة الغالبة من الجدول');
ok(snap.events.map(e => e.title).join('|') === 'لجنة|ملتقى|زيارة الموجه', 'لا مخفية ولا منتظرة في النسخة', snap.events.map(e => e.title));
ok(snap.events.every(e => !('id' in e) && !('hidden' in e)), 'ولا معرفات السجلات');
ok(snap.crest && snap.crest.icon === 'book' && !snap.crest.svg, 'الشعار معرف رمز لا SVG نص');
ok(F.snapshot({ doc: Object.assign({}, doc, { crest: { type: 'image', data: 'javascript:x' } }), roster: [], times, days: REF.days, today: T }).crest === null,
  'صورة شعار ليست data:image لا تنشر');
ok(snap.week === null, 'خانة فارغة لا تنشر');
const snapW = F.snapshot({ doc: Object.assign({}, doc, { face: { week: { kind: 'teacher', who: 'فيصل', text: '', to: '2026-10-24', photo: PH } } }),
  self: 'محمد البراك', roster: [], times, days: REF.days, today: T });
ok(snapW.week && snapW.week.photo === PH.file, 'معرف صورة الخانة في النسخة — فيلتقطه face.js ويفتح بابها');
ok(snap.stats.meetings === 3, 'عدد الاجتماعات في الحصيلة');

// ٥) ما يراه الزائر: بساعته هو
const v1 = F.visible(snap, T);
ok(v1.soon.map(e => e.title).join('|') === 'ملتقى|زيارة الموجه' && v1.done.map(e => e.title).join('|') === 'لجنة', 'قادمة بالاقرب · تمّت', v1);
const v2 = F.visible(snap, '2026-10-26');
ok(v2.soon.map(e => e.title).join('|') === 'زيارة الموجه', 'مضى يومها ولم تؤكد: تختفي عند الزائر', v2.soon.map(e => e.title));
ok(F.visible({ week: wk }, '2026-10-25').week === null, 'والخانة تختفي عنده بانتهاء اسبوعها');

// ٦) الحصة الجارية بساعة الزائر (الثانوي)
const at = (day, hm) => { const [h, m] = hm.split(':').map(Number); return new Date(2026, 9, 18 + day, h, m); };   // ١٨ اكتوبر احد
const p1 = times.filter(t => !t.brk)[0];
const [h1, m1] = p1.from.split(':').map(Number);
const inP1 = `${String(h1).padStart(2, '0')}:${String(m1 + 5).padStart(2, '0')}`;
let st = F.now(times, REF.days, at(0, inP1));
ok(st.state === 'period' && st.n === 1 && st.day === 'الأحد', 'في الحصة الاولى', st);
ok(F.now(times, REF.days, at(0, '05:00')).state === 'before', 'قبل الدوام');
ok(F.now(times, REF.days, at(0, '23:00')).state === 'after', 'بعد الدوام');
ok(F.now(times, REF.days, at(5, '09:00')).state === 'off', 'الجمعة: لا دوام');
const brk = times.filter(t => t.brk && t.duty)[0];
st = F.now(times, REF.days, at(1, brk.from));
ok(st.state === 'break' && st.label === brk.label && st.next > 0 && st.day === 'الاثنين', 'في الفرصة وتليها حصة', st);

// ٧) عامل الخدمة يترك الواجهة ولا يخزنها
function swHandles(url) {
  const handlers = {};
  const ctx = { self: { addEventListener: (k, f) => { handlers[k] = f; }, skipWaiting() {}, clients: { claim() {} } },
    caches: {}, location: { origin: 'http://x' }, URL, Promise, fetch: () => Promise.resolve() };
  ctx.self.location = ctx.location;
  vm.createContext(ctx);
  vm.runInContext(read('sw.js').replace(/self\.addEventListener/g, 'self.addEventListener'), ctx, { filename: 'sw.js' });
  let responded = false;
  handlers.fetch({ request: { method: 'GET', url, mode: 'navigate', headers: { get: () => 'text/html' } }, respondWith() { responded = true; } });
  return responded;
}
ok(!swHandles('http://x/face/0123456789'), 'عامل الخدمة: صفحة الزائر من الشبكة وحدها');
ok(!swHandles('http://x/face.html?preview=1') && !swHandles('http://x/face-admin.html'), 'عامل الخدمة: المعاينة وشاشة الادارة كذلك');
ok(swHandles('http://x/board.html'), 'وبقية الصفحات كما كانت');

console.log(`\n${fail ? '✗' : '✓'} ${pass} سليم · ${fail} معيب`);
process.exit(fail ? 1 : 0);
