/* شعبة · عامل خدمة صفحة المعلم (/t/sw.js، مجاله /t/ وحده) — 2026-11-06، tpush.js
   للإشعارات فقط: لا يخزن شيئا ولا يمس عامل المنصة (sw.js) ولا ملفاتها.
   ⚠ كل إشعار يصل يظهر لا محالة: سفاري يلغي الاشتراك إن وصل إشعار لم يعرض. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (e) {
  var m = {};
  try { m = e.data ? e.data.json() : {}; } catch (x) { m = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(m.title || 'شعبة', {
    body: m.body || '',
    tag: m.tag || undefined,
    lang: 'ar', dir: 'rtl',
    icon: '/identity/assets/app-icon-approved.png',
    data: { url: m.url || self.registration.scope }
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = new URL((e.notification.data && e.notification.data.url) || self.registration.scope, self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      /* الصفحة مفتوحة في الخلفية (رصد معاينة السلوك، النسخة 0.46.0 · بناء 145): يُرسل إليها رابط الإشعار
         فتنتقل إلى تبويبه («الرسائل» أو «المواعيد») وتجلب الجديد، ثم تظهر */
      if (list[i].url.indexOf(self.registration.scope) === 0 && 'focus' in list[i]) {
        list[i].postMessage({ open: url });
        return list[i].focus();
      }
    }
    return self.clients.openWindow ? self.clients.openWindow(url) : null;
  }));
});
