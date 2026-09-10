/* شعبة · عامل الخدمة
   ① يعمل بلا إنترنت — وشبكة المدرسة تنقطع.
   ② الأصول مبصومة بـ?v=رقم البناء، فالمخزَّن آمنٌ ما دام الرقم واحداً.
   ③ ومع كل نشر يتبدّل اسم المخزن فتُمسح النسخة القديمة كاملةً.
   ⚠ CACHE يُحدَّث آلياً بأداة الختم — لا يدوياً. */
var BUILD = 39;
var CACHE = 'shouba-v' + BUILD;

var SHELL = [
  './', './index.html', './login.html', './board.html', './schedule.html',
  './teachers.html', './teacher.html', './setup-review.html',
  './setup-wizard.html', './setup-wizard-2.html', './setup-wizard-3.html',
  './setup-wizard-4.html', './setup-wizard-5.html', './setup-wizard-6.html', './setup-wizard-7.html',
  './shell.css?v=' + BUILD, './components.css?v=' + BUILD, './frame.css?v=' + BUILD,
  './identity/tokens.css?v=' + BUILD,
  './build.js?v=' + BUILD, './refdata.js?v=' + BUILD, './derive.js?v=' + BUILD,
  './icons.js?v=' + BUILD, './components.js?v=' + BUILD,
  './manifest.webmanifest'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return Promise.allSettled(SHELL.map(function (u) { return c.add(u); })); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;                 // الخطوط الخارجية تُترك للمتصفّح

  /* ⚠ الخادم لا يمرّ بالمخزن أبداً (2026-09-10): كان طلب `api/…` يسقط إلى فرع
     «المخزن أولاً» أدناه، فيُحفظ أوّل جوابٍ ويُعاد أبداً — بياناتٌ قديمة، أو
     «لم تسجّل الدخول» محفوظةً تحبس صاحبها خارج حسابه بعد أن يدخل.
     الأصل: عامل الخدمة يخزّن **ملفّات الواجهة وحدها**؛ وجواب الخادم حيٌّ دائماً. */
  if (url.pathname.indexOf('/api/') > -1 || url.pathname.endsWith('/health')) return;

  /* version.json من الشبكة دائماً — به يُعرف أن ثمّة نسخة أحدث */
  if (url.pathname.endsWith('version.json')) {
    e.respondWith(fetch(req).catch(function () { return caches.match(req); }));
    return;
  }

  /* الصفحات: الشبكة أولاً ثم المخزن — فلا يبقى المستخدم على صفحة قديمة وهو متّصل */
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') > -1) {
    e.respondWith(
      fetch(req).then(function (r) {
        var copy = r.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return r;
      }).catch(function () { return caches.match(req).then(function (m) { return m || caches.match('./board.html'); }); })
    );
    return;
  }

  /* الأصول المبصومة: المخزن أولاً — وتغيّر البصمة يجلب الجديد حتماً */
  e.respondWith(
    caches.match(req).then(function (m) {
      return m || fetch(req).then(function (r) {
        var copy = r.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return r;
      });
    })
  );
});
