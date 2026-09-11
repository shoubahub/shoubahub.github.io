// اختبار نواة محرك السجلات — node public/_dev/rec-test.mjs (2026-09-12)
// يحمل refdata.js ثم rec-templates.js ثم rec-engine.js ثم derive.js في سياق معزول بمخزن مؤقت،
// ويفحص: القوائم المغلقة · تجميد الاصدارات · الرقم التسلسلي · التاريخ · القرارات · ثبات الاصدار ·
// ترقيم المخرج المجمع · التخزين في الوثيقة · خلو القوالب من التشكيل.
import fs from 'fs';
import vm from 'vm';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function world(store = {}, tplOverride) {
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const c = { console, localStorage: ls, setTimeout, clearTimeout, Date, JSON, Math };
  c.window = c;
  vm.createContext(c);
  vm.runInContext(read('refdata.js'), c, { filename: 'refdata.js' });
  if (tplOverride) c.SHOUBA_TPL = tplOverride; else vm.runInContext(read('rec-templates.js'), c, { filename: 'rec-templates.js' });
  vm.runInContext(read('rec-engine.js'), c, { filename: 'rec-engine.js' });
  vm.runInContext(read('derive.js'), c, { filename: 'derive.js' });
  return c;
}

let pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? '— ' + JSON.stringify(extra) : ''); } };
const clone = o => JSON.parse(JSON.stringify(o));

// ١) القالب الرسمي سليم، والقوائم مغلقة
let W = world();
const R = W.ShoubaRec;
ok(R.errors.length === 0, 'قوالب rec-templates.js كلها سليمة', R.errors);
ok(!!R.latest('meetings') && R.latest('meetings').v === 1, 'سجل الاجتماعات مسجل باصداره ١');
ok(R.byReady('سجل اجتماعات الشعبة') === R.latest('meetings'), 'يربط باسمه في readyRecords');
const base = clone(W.SHOUBA_TPL.meetings[1]);
const bad = (mut, needle, name) => { const t = clone(base); mut(t); const e = R.validate(t); ok(e.some(x => x.includes(needle)), name, e); };
bad(t => { t.blocks[0].type = 'drawing'; }, 'نوع لبنة خارج القائمة', 'يرفض لبنة خارج القائمة');
bad(t => { t.blocks[0].fields[0].kind = 'color'; }, 'نوع خارج القائمة', 'يرفض نوع حقل خارج القائمة');
bad(t => { t.blocks.push({ type: 'table', id: 'grid', columns: [{ id: 'a', label: 'أ', kind: 'check', group: 'nope' }] }); }, 'مجموعة غير معرفة', 'يرفض عمودا في مجموعة غير معرفة');
bad(t => { t.blocks.push({ type: 'repeat', id: 'axis', label: 'محور', blocks: [{ type: 'repeat', id: 'inner', label: 'داخلي', blocks: [{ type: 'text', id: 'x', sections: [{ id: 'p', kind: 'paragraph' }] }] }] }); }, 'قسم متكرر داخل قسم متكرر', 'يرفض قسما متكررا داخل قسم متكرر');
bad(t => { t.blocks[1].sections[0].of = 'missing'; }, 'متابعة لقرارات غير موجودة', 'يرفض متابعة لقرارات غير موجودة');
bad(t => { t.blocks.push({ type: 'fields', id: 'meta', fields: [{ id: 'x', label: 'س', kind: 'text' }] }); }, 'معرف لبنة مكرر', 'يرفض معرف لبنة مكررا');
bad(t => { t.page.fit = 'shrink'; }, 'سلوك الامتلاء', 'يرفض سلوك امتلاء خارج القائمة');

// الشبكة (سجلات الاعداد) والقسم المتكرر (الخطة التشغيلية) مقبولان في الصيغة
const grid = { id: 'prep', v: 1, title: 'نموذج متابعة سجلات الاعداد', owner: 'teacher', page: { orient: 'landscape', fit: 'flow' },
  blocks: [{ type: 'table', id: 'follow', groups: [{ id: 'intro', label: 'النشاط الاستهلالي' }],
    columns: [{ id: 'date', label: 'تاريخ المتابعة', kind: 'date', vertical: true },
              { id: 'hook', label: 'عنصر التشويق', kind: 'check', group: 'intro', vertical: true },
              { id: 'sign', label: 'توقيع المعلم', kind: 'signature' }], rows: { min: 7 } }] };
ok(R.validate(grid).length === 0, 'الشبكة العرضية = جدول متكرر باعمدة ✓ مجمعة وعناوين رأسية', R.validate(grid));
const plan = { id: 'opplan', v: 1, title: 'الخطة التشغيلية', owner: 'shouba', page: { orient: 'landscape', fit: 'flow' },
  prints: [{ id: 'plan', hide: ['follow'] }, { id: 'report', summary: true, pickSections: true, appendix: 'evidence' }],
  blocks: [{ type: 'signatures', id: 'cover', mode: 'cover' },
    { type: 'repeat', id: 'axes', label: 'محور', blocks: [
      { type: 'fields', id: 'axis', fields: [{ id: 'name', label: 'المحور', kind: 'text', required: true }] },
      { type: 'text', id: 'goals', sections: [{ id: 'g', kind: 'paragraph', title: 'الغايات الاستراتيجية' }] },
      { type: 'table', id: 'acts', columns: [
        { id: 'what', label: 'الوسائل والاجراءات والبرامج', kind: 'text' },
        { id: 'who', label: 'الاعداد والتنفيذ', kind: 'teacher', multi: true },
        { id: 'when', label: 'مواعيد التنفيذ', kind: 'months', multi: true },
        { id: 'follow', label: 'المتابعة', kind: 'followup' }] }] }] };
ok(R.validate(plan).length === 0, 'القسم المتكرر والمطبوعان مقبولان في الصيغة', R.validate(plan));

// ٢) الاصدار المنشور مجمد
const m1 = R.get('meetings', 1);
try { m1.title = 'غيره'; m1.blocks[0].fields[2].label = 'غيره'; } catch (e) {}
ok(m1.title === 'سجل الاجتماعات' && m1.blocks[0].fields[2].label === 'الموضوع', 'الاصدار المنشور لا يعدل (مجمد)');

// ٣) اليوم من التاريخ
ok(R.weekday('2026-09-17') === 'الخميس', 'اسم اليوم من التاريخ (٢٠٢٦/٩/١٧ خميس)', R.weekday('2026-09-17'));

// ٤) الانشاء والتخزين والرقم التسلسلي عبر derive.js
const store = {};
W = world(store);
W.localStorage.setItem('shouba.setup', JSON.stringify({ stage: 'ثانوي', department: 'الرياضيات', refDataVersion: 3,
  teachers: ['أحمد الفهد', 'خالد العنزي', 'فهد المطيري'], year: '٢٠٢٦/٢٠٢٧', term: 'الفصل الأول', schoolName: 'ثانوية الأمل' }));
const S = W.Shouba; S.data(true);
const r1 = S.newRec('meetings');
ok(r1 && r1.v === 1 && r1.status === 'draft', 'سجل جديد من احدث اصدار، مسودة');
ok(r1.values.meta.no === 1, 'اول اجتماع في العام رقمه ١', r1.values.meta.no);
ok(r1.values.meta.date === S.today(), 'تاريخ اليوم تلقائي', r1.values.meta.date);
ok(JSON.stringify(r1.values.att.roster) === JSON.stringify(['أحمد الفهد', 'خالد العنزي', 'فهد المطيري']) && r1.values.att.absent.length === 0, 'الحضور: كل المعلمين حاضرون افتراضا (لقطة يوم الانشاء)');
ok(S.recs().length === 0, 'الانشاء وحده لا يحفظ مسودة فارغة');
r1.values.meta.date = '2026-09-10'; r1.values.meta.topic = 'الاستعداد للفصل';
r1.values.body.decide = [{ id: 'dA', text: 'تسليم التوزيع الزمني', owner: 'جميع المعلمين' }, { id: 'dB', text: 'بنك اسئلة الوحدة الاولى', owner: 'فهد المطيري', due: '2026-10-08' }];
S.saveRec(r1);
ok(S.recs('meetings').length === 1 && JSON.parse(store['shouba.setup']).recs.length === 1, 'يحفظ في الوثيقة تحت recs');
ok(Array.isArray(JSON.parse(store['shouba.setup']).records) === false, 'لا يمس مفتاح records (اسماء السجلات المختارة)');
const r2 = S.newRec('meetings');
ok(r2.values.meta.no === 2, 'الاجتماع التالي رقمه ٢', r2.values.meta.no);
r2.values.meta.date = '2026-09-17';
r2.values.body.carry = { dA: 'done', dB: 'cont' };
r2.values.body.decide = [{ id: 'dC', text: 'اختبار قصير موحد', owner: 'خالد العنزي' }];
S.saveRec(r2);

// ٤ب) ملخص السجل للقوائم والرؤوس، وصيغ المعدود في التعريف (الخطوة د)
const sm = R.summary(r2);
ok(sm.no === 2 && sm.date === '2026-09-17' && sm.title === '', 'الملخص: الرقم والتاريخ من التعريف، والموضوع الفارغ فارغ', sm);
ok(R.summary(r1).title === 'الاستعداد للفصل', 'الملخص: العنوان اول حقل نص مطلوب', R.summary(r1));
const nn = R.latest('meetings').noun;
ok(nn && ['one', 'two', 'few', 'many', 'zero'].every(k => typeof nn[k] === 'string' && nn[k]), 'صيغ المعدود كاملة في القالب (محضر · محضران · محاضر)', nn);

// ٥) متابعة القرارات
const shown2 = S.openDecisions(r2).map(d => d.id);
ok(JSON.stringify(shown2) === JSON.stringify(['dA', 'dB']), 'الاجتماع الثاني يعرض قرارات الاول', shown2);
const r3 = S.newRec('meetings'); r3.values.meta.date = '2026-09-24';
const shown3 = S.openDecisions(r3).map(d => d.id);
ok(JSON.stringify(shown3) === JSON.stringify(['dB', 'dC']), '«نفذ» يغلق و«مستمر» ينتقل: الثالث يعرض المستمر والجديد', shown3);
ok(JSON.stringify(S.stillOpen(r1).map(d => d.id)) === JSON.stringify(['dB']), 'بطاقة الاول: قرار واحد ما زال مفتوحا', S.stillOpen(r1).map(d => d.id));

// ٥ب) الارشيف والبحث والحالات (الخطوة هـ)
const tanween = String.fromCharCode(0x064C);
ok(R.norm('أسئلة' + tanween + ' ٢') === 'اسءله 2', 'البحث يوحد الهمزة والتاء المربوطة والارقام وينزع التشكيل', R.norm('أسئلة' + tanween + ' ٢'));
ok(R.norm('مسؤول') === R.norm('مسئول'), 'كرسي الهمزة لا يفرق: «مسؤول» = «مسئول»', [R.norm('مسؤول'), R.norm('مسئول')]);
ok(R.match(r1, 'أسئلة الوحدة') && R.match(r1, 'اسئلة') && R.match(r1, 'الخميس 10/9') && !R.match(r1, '11/9'), 'يجد المحضر بكلمات من قراراته ويومه وتاريخه', R.text(r1));
ok(!R.match(r2, 'اسئلة'), 'ولا يجد ما ليس فيه');
const prevYear = clone(r1); prevYear.id = 'rOld'; prevYear.year = '٢٠٢٥/٢٠٢٦'; prevYear.term = 'الفصل الثاني'; prevYear.values.meta.date = '2026-05-10';
const ar = R.archive([r1, prevYear, r2]);
ok(ar.length === 2 && ar[0].year === '٢٠٢٦/٢٠٢٧' && ar[0].items.map(r => r.id).join() === [r2.id, r1.id].join() && ar[1].items[0].id === 'rOld',
  'الارشيف: العام والفصل الاحدث اولا، والاحدث داخله اولا', ar.map(g => [g.year, g.term, g.items.map(r => r.id)]));
ok(R.archive([r1, r2], { status: 'printed' }).length === 0 && R.archive([r1, r2], { q: 'موحد' })[0].items[0].id === r2.id, 'تصفية بالحالة وبالبحث');
const p1 = clone(r1); R.markPrinted(p1);
ok(p1.status === 'printed' && !!p1.printed && R.archive([p1, r2], { status: 'printed' })[0].items.length === 1, 'اول طباعة تجعله «مطبوعا»');
ok(R.markPrinted({ status: 'signed' }).status === 'signed', 'الطباعة لا تنزل الموقع الى مطبوع');
const s1 = clone(r1); R.markSigned(s1, { id: 'fabc', mime: 'image/jpeg', size: 1234 });
ok(s1.status === 'signed' && s1.signed.file === 'fabc' && !!s1.signed.at, 'ارفاق النسخة الموقعة يجعله «موقعا» ويحفظ الاشارة وحدها', s1.signed);
ok(R.unsign(s1) === 'fabc' && s1.status === 'printed' && !s1.signed, 'ازالتها تعيده «مطبوعا» وتعيد معرف الملف لحذفه');
ok(R.files({ signed: { file: 'fa' }, values: { attach: { items: [{ file: 'fb' }, { file: 'fa' }] } } }).join() === 'fa,fb', 'ملفات السجل: النسخة الموقعة والمرفقات بلا تكرار — لحذفها معه');
const withFiles = clone(r1); withFiles.values.attach = { items: [{ file: 'fz', name: 'نشرة الاختبارات', mime: 'application/pdf' }] };
ok(R.match(withFiles, 'نشرة'), 'البحث يجد المحضر باسم مرفقه');
const fresh = R.create(R.latest('meetings'), { today: '2026-09-11' });
ok(fresh.values.attach && Array.isArray(fresh.values.attach.items) && !Array.isArray(fresh.values.attach)
   && JSON.parse(JSON.stringify(fresh)).values.attach.items.length === 0, 'المرفقات تبدأ كائنا بقائمة فارغة (تبقى بعد الحفظ)', fresh.values.attach);
ok(S.archive('meetings').length === 1 && S.archive('meetings')[0].items.length === 2, 'S.archive من الوثيقة', S.archive('meetings'));
ok(S.stillOpen(r2).length === 1, 'بطاقة الثاني: قراره مفتوح');
const old = S.newRec('meetings'); old.values.meta.date = '2026-09-03';
ok(S.openDecisions(old).length === 0, 'سجل تاريخه قبل الجميع لا يرث قرارات لاحقة');

// ٦) الرقم التسلسلي يبدأ من ١ في العام الجديد، ولا يتأثر بالحذف
S.removeRec(r1.id);
ok(S.newRec('meetings').values.meta.no === 3, 'حذف سجل لا يعيد رقمه لغيره (يلي اكبر رقم)');
const d = S.data(); d.year = '٢٠٢٧/٢٠٢٨'; S.save();
ok(S.newRec('meetings').values.meta.no === 1, 'عام دراسي جديد يبدأ من ١');

// ٧) ثبات الاصدار: رفع اصدار وتعديل عنوان لا يمس سجلا قديما
const v2 = clone(base); v2.v = 2; v2.blocks[0].fields[2].label = 'موضوع الاجتماع';
const W2 = world({}, { meetings: { 1: clone(base), 2: v2 } });
const R2 = W2.ShoubaRec;
ok(R2.latest('meetings').v === 2, 'الاحدث بعد الرفع هو ٢');
const oldRec = { id: 'x', tpl: 'meetings', v: 1, values: {} };
ok(R2.of(oldRec).blocks[0].fields[2].label === 'الموضوع', 'السجل المحفوظ على ١ يعرض بعناوين ١');
ok(R2.of({ tpl: 'meetings', v: 2 }).blocks[0].fields[2].label === 'موضوع الاجتماع', 'والجديد بعناوين ٢');

// ٨) المخرج المجمع: ترقيم متصل وفهرس وجمع عمودي وعرضي
const b = R.paginate([{ key: 'm', title: 'سجل الاجتماعات', orient: 'portrait', pages: 1 },
                      { key: 'p', title: 'متابعة سجلات الاعداد', orient: 'landscape', pages: 2 }], { cover: true, toc: true });
ok(b.total === 5 && b.sheets.map(s => s.number).join(',') === '1,2,3,4,5', 'ترقيم متصل من الغلاف الى آخر صفحة', b.sheets.map(s => s.kind + s.number));
ok(b.toc[0].page === 3 && b.toc[1].page === 4, 'الفهرس بارقام صفحات السجلات', b.toc);
ok(b.sheets.filter(s => s.doc === 'p').every(s => s.rotate && s.paper === 'portrait'), 'العرضية في المجمع تدار داخل ورقة عمودية');
const single = R.paginate([{ key: 'p', title: 'س', orient: 'landscape', pages: 1 }]);
ok(!single.sheets[0].rotate && single.sheets[0].paper === 'landscape', 'السجل العرضي وحده يطبع على ورق عرضي');

// ٩) بلا تشكيل في القوالب والمحرك
const H = new RegExp('[' + String.fromCharCode(0x064B) + '-' + String.fromCharCode(0x0652) + String.fromCharCode(0x0670) + ']');
ok(!H.test(read('rec-templates.js')) && !H.test(read('rec-engine.js')), 'القوالب والمحرك بلا تشكيل');

console.log(`\n${fail ? '✗' : '✓'} ${pass} سليم · ${fail} معيب`);
process.exit(fail ? 1 : 0);
