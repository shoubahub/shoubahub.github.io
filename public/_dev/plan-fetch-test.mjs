// اختبار جلب خطط التوزيع — node public/_dev/plan-fetch-test.mjs (2026-09-19)
// رصد زميل المستخدم: «تجلب خطط التوزيع…» لا تنتهي. فهذا يحرس السلوك: المحاولة تعاد، والنسخة المحفوظة لا تمحى
// بجواب فارغ، والفشل النهائي حال معلنة بسببها، وعودة الاتصال او عودة المنصة تستأنف.
import fs from 'fs';
import vm from 'vm';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PLAN = { key: 'k', grade: 'العاشر', subject: 'الرياضيات', source: {}, weeks: [{ n: 1, lessons: [] }] };

/* عالم متصفح مصغر: المؤقت يطلق فورا فتمضي المحاولات كلها في اللحظة، والاحداث تجمع مستمعيها */
function world(saved, answers, opt) {
  const store = saved ? { 'shouba.plans': JSON.stringify(saved) } : {};
  const calls = [];
  const on = { window: {}, document: {} };
  let tick = 0; const dead = {};
  const c = {
    console, JSON, Promise, navigator: { onLine: !(opt && opt.offline) },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    /* المؤقت يؤجل الى الدورة التالية (لا ينفذ في مكانه) فيبقى ترتيب الاعلان كما هو في المتصفح، ويقبل الالغاء */
    setTimeout: (fn) => { const id = ++tick; Promise.resolve().then(() => { if (!dead[id]) fn(); }); return id; },
    clearTimeout: (id) => { dead[id] = true; },
    document: { addEventListener: (n, fn) => { on.document[n] = fn; } }
  };
  c.window = c;
  c.addEventListener = (n, fn) => { on.window[n] = fn; };
  c.fetch = (url) => {
    calls.push(url);
    const a = answers.shift() || answers.last || { throw: true };
    answers.last = a;
    if (a.throw) return Promise.reject(new Error('شبكة'));
    if (a.status && a.status !== 200) return Promise.resolve({ ok: false, status: a.status });
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(a.body) });
  };
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'plan-data.js'), 'utf8'), c, { filename: 'plan-data.js' });
  return { P: c.ShoubaPlans, calls, on, store };
}

let pass = 0, fail = 0;
const settle = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
const ok = (cond, name, extra) => { if (cond) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? '— ' + JSON.stringify(extra) : ''); } };
const saved = { stage: 'ثانوي', v: 'v1', set: { id: 's' }, calendar: [], plans: [PLAN] };

/* ① الجواب السليم يحفظ ويعلن النجاح */
{
  const { P, store } = world(null, [{ body: { v: 'v2', set: { id: 's' }, calendar: [{ n: 1 }], plans: [PLAN] } }]);
  const got = await P.load('ثانوي'); await settle();
  ok(got && got.plans.length === 1 && P.state().at === 'ok' && JSON.parse(store['shouba.plans']).v === 'v2',
     'الجواب السليم يحفظ في الجهاز والحال «ok»', P.state());
}
/* ② الطلب المتعثر يعاد، ولا يمحو النسخة المحفوظة، وينتهي الى حال معلنة بسببها */
{
  const { P, calls } = world(saved, [{ throw: true }]);
  const seq = [];
  P.onChange(function (c, s) { seq.push(s.at); });
  await P.load('ثانوي'); await settle();
  ok(calls.length === 5, 'الطلب المتعثر يعاد اربع مرات بعد الاولى — لا محاولة واحدة ثم صمت', calls.length);
  ok(seq[0] === 'loading' && seq[1] === 'loading' && seq[2] === 'fail',
     'اول تعثر لا يزعج (عابر)، والثاني يعلن ولو كانت المحاولات ماضية', seq);
  ok(P.state().at === 'fail' && P.state().why === 'net', 'بعد المحاولات: حال «fail» وسببها لا «تجلب…» ابدا', P.state());
  ok(P.get('ثانوي') && P.get('ثانوي').plans.length === 1, 'النسخة المحفوظة باقية رغم تعثر الطلب');
}
/* ③ انتهاء الجلسة سبب مميز — فالشاشة تقول «ادخل» لا «تعذر الوصول» */
{
  const { P } = world(saved, [{ status: 401 }]);
  await P.load('ثانوي'); await settle();
  ok(P.state().at === 'fail' && P.state().why === 'auth', 'الجلسة المنتهية (٤٠١) سببها «auth»', P.state());
}
/* ④ بلا اتصال: السبب «offline» فتقال له لغة حاله لا «تعذر الوصول إلى الخادم» */
{
  const { P } = world(saved, [{ throw: true }], { offline: true });
  await P.load('ثانوي'); await settle();
  ok(P.state().at === 'fail' && P.state().why === 'offline', 'انقطاع الشبكة سببه «offline»', P.state());
}
/* ⑤ جواب بلا خطط لا يمحو نسخة سليمة — «لا خطط» لا تعني «امح ما عندك» */
{
  const { P, store } = world(saved, [{ body: { v: 'v9', set: null, calendar: [], plans: [] } }]);
  await P.load('ثانوي'); await settle();
  ok(P.get('ثانوي').plans.length === 1 && JSON.parse(store['shouba.plans']).plans.length === 1 && P.state().at === 'ok',
     'الجواب الفارغ لا يمحو الخطط المحفوظة', P.get('ثانوي').plans.length);
}
/* ⑥ ومن لا نسخة عنده يقبل الفارغ فيقال له «يجب رفع الخطة» لا «تجلب…» */
{
  const { P } = world(null, [{ body: { v: 'v1', set: null, calendar: [], plans: [] } }]);
  await P.load('ثانوي'); await settle();
  ok(P.get('ثانوي') && P.get('ثانوي').plans.length === 0 && P.state().at === 'ok', 'بلا نسخة: الفارغ يقبل والحال «ok»');
}
/* ⑦ «لا جديد» تبقي المحفوظة */
{
  const { P } = world(saved, [{ body: { same: true, v: 'v1' } }]);
  await P.load('ثانوي'); await settle();
  ok(P.get('ثانوي').v === 'v1' && P.state().at === 'ok', '«لا جديد»: المحفوظة كما هي');
}
/* ⑧ عودة الاتصال وعودة المنصة تستأنفان المحاولة بعد الفشل */
{
  const { P, on, calls } = world(saved, [{ throw: true }, { throw: true }, { throw: true }, { throw: true }, { throw: true },
    { body: { v: 'v3', set: { id: 's' }, calendar: [], plans: [PLAN, PLAN] } }]);
  await P.load('ثانوي'); await settle();
  ok(P.state().at === 'fail', 'قبل الحدث: فشل', P.state());
  await on.window.online(); await settle();
  ok(P.get('ثانوي').plans.length === 2 && P.state().at === 'ok', 'عودة الاتصال تستأنف فتصل الخطط', P.state());
  ok(typeof on.document['shouba:resume'] === 'function', 'وعودة المنصة الى الواجهة مستمع لها (shouba:resume على document)');
  ok(calls.length === 6, 'ولا طلب زائد بعد النجاح', calls.length);
}
/* ⑨ «أعد المحاولة» بلمسة صاحبها تبدأ من جديد */
{
  const { P } = world(saved, [{ throw: true }, { throw: true }, { throw: true }, { throw: true }, { throw: true },
    { body: { v: 'v4', set: { id: 's' }, calendar: [], plans: [PLAN] } }]);
  await P.load('ثانوي'); await settle();
  const before = P.state().at;
  await P.retry(); await settle();
  ok(before === 'fail' && P.state().at === 'ok' && P.get('ثانوي').v === 'v4', '«أعد المحاولة» تستأنف بلا مرحلة تمرر', P.state());
}

console.log('\n' + (fail ? '✗' : '✓') + ' ' + pass + ' سليم · ' + fail + ' معيب');
process.exit(fail ? 1 : 0);
