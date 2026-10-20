// وصول الوثيقة الى جهاز بلا نسخة — node public/_dev/data-arrive-test.mjs (2026-10-20)
// رصد معاينة السلوك: ادارة الواجهة تفتح على متصفح جديد «لا فعاليات بعد» ولا ترسم حين تصل الوثيقة الا بتحديث.
// فهذا يحرس: connect على جهاز فارغ يتبنى نسخة الخادم ويعلن «shouba:data»، ولا يعلنه حين للجهاز نسخة.
import fs from 'fs';
import vm from 'vm';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = fs.readFileSync(path.join(ROOT, 'derive.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? '— ' + JSON.stringify(extra) : ''); } };

function world(local, server, offline) {
  const store = local ? { 'shouba.setup': JSON.stringify(local), 'shouba.rev': '3' } : {};
  const fired = [];
  const c = {
    console, JSON, Promise, Event: class { constructor(t) { this.type = t; } },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    setTimeout: () => 0, clearTimeout: () => {},
    document: { dispatchEvent: e => { fired.push(e.type); return true; }, addEventListener: () => {} },
    fetch: () => offline ? Promise.reject(new Error('offline')) : Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ owner: '#1', user: 'u', data: server, rev: 3 }) })
  };
  c.window = c;
  vm.createContext(c);
  vm.runInContext(SRC, c);
  return { S: c.Shouba, fired, store };
}

const DOC = { department: 'الرياضيات', face: { events: [{ id: 'e1', title: 'يوم مفتوح' }] } };

let w = world(null, DOC);
ok(!w.S.data().face, 'قبل الوصول: الجهاز بلا وثيقة');
ok(await w.S.connect() === 'ok', 'connect على جهاز فارغ ينجح');
ok(w.fired.includes('shouba:data'), 'يعلن «shouba:data» بعد تبني نسخة الخادم', w.fired);
ok(w.S.data().face && w.S.data().face.events.length === 1, 'S.data تقرأ الوثيقة الواصلة بلا تحديث');

w = world(DOC, DOC);
await w.S.connect();
ok(!w.fired.includes('shouba:data'), 'للجهاز نسخة مطابقة: لا اعلان', w.fired);

w = world(null, {});
await w.S.connect();
ok(!w.fired.includes('shouba:data'), 'الخادم فارغ: لا اعلان', w.fired);

const fa = fs.readFileSync(path.join(ROOT, 'face-admin.html'), 'utf8');
ok(/addEventListener\('shouba:data',\s*paint\)/.test(fa), 'ادارة الواجهة تعيد الرسم عند «shouba:data»');

// «shouba:synced» بعد انتهاء المراجعة في كل حال — وبه تكف ادارة الواجهة عن «جارٍ التحميل…» (2026-10-20)
w = world(null, DOC);
ok(!w.S.synced, 'قبل المراجعة: synced غير مضبوط');
await w.S.connect();
ok(w.S.synced && w.fired.indexOf('shouba:synced') > w.fired.indexOf('shouba:data'), 'جهاز فارغ: «shouba:synced» بعد «shouba:data»', w.fired);
w = world(DOC, DOC); await w.S.connect();
ok(w.fired.includes('shouba:synced'), 'نسخة مطابقة: «shouba:synced»', w.fired);
w = world(null, {}); await w.S.connect();
ok(w.fired.includes('shouba:synced'), 'الخادم فارغ: «shouba:synced»', w.fired);
w = world(null, DOC, true);
ok(await w.S.connect() === 'none' && w.fired.includes('shouba:synced'), 'لا اتصال: «none» ويعلن الانتهاء', w.fired);

const fa2 = fa.replace(/\s+/g, ' ');
ok(fa.includes("document.addEventListener('shouba:synced', paint)"), 'ادارة الواجهة تعيد الرسم عند «shouba:synced»');
ok(/if \(loading\(\)\) \{ \$\('pubKick'\)\.textContent = 'جارٍ التحميل…'/.test(fa2), 'حال النشر: «جارٍ التحميل…» قبل «لا اتصال بالخادم»');
ok(fa2.indexOf("if (loading())") < fa2.indexOf("if (!ME) {"), 'فحص التحميل يسبق «لا اتصال»');
ok(/if \(!list\.length && loading\(\)\) \{ box\.innerHTML = '<div class="empty">جارٍ التحميل…<\/div>'/.test(fa2), 'الفعاليات: سطر التحميل بدل «لا فعاليات بعد»');
ok(/function loaded\(\) \{ LOAD = false; paint\(\); \}/.test(fa2) && (fa2.match(/loaded\(\)/g) || []).length >= 6, 'ينتهي التحميل في كل مخرج لطلب api/face/me');

// الرأس يرسم مع paint() (اسم الشعبة وشعارها بعد وصول الوثيقة)، وزر الرابط المعطل يبدو معطلا (2026-10-20)
ok(fa2.includes('paintHead(); paintPub(); paintTheme();') && fa2.indexOf('function paint()') < fa2.indexOf('paintHead(); paintPub()'), 'paint() ترسم الرأس');
ok(!/\(function head\(\)/.test(fa) && /\$\('sub'\)\.textContent = d\.department \|\| 'شعبتك'/.test(fa), 'الرأس لم يعد يرسم مرة واحدة عند الفتح');
const fcss = fs.readFileSync(path.join(ROOT, 'face.css'), 'utf8');
ok(/\.face-adm \.card-soft \.acts \.ghost2\[disabled\]\{color:var\(--shouba-off-text\)/.test(fcss), 'زر الرابط المعطل بلون المعطل في المنصة');
ok(/\$\('copy'\)\.disabled = !ME;/.test(fa), 'زر الرابط معطل ما دام الخادم لم يجب');

console.log(`\n${pass} نجح · ${fail} فشل`);
process.exit(fail ? 1 : 0);
