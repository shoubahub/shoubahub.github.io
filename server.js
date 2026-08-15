// QismHub Platform — خادم التطوير (يخدم واجهة SPA)
// المرحلة الحالية: واجهة فقط (بيانات مرجعية افتراضية على الواجهة).
// لاحقاً (شبكة المنزل): PostgreSQL + مصادقة + جوجل/Resend + نشر Railway.

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => res.json({ ok: true, stage: 'ui-only' }));

// SPA fallback — أي مسار غير معروف يعيد index.html
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`QismHub Platform (واجهة) على المنفذ ${PORT}`));
