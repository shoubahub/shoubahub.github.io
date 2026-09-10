// منصّة شعبة — خادم التطوير (يخدم واجهة SPA)
// المرحلة الحالية: واجهة فقط (بيانات مرجعية افتراضية على الواجهة).
// لاحقاً (شبكة المنزل): PostgreSQL + مصادقة + جوجل/Resend + نشر Railway.

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json({ limit: '2mb' }));

// ⚠ منع التخزين المؤقّت في التطوير (2026-08-27):
// كان الجوّال يحتفظ بنسخة قديمة من CSS/JS فلا يرى المستخدم أثر التعديل ويظنّه لم يُنفَّذ.
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

/* وسوم المعاينة (واتساب…) تُحقن في كل صفحة HTML قبل الملفّات الساكنة — og.js */
const og = require('./og');
const PUBLIC = path.join(__dirname, 'public');
app.use(og.html(PUBLIC));

app.use(express.static(PUBLIC, { etag: false, lastModified: false, maxAge: 0 }));

/* ⚠ رقم الإدارة بلا بديلٍ افتراضي: إن لم يُضبط **رفض الخادم أن يبدأ**.
   في موقع التوقّعات يعود إلى «1234» صامتاً — فيعمل الموقع ويبدو سليماً
   وبابُ الإدارة مفتوح. والخطأ الصامت أخطر من الخطأ الصائح. */
if (!process.env.ADMIN_PIN) {
  console.error('\n⛔ ADMIN_PIN غير مضبوط — الخادم لا يبدأ بلا رقم إدارة.');
  console.error('   محلّياً:  ADMIN_PIN=123456 node server.js');
  console.error('   على Railway: أضِفه متغيّرَ بيئةٍ في إعدادات الخدمة.\n');
  process.exit(1);
}

require('./auth').routes(app);

app.get('/health', (_req, res) => res.json({ ok: true, stage: 'server' }));

// SPA fallback — أي مسار غير معروف يعيد index.html
app.get('*', og.fallback(PUBLIC));

app.listen(PORT, () => console.log(`منصّة شعبة (واجهة) على المنفذ ${PORT}`));
