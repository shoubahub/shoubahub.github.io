/* ===================================================================
   شعبة · واجهة الشعبة المنشورة (المرحلة الرابعة أ — 2026-09-20)
   ────────────────────────────────────────────────────────────────
   صفحة يفتحها المدير والموجه الفني والمدراء المساعدون برابط، بلا حساب.

   ⚠ نسخة منشورة لا عرض لحظي: ما لم ينشره رئيس الشعبة بقراره غير موجود
     على الرابط اصلا — لا محجوب يمكن كشفه، بل غير مرسل.
   ⚠ والمنشور بيانات لا صورة: الجدول ينشر كما هو، وحساب «الحصة الجارية»
     يجري في جهاز الزائر بساعته. فاللقطة تقرأ حية بلا ان تتسرب.
   ⚠ بوابة الصور: لا يفتح مسار المرفقات للعامة ابدا — بل مسار ثان لا
     يخدم الا ملفا مسجلا في face_files، اي ملفا نشره صاحبه بيده. فمحاضر
     الاجتماعات وشواهد الخطة لا تمس ولو عرف معرفها.
   ⚠ هذا الملف لا يعرف شكل الواجهة: يخزن ما يرسل كما هو ويلتقط منه
     معرفات الملفات وحدها — فتتطور الشاشات بلا ان يمس الخادم.
   =================================================================== */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { db } = require('./db');

db.exec(`
  CREATE TABLE IF NOT EXISTS face (
    user_id INTEGER PRIMARY KEY,
    slug    TEXT    NOT NULL UNIQUE,     -- رمز الرابط: عشوائي، لا اسم فيه ولا مدرسة
    data    TEXT    NOT NULL DEFAULT '', -- النسخة المنشورة · فارغ = لم تنشر بعد
    at      TEXT    NOT NULL DEFAULT '', -- متى نشرت
    rev     INTEGER NOT NULL DEFAULT 0   -- كم مرة نشرت
  );
  CREATE TABLE IF NOT EXISTS face_files (
    file_id TEXT    PRIMARY KEY,         -- ملف اذن صاحبه بعرضه، وحده يخرج للزائر
    user_id INTEGER NOT NULL,
    at      TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS face_files_user ON face_files (user_id);
`);

const MAX = 512 * 1024;                  /* النسخة المنشورة: نص لا صور — والصور في الخزانة */
const FILE_RE = /^f[0-9a-f]{24}$/;
const SLUG_RE = /^[0-9a-f]{10}$/;

/* ══ بوابة التجربة (قرار المستخدم 2026-09-20) ══════════════════════════
   الواجهة تطوير خاص بصاحب المنصة، وزملاؤه في التجربة لا يرونها.
   ⚠ والبوابة في الخادم لا في الشاشة: من اظهر السطر بحيلة في متصفحه
     لم يجد خلفه مسارا يستجيب. والشاشات تسال «/api/face/me» فما ردت
     ٤٠٤ اختفى بابها — بوابة واحدة لا بابان ينسى احدهما.
   ⚠ وخاليا = مغلق على الجميع لا مفتوح: نسيانه على Railway لا يفتحه لاحد.
   ⚠ ويعلن عن نفسه عند الاقلاع — فلا تبحث عن خلل في مكان آخر. */
const BETA = String(process.env.FACE_BETA || '').split(/[,\s]+/).filter(Boolean).map(s => s.toLowerCase());
console.log(BETA.length
  ? `واجهة الشعبة: مقصورة على ${BETA.join(' · ')}`
  : 'واجهة الشعبة: مغلقة على الجميع — اضبط FACE_BETA باسم المستخدم لفتحها لك');
function beta(req) { return !!req.user && BETA.indexOf(String(req.user.username || '').toLowerCase()) > -1; }
/* خارج التجربة: ٤٠٤ لا ٤٠٣ — فالشاشة تخفي بابها، ولا يعلم احد ان هنا بابا */
function gate(req, res, next) { return beta(req) ? next() : res.status(404).json({ error: 'لا واجهة' }); }

function newSlug() {
  for (let i = 0; i < 8; i++) {
    const s = crypto.randomBytes(5).toString('hex');
    if (!db.prepare('SELECT 1 FROM face WHERE slug = ?').get(s)) return s;
  }
  throw new Error('slug');
}
/* سطر الشعبة، وينشأ برمزه اول طلب — فالرمز ثابت من اول يوم ولو لم ينشر بعد */
function rowFor(userId) {
  let r = db.prepare('SELECT * FROM face WHERE user_id = ?').get(userId);
  if (!r) {
    db.prepare('INSERT INTO face (user_id, slug) VALUES (?,?)').run(userId, newSlug());
    r = db.prepare('SELECT * FROM face WHERE user_id = ?').get(userId);
  }
  return r;
}
/* معرفات الملفات في النسخة المنشورة — اينما وردت، فلا يقيد شكل الواجهة */
function filesIn(v, out) {
  out = out || new Set();
  if (typeof v === 'string') { if (FILE_RE.test(v)) out.add(v); return out; }
  if (Array.isArray(v)) { v.forEach(x => filesIn(x, out)); return out; }
  if (v && typeof v === 'object') { Object.keys(v).forEach(k => filesIn(v[k], out)); return out; }
  return out;
}
function noIndex(res) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
}

function routes(app, requireUser) {
  /* ① حال واجهتي: الرمز ومتى نشرت وكم مرة — لشاشة «واجهة شعبتك» */
  app.get('/api/face/me', requireUser, gate, (req, res) => {
    const r = rowFor(req.user.id);
    res.json({ slug: r.slug, at: r.at, rev: r.rev, published: !!r.data });
  });

  /* ② النشر: يستبدل النسخة كلها، ويعيد بناء اذن الصور من جديد — فالصورة التي
     حذفها رئيس الشعبة من واجهته تسقط من الاذن في اللحظة نفسها */
  app.post('/api/face/publish', requireUser, gate, (req, res) => {
    const data = req.body && req.body.data;
    if (!data || typeof data !== 'object') return res.status(400).json({ error: 'لا نسخة' });
    const text = JSON.stringify(data);
    if (Buffer.byteLength(text) > MAX) return res.status(413).json({ error: 'النسخة أكبر مما يحتمل الرابط' });

    const r = rowFor(req.user.id);
    /* الملفات المذكورة فيها وهي لصاحبها فعلا — لا ينشر احد ملف غيره بمعرفه */
    const mine = new Set(db.prepare('SELECT id FROM files WHERE user_id = ?').all(req.user.id).map(x => x.id));
    const ids = [...filesIn(data)].filter(id => mine.has(id));
    const at = new Date().toISOString();

    db.transaction(() => {
      db.prepare('UPDATE face SET data = ?, at = ?, rev = rev + 1 WHERE user_id = ?').run(text, at, req.user.id);
      db.prepare('DELETE FROM face_files WHERE user_id = ?').run(req.user.id);
      const ins = db.prepare('INSERT OR REPLACE INTO face_files (file_id, user_id, at) VALUES (?,?,?)');
      ids.forEach(id => ins.run(id, req.user.id, at));
    })();

    res.json({ slug: r.slug, at, rev: r.rev + 1, files: ids.length });
  });

  /* ③ سحب النشر: الرابط يعود فارغا والصور تغلق — والرمز باق فلا يتبدل رابط ارسله */
  app.delete('/api/face/publish', requireUser, gate, (req, res) => {
    rowFor(req.user.id);
    db.transaction(() => {
      db.prepare("UPDATE face SET data = '', at = '' WHERE user_id = ?").run(req.user.id);
      db.prepare('DELETE FROM face_files WHERE user_id = ?').run(req.user.id);
    })();
    res.json({ ok: true, published: false });
  });

  /* ④ القراءة العامة: بلا حساب ولا جلسة — وما لم ينشر لا يوجد */
  app.get('/api/face/:slug', (req, res) => {
    noIndex(res);
    const slug = String(req.params.slug || '');
    const r = SLUG_RE.test(slug) && db.prepare('SELECT data, at FROM face WHERE slug = ?').get(slug);
    if (!r || !r.data) return res.status(404).json({ error: 'لا واجهة على هذا الرابط' });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ at: r.at, data: JSON.parse(r.data) }));
  });

  /* ⑤ بوابة الملف المنشور: لا تسال ألزائر جلسة؟ بل أهذا الملف مما نشر صاحبه؟
     ولا تخزن في وسيط — فسحب النشر يغلق الصورة في الحال لا بعد حين */
  app.get('/api/pub/file/:id', (req, res) => {
    noIndex(res);
    const id = String(req.params.id || '');
    const f = FILE_RE.test(id) && db.prepare(
      'SELECT f.mime AS mime, f.size AS size, f.data AS data FROM face_files p JOIN files f ON f.id = p.file_id AND f.user_id = p.user_id WHERE p.file_id = ?'
    ).get(id);
    if (!f) return res.status(404).json({ error: 'لا ملف' });
    res.setHeader('Content-Type', f.mime);
    res.setHeader('Content-Length', f.size);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.end(f.data);
  });

  /* ⑥ الصفحة نفسها: /face/<الرمز> — تبنى في المرحلة (ج)، وحتى تبنى يرد سطر صريح
     لا صفحة الدخول (SPA fallback كان يحول الزائر الى تسجيل الدخول فيبدو الرابط معطوبا) */
  /* ⚠ صفحة الزائر مغلقة ما دامت الواجهة غير مفعلة (2026-10-17، شرط المستخدم: «لا رابط يعمل ما دام FACE_BETA غير
     مضبوط»): كانت ترد ٢٠٠ بصفحة «قيد الإنشاء» — بلا بيانات، لكنه رابط يرد. والآن ٤٠٤ كأن المسار لا وجود له.
     ⚠ وبوابتها «هل فعلت الواجهة اصلا» لا gate: الزائر بلا حساب، فـgate (وهو يسأل عن مستخدم التجربة) يغلقها
       عليه حتى بعد ضبط FACE_BETA — والرابط انما وجد للزائر. */
  app.get('/face/:slug', (req, res) => {
    if (!BETA.length) return res.status(404).json({ error: 'لا واجهة' });
    noIndex(res);
    const page = path.join(__dirname, 'public', 'face.html');
    if (fs.existsSync(page)) return res.sendFile(page);
    res.status(200).type('html').send('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8">'
      + '<meta name="robots" content="noindex, nofollow">'
      + '<title>واجهة الشعبة</title><body style="font-family:system-ui;padding:40px;text-align:center">'
      + 'واجهة الشعبة قيد الإنشاء.</body></html>');
  });
}

module.exports = { routes, filesIn };
