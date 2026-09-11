/* ===================================================================
   شعبة · المرفقات (2026-09-12) — الخطوة (و) من محرك السجلات
   ────────────────────────────────────────────────────────────────
   النسخة الموقعة من السجل (صورة او PDF) — وما يأتي من مرفقات اللبنة ⑥ لاحقا.

   ⚠ في القاعدة نفسها (جدول files، على القرص الدائم DB_PATH) لا في وثيقة الشعبة:
     الوثيقة نص JSON يرسل كاملا مع كل حفظ (حده ٢ ميغابايت)، والملفات لا تحتمل ذلك.
     والوثيقة تحمل الاشارة وحدها: rec.signed = { file, mime, size, at }.
   ⚠ لصاحب الحساب وحده: كل مسار يفحص user_id، وملف غيرك «غير موجود» (٤٠٤ لا ٤٠٣،
     فلا يعرف وجوده). لا رابط عام ولا رابط يعيش خارج الجلسة.
   ⚠ يحذف الملف مع سجله: الجهاز يطلب حذفه عند حذف السجل، و«المصالحة» مع كل حفظ للوثيقة
     تحذف ما لم يعد سجل يشير اليه — **بعد مهلة**، فلا يحذف ملف رفع لتوه وسجله لم يبلغ
     الخادم بعد (الجهاز يرفع الملف ثم الوثيقة بعد سكون، او يسبقه حفظ من جهاز آخر).
   ⚠ الحدود: ٤ ميغابايت للملف (الصور تصغر في الجهاز الى ١٨٠٠ بكسل بجودة ٠٫٨٢ قبل الرفع)
     · ٥٠٠ ميغابايت لكل حساب.
   ⚠ النوع من بصمة الملف (اول بايتاته) لا مما يدعيه الطلب: JPEG او PDF فقط.
   =================================================================== */
const crypto = require('crypto');
const express = require('express');
const { db } = require('./db');

const MAX = 4 * 1024 * 1024;
const QUOTA = 500 * 1024 * 1024;
const GRACE_MIN = 30;                         /* مهلة المصالحة بالدقائق */
const REC_RE = /^[A-Za-z0-9_\-]{1,64}$/;
const FILE_RE = /^f[0-9a-f]{24}$/;

db.exec(`
  CREATE TABLE IF NOT EXISTS files (
    id         TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rec_id     TEXT NOT NULL,
    mime       TEXT NOT NULL,
    size       INTEGER NOT NULL,
    data       BLOB NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS files_user ON files(user_id);
`);

function sniff(b) {
  if (b.length > 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'image/jpeg';
  if (b.length > 5 && b.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  return null;
}

/* الجسم خاما حتى ٤ ميغابايت — وتجاوزه جواب JSON بلغة صاحبه لا صفحة خطأ */
function rawBody(req, res, next) {
  express.raw({ type: () => true, limit: MAX })(req, res, err => {
    if (!err) return next();
    if (err.status === 413) return res.status(413).json({ error: 'الملف أكبر من ٤ ميغابايت' });
    res.status(400).json({ error: 'تعذرت قراءة الملف' });
  });
}

/* الاشارات الى الملفات في الوثيقة: كل مفتاح «file» في اي سجل — النسخة الموقعة اليوم،
   ومرفقات اللبنة ⑥ غدا، دون تعديل هنا */
function refsOf(doc) {
  const out = new Set();
  function walk(x) {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) return x.forEach(walk);
    Object.keys(x).forEach(k => {
      if (k === 'file' && typeof x[k] === 'string') out.add(x[k]);
      else walk(x[k]);
    });
  }
  (Array.isArray(doc && doc.recs) ? doc.recs : []).forEach(walk);
  return out;
}

/* المصالحة: بعد كل حفظ للوثيقة — يحذف من ملفات صاحبها ما لا يشير اليه سجل فيها،
   ان مضت على رفعه المهلة. يعيد عدد المحذوف */
function reconcile(userId, doc) {
  const keep = refsOf(doc);
  const rows = db.prepare(`SELECT id FROM files WHERE user_id = ? AND created_at < datetime('now', ?)`)
    .all(userId, `-${GRACE_MIN} minutes`);
  const del = db.prepare('DELETE FROM files WHERE id = ? AND user_id = ?');
  let n = 0;
  rows.forEach(r => { if (!keep.has(r.id)) n += del.run(r.id, userId).changes; });
  return n;
}

/* حذف الحساب يحذف ملفاته (ينادى من معاملة dropUser في auth.js) */
function dropFor(userId) {
  return db.prepare('DELETE FROM files WHERE user_id = ?').run(userId).changes;
}

function routes(app, requireUser) {
  /* الرفع: الحارس قبل قراءة الجسم — فلا يستقبل من لا جلسة له ٤ ميغابايت */
  app.post('/api/files', requireUser, rawBody, (req, res) => {
    const rec = String(req.query.rec || '');
    if (!REC_RE.test(rec)) return res.status(400).json({ error: 'سجل غير معروف' });
    const b = req.body;
    if (!Buffer.isBuffer(b) || !b.length) return res.status(400).json({ error: 'لا ملف' });
    const mime = sniff(b);
    if (!mime) return res.status(415).json({ error: 'صورة أو PDF فقط' });
    const used = db.prepare('SELECT COALESCE(SUM(size),0) AS s FROM files WHERE user_id = ?').get(req.user.id).s;
    if (used + b.length > QUOTA) return res.status(413).json({ error: 'امتلأت مساحة مرفقاتك (٥٠٠ ميغابايت) — أزل نسخا لم تعد تلزمك' });
    const id = 'f' + crypto.randomBytes(12).toString('hex');
    db.prepare('INSERT INTO files (id,user_id,rec_id,mime,size,data) VALUES (?,?,?,?,?,?)')
      .run(id, req.user.id, rec, mime, b.length, b);
    res.json({ id, mime, size: b.length });
  });

  /* العرض: لصاحبه وحده، في الصفحة (inline)، ولا يخزن في وسيط ولا يخمن نوعه */
  app.get('/api/files/:id', requireUser, (req, res) => {
    const id = String(req.params.id);
    const f = FILE_RE.test(id) && db.prepare('SELECT mime, size, data FROM files WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!f) return res.status(404).json({ error: 'لا ملف' });
    res.setHeader('Content-Type', f.mime);
    res.setHeader('Content-Length', f.size);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.end(f.data);
  });

  app.delete('/api/files/:id', requireUser, (req, res) => {
    const n = db.prepare('DELETE FROM files WHERE id = ? AND user_id = ?').run(String(req.params.id), req.user.id).changes;
    res.json({ ok: true, deleted: n });
  });
}

module.exports = { routes, reconcile, dropFor, refsOf, MAX, QUOTA, GRACE_MIN };
