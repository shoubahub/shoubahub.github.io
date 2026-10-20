// حال التحميل في ادارة الواجهة عند فشل الخادم — node public/_dev/face-load-test.mjs (2026-10-20)
// رصد المراجعة: جهاز عنده وثيقته، والخادم يرد ٥٠٣ (لا انقطاع شبكة) — فقيل ان الاقسام تظهر و«عاين» يبقى معطلا.
// فهذا يشغل شيفرة الصفحة نفسها (مقتطعة من face-admin.html) على DOM مصغر، بجواب ٥٠٣ وبانقطاع وببطء،
// بوثيقة وبلا وثيقة، ويحرس: كل مخرج ينهي التحميل ويعيد الرسم، و«عاين» يتبع اخفاء الاقسام في كل رسم.
import fs from 'fs';
import vm from 'vm';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const HTML = fs.readFileSync(path.join(ROOT, 'face-admin.html'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? '— ' + JSON.stringify(extra) : ''); } };

/* مقتطع من بدايته الى اول نهاية بعده */
function cut(start, end) {
  const i = HTML.indexOf(start);
  if (i < 0) throw new Error('لم يوجد: ' + start);
  const j = HTML.indexOf(end, i);
  if (j < 0) throw new Error('لا نهاية: ' + start);
  return HTML.slice(i, j + end.length);
}
const SRC = [
  cut('var LOAD = true', '\n'),
  cut('function loading() {', '\n'),
  cut('function blank() {', '\n'),
  cut('function paintPub() {', '\n  }\n'),
  cut('function api(method, url, body) {', '\n  }\n'),
  cut("$('preview').addEventListener('click'", '\n  });\n'),
  cut('function paint() {', '\n  }\n'),
  'paint();',
  "document.addEventListener('shouba:synced', paint);",
  cut('function loaded() {', '}, function () { loaded(); });\n})();').replace(/\n\}\)\(\);$/, '')
].join('\n');

const tick = () => new Promise(r => setTimeout(r, 0));
const settle = async () => { for (let i = 0; i < 10; i++) await tick(); };

/* doc: للجهاز وثيقة · me: جواب api/face/me · pub: جواب api/face/<الرمز> — 'ok' | 503 | 'down' | 'hang' */
function world({ doc, me, pub = 'ok', published = false }) {
  const els = {}, secs = [1, 2, 3, 4, 5].map(() => ({ hidden: true })), on = {}, log = [];
  const $ = id => els[id] || (els[id] = { id, textContent: '', innerHTML: '', disabled: false, hidden: id === 'pview', src: '',
    addEventListener(t, f) { (this.on = this.on || {})[t] = f; } });
  const local = doc ? { department: 'الرياضيات', face: { events: [{ id: 'e1', title: 'يوم مفتوح' }] } } : {};
  const S = { data: () => local, synced: false, toast: () => {}, dm: d => d };
  const answer = (mode, body) => {
    if (mode === 'down') return Promise.reject(new TypeError('Failed to fetch'));
    if (mode === 'hang') return new Promise(() => {});
    if (mode === 503) return Promise.resolve({ ok: false, status: 503, json: () => Promise.reject(new SyntaxError('not json')) });
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
  };
  const fetch = url => /api\/face\/me$/.test(url) ? answer(me, { slug: 'abc', published, at: '' }) : answer(pub, { data: { shown: [] } });
  const c = {
    S, $, fetch, JSON, Promise, Object, console,
    SEL: [], BUSY: false, ME: null, PUB: null, window: {},
    document: {
      scrollingElement: { scrollTop: 0 },
      querySelector: () => null,
      querySelectorAll: () => secs,
      addEventListener: (t, f) => { on[t] = f; }
    },
    changed: () => false, link: () => '', num: x => x, pubSel: () => [], snapshot: () => ({}),
    paintHead() {}, paintTheme() {}, paintTeam() {}, paintWeek() {}, paintEvents() {},
    /* كل رسم يسجل: هل «عاين» معطل، وهل الاقسام مخفية — ليقارنا */
    __log: () => log.push({ dis: $('preview').disabled, hide: secs[0].hidden })
  };
  vm.createContext(c);
  vm.runInContext(SRC.replace('box.forEach(function (e, i)', '__log(); box.forEach(function (e, i)'), c);
  /* مراجعة الوثيقة تنتهي (نجحت او لم تصل) — كما يفعل S.connect */
  const synced = () => { S.synced = true; on['shouba:synced'] && on['shouba:synced'](); };
  return { $, secs, log, synced };
}

const state = w => ({ dis: w.$('preview').disabled, hide: w.secs.every(s => s.hidden), kick: w.$('pubKick').textContent });
const click = w => { w.$('pview').hidden = true; w.$('preview').on.click(); return !w.$('pview').hidden; };

for (const bad of [503, 'down']) {
  const how = bad === 503 ? 'جواب ٥٠٣' : 'انقطاع الشبكة';

  let w = world({ doc: true, me: bad });
  await settle(); w.synced();
  let s = state(w);
  ok(!s.hide && !s.dis && s.kick === 'لا اتصال بالخادم', how + ' بوثيقة: الاقسام ظاهرة و«عاين» مفعل و«لا اتصال بالخادم»', s);
  ok(click(w), how + ' بوثيقة: «عاين» يفتح المعاينة');

  /* المراجعة تنتهي قبل جواب الخادم — الترتيب الآخر */
  w = world({ doc: true, me: bad });
  w.synced(); await settle();
  s = state(w);
  ok(!s.hide && !s.dis, how + ' بوثيقة (المراجعة اولا): «عاين» مفعل', s);

  w = world({ doc: false, me: bad });
  await settle(); w.synced();
  s = state(w);
  ok(s.hide && s.dis && s.kick === 'لا اتصال بالخادم', how + ' بلا وثيقة: الاقسام مخفية و«عاين» معطل', s);
  ok(!click(w), how + ' بلا وثيقة: «عاين» لا يفتح شيئا');

  /* الواجهة منشورة، وجلب نسختها المنشورة يفشل — ينتهي التحميل ايضا */
  w = world({ doc: true, me: 'ok', published: true, pub: bad });
  await settle(); w.synced();
  s = state(w);
  ok(!s.hide && !s.dis && s.kick === 'منشورة', how + ' في جلب المنشور: ينتهي التحميل و«عاين» مفعل', s);
}

/* بطء: ما دام الطلب معلقا فالكل مخفي ومعطل */
let w = world({ doc: true, me: 'hang' });
await settle(); w.synced();
let s = state(w);
ok(s.hide && s.dis && s.kick === 'جار التحميل…', 'خادم بطيء: «جار التحميل…» والاقسام مخفية و«عاين» معطل', s);
ok(!click(w), 'خادم بطيء: «عاين» لا يفتح شيئا');

/* القاعدة الواحدة: في كل رسم، «عاين» معطل حين تخفى الاقسام ومفعل حين تظهر */
let all = [];
for (const doc of [true, false]) for (const me of [503, 'down', 'ok', 'hang']) {
  w = world({ doc, me }); await settle(); w.synced(); await settle();
  all = all.concat(w.log);
}
const odd = all.filter(r => r.dis !== r.hide);
ok(all.length > 0 && !odd.length, '«عاين» يتبع اخفاء الاقسام في كل رسم (' + all.length + ')', odd);

console.log(`\n${pass} ناجح · ${fail} فاشل`);
process.exit(fail ? 1 : 0);
