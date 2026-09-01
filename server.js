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

app.use(express.static(path.join(__dirname, 'public'), { etag: false, lastModified: false, maxAge: 0 }));

app.get('/health', (_req, res) => res.json({ ok: true, stage: 'ui-only' }));

// SPA fallback — أي مسار غير معروف يعيد index.html
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`منصّة شعبة (واجهة) على المنفذ ${PORT}`));
