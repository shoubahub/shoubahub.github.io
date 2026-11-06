/* ===================================================================
   شعبة · إشعارات معلمي الشعبة — 2026-11-06، طلب المستخدم:
   «رابط لمعلمي الشعبة يتيح من خلاله اشعارات الجدول… او ان ارسل لهم انا ما اشاء».
   ────────────────────────────────────────────────────────────────
   النطاق المعتمد (المرحلة الأولى):
     ① رابط خاص لكل معلم، بلا حساب — ينسخه رئيس الشعبة من «ملف المعلم».
     ② تنبيهات الجدول: قبل الحصة بخمس دقائق، وعند بدايتها، وقبل نهايتها بخمس.
        والمعلم يطفئ من صفحته ما لا يريد منها (تصله الثلاثة ابتداء).
     ③ رسالة حرة يرسلها رئيس الشعبة من «المعلمون»: للكل أو لمن يختار — ولا تطفأ.
     (مواعيد التسليم: المرحلة الثانية.)

   ⚠ الرابط هو المفتاح: من عرفه فعّل إشعارات ذلك المعلم — فلا يخرج منه إلا
     اسمه وقسمه وحصصه. وإبطاله يحذف أجهزته كلها، ويصدر رابطا غيره.
   ⚠ المعلم معروف باسمه في وثيقة الشعبة (teachers / schedules): يُقرأ الجدول
     من الوثيقة المحفوظة عند الخادم في كل فحص — فما عدله رئيس الشعبة يسري.
     ومن أزيل من القائمة سكت رابطه (ولا يحذف: لو أعيد بالاسم نفسه عاد رابطه).
   ⚠ خلف بوابة التجربة نفسها (FACE_BETA) حتى يجربه أ. محمد — والبوابة في الخادم.
   ⚠ أوقات الحصص من refdata.js نفسه الذي تقرؤه الشاشات — مصدر واحد للمرحلة.
   =================================================================== */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { db } = require('./db');
const push = require('./push');
const face = require('./face');

db.exec(`
  CREATE TABLE IF NOT EXISTS teacher_links (
    token      TEXT PRIMARY KEY,               -- رمز الرابط: عشوائي، لا اسم فيه
    user_id    INTEGER NOT NULL,               -- رئيس الشعبة صاحب الرابط
    name       TEXT NOT NULL,                  -- اسم المعلم كما في وثيقة الشعبة
    prefs      TEXT NOT NULL DEFAULT '{"pre":1,"start":1,"end":1}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, name)
  );
  CREATE TABLE IF NOT EXISTS teacher_subs (
    endpoint   TEXT PRIMARY KEY,
    token      TEXT NOT NULL,
    p256dh     TEXT NOT NULL,
    auth       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS teacher_subs_token ON teacher_subs (token);
  CREATE TABLE IF NOT EXISTS teacher_sent (
    token   TEXT NOT NULL,
    key     TEXT NOT NULL,
    sent_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (token, key)
  );
`);

const TOKEN_RE = /^[0-9a-f]{16}$/;
const LEAD = 5;                                    /* قبل البداية وقبل النهاية: خمس دقائق */
const GRACE = 2;                                   /* من فاته الفحص (إقلاع أو نشر) يلحقه دقيقتين لا أكثر — بعدها لا معنى له */
const KINDS = ['pre', 'start', 'end'];

/* ── أوقات الحصص: refdata.js كما هو، في صندوق ──────────── */
let REF = null;
function ref() {
  if (REF) return REF;
  const w = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'public', 'refdata.js'), 'utf8'), { window: w });
  return (REF = w.SHOUBA_REF);
}
function periodsOf(stage) {
  const t = ref().periodTimes;
  return (t[stage] || t['ثانوي']).filter(p => !p.brk);
}

/* ── الروابط ───────────────────────────────────────── */
function newToken() {
  for (let i = 0; i < 8; i++) {
    const t = crypto.randomBytes(8).toString('hex');
    if (!db.prepare('SELECT 1 FROM teacher_links WHERE token = ?').get(t)) return t;
  }
  throw new Error('token');
}
function prefsOf(row) {
  let p = {};
  try { p = JSON.parse(row.prefs || '{}'); } catch (e) {}
  const out = {};
  KINDS.forEach(k => { out[k] = p[k] !== 0 && p[k] !== false; });
  return out;
}
function dataOf(userId) {
  const r = db.prepare('SELECT data FROM shouba WHERE user_id = ?').get(userId);
  try { return r ? JSON.parse(r.data) : null; } catch (e) { return null; }
}
function teachersOf(data) { return (data && Array.isArray(data.teachers)) ? data.teachers : []; }
/* الرابط يعمل: صاحبه في التجربة، والمعلم ما زال في قائمته */
function live(token) {
  if (!TOKEN_RE.test(String(token || ''))) return null;
  const row = db.prepare(`SELECT l.*, u.username FROM teacher_links l JOIN users u ON u.id = l.user_id
                          WHERE l.token = ?`).get(token);
  if (!row || !face.beta({ user: { username: row.username } })) return null;
  const data = dataOf(row.user_id);
  if (teachersOf(data).indexOf(row.name) === -1) return null;
  return { row, data };
}
function dropLink(token) {
  db.prepare('DELETE FROM teacher_subs WHERE token = ?').run(token);
  db.prepare('DELETE FROM teacher_sent WHERE token = ?').run(token);
  db.prepare('DELETE FROM teacher_links WHERE token = ?').run(token);
}

/* ── الإرسال ────────────────────────────────────────── */
function deliver(row, msg) {
  push.keys();
  const sub = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
  return Promise.resolve()
    .then(() => push.send(sub, JSON.stringify(msg), { TTL: msg.ttl || 3600, urgency: msg.urgency || 'normal' }))
    .then(() => true)
    .catch(e => {
      /* الجهاز ألغى الاشتراك — يحذف فلا يطرق أبدا */
      if (e && (e.statusCode === 404 || e.statusCode === 410)) db.prepare('DELETE FROM teacher_subs WHERE endpoint = ?').run(row.endpoint);
      else console.error('إشعار معلم لم يرسل:', (e && (e.statusCode || e.message)) || e);
      return false;
    });
}
function subsOf(token) { return db.prepare('SELECT * FROM teacher_subs WHERE token = ?').all(token); }
function toTeacher(token, msg) {
  return Promise.all(subsOf(token).map(r => deliver(r, msg))).then(a => a.filter(Boolean).length);
}
function once(token, key, msg) {
  const info = db.prepare('INSERT OR IGNORE INTO teacher_sent (token,key) VALUES (?,?)').run(token, key);
  if (!info.changes) return Promise.resolve(0);
  return toTeacher(token, msg);
}

/* ── تنبيهات الجدول — دالة خالصة (تفحص وحدها) ──────────
   data: وثيقة الشعبة · name: المعلم · prefs · c: push.clock() */
function due(data, name, prefs, c, token) {
  const out = [];
  if (!data || teachersOf(data).indexOf(name) === -1) return out;
  if (!push.schoolDay(data, c)) return out;
  const row = (((data.schedules || {})[name]) || {})[c.day] || [];
  const url = '/t/' + (token || '');
  periodsOf(data.stage).forEach(p => {
    const slot = String(row[p.n - 1] || '').trim();
    if (!slot) return;
    const from = push.mins(p.from), to = push.mins(p.to);
    if (from === null || to === null) return;
    const ord = push.ORD[p.n - 1] || String(p.n);
    const what = slot.split('·').map(x => x.trim()).filter(Boolean).join(' · ');
    const hit = (target, cap) => c.min >= target && c.min < Math.min(target + GRACE, cap);
    const add = (kind, msg) => out.push({ key: kind + ':' + p.n + ':' + c.date,
      msg: Object.assign({ tag: 'p' + p.n, url, ttl: 5 * 60, urgency: 'high' }, msg) });

    if (prefs.pre && hit(from - LEAD, from))
      add('pre', { title: 'حصتك ' + ord + ' بعد ' + (from - c.min) + ' دقائق', body: what + '، من ' + p.from + ' إلى ' + p.to + '.' });
    if (prefs.start && hit(from, to))
      add('start', { title: 'بدأت حصتك ' + ord, body: what + '، حتى ' + p.to + '.' });
    if (prefs.end && hit(to - LEAD, to))
      add('end', { title: 'بقيت ' + (to - c.min) + ' دقائق على نهاية حصتك ' + ord, body: 'اختم درسك. ' + what + '، تنتهي ' + p.to + '.' });
  });
  return out;
}

/* ── الفحص كل دقيقة ──────────────────────────────────── */
function tick(now) {
  const c = push.clock(now);
  const rows = db.prepare(`SELECT DISTINCT l.token FROM teacher_links l JOIN teacher_subs s ON s.token = l.token`).all();
  const jobs = [];
  rows.forEach(r => {
    const L = live(r.token);
    if (!L) return;
    due(L.data, L.row.name, prefsOf(L.row), c, L.row.token).forEach(j => jobs.push(once(L.row.token, j.key, j.msg)));
  });
  return Promise.all(jobs);
}
function sweep() { db.prepare("DELETE FROM teacher_sent WHERE sent_at < datetime('now','-3 days')").run(); }

/* ── المسارات ───────────────────────────────────────── */
function cleanSub(s) {
  if (!s || typeof s !== 'object') return null;
  const ep = String(s.endpoint || ''), k = s.keys || {};
  if (!/^https:\/\/[^\s]{10,800}$/.test(ep) || !k.p256dh || !k.auth) return null;
  if (String(k.p256dh).length > 200 || String(k.auth).length > 100) return null;
  return { endpoint: ep, p256dh: String(k.p256dh), auth: String(k.auth) };
}
function clip(s, n) { return String(s == null ? '' : s).replace(/\s+\n/g, '\n').trim().slice(0, n); }

function routes(app, requireUser) {
  /* خارج التجربة: ٤٠٤ كأن لا باب — والشاشات تخفي أبوابها على ذلك */
  const gate = (req, res, next) => (face.beta(req) ? next() : res.status(404).json({ error: 'لا إشعارات للمعلمين' }));

  /* ① روابط معلمي شعبتي وحال أجهزتهم */
  app.get('/api/tpush/links', requireUser, gate, (req, res) => {
    const names = teachersOf(dataOf(req.user.id));
    const rows = db.prepare(`SELECT l.token, l.name, l.prefs, (SELECT COUNT(*) FROM teacher_subs s WHERE s.token = l.token) AS devices
                             FROM teacher_links l WHERE l.user_id = ?`).all(req.user.id);
    res.json({ links: rows.filter(r => names.indexOf(r.name) > -1)
      .map(r => ({ name: r.name, token: r.token, devices: r.devices, prefs: prefsOf(r) })) });
  });

  /* ② رابط المعلم: يعاد إن وجد، وينشأ إن لم يوجد — renew: يبطل القديم وأجهزته ويصدر غيره */
  app.post('/api/tpush/link', requireUser, gate, (req, res) => {
    const name = String((req.body && req.body.name) || '');
    if (teachersOf(dataOf(req.user.id)).indexOf(name) === -1)
      return res.status(400).json({ error: 'المعلم ليس في شعبتك على الخادم بعد — انتظر حتى تحفظ المنصة' });
    let r = db.prepare('SELECT * FROM teacher_links WHERE user_id = ? AND name = ?').get(req.user.id, name);
    if (r && req.body.renew) { dropLink(r.token); r = null; }
    if (!r) {
      db.prepare('INSERT INTO teacher_links (token,user_id,name) VALUES (?,?,?)').run(newToken(), req.user.id, name);
      r = db.prepare('SELECT * FROM teacher_links WHERE user_id = ? AND name = ?').get(req.user.id, name);
    }
    res.json({ name, token: r.token, devices: subsOf(r.token).length, prefs: prefsOf(r) });
  });

  /* ③ الرسالة الحرة: للكل أو لأسماء — تصل من فعّل وحده، ولا تطفأ */
  app.post('/api/tpush/send', requireUser, gate, (req, res) => {
    const b = req.body || {};
    const title = clip(b.title, 60), body = clip(b.body, 300);
    if (!body) return res.status(400).json({ error: 'اكتب نص الرسالة' });
    const names = teachersOf(dataOf(req.user.id));
    const to = b.to === 'all' ? names : (Array.isArray(b.to) ? b.to.filter(n => names.indexOf(n) > -1) : []);
    if (!to.length) return res.status(400).json({ error: 'اختر من تصله الرسالة' });
    const links = db.prepare('SELECT token, name FROM teacher_links WHERE user_id = ?').all(req.user.id)
      .filter(l => to.indexOf(l.name) > -1);
    const msg = { title: title || 'رسالة من رئيس الشعبة', body, ttl: 24 * 3600, urgency: 'high' };
    Promise.all(links.map(l => toTeacher(l.token, Object.assign({ url: '/t/' + l.token, tag: 'm' + Date.now() }, msg))))
      .then(a => res.json({ ok: true, teachers: a.filter(n => n > 0).length, devices: a.reduce((x, y) => x + y, 0), chosen: to.length,
        subscribed: links.filter(l => subsOf(l.token).length).length }));
  });

  /* ── ما يفتحه المعلم برابطه: بلا حساب، والرمز وحده بوابته ── */
  const T = (req, res) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const L = live(req.params.token);
    if (!L) { res.status(404).json({ error: 'هذا الرابط لم يعد يعمل — اطلب من رئيس الشعبة رابطا جديدا' }); return null; }
    return L;
  };
  app.get('/api/t/:token', (req, res) => {
    const L = T(req, res); if (!L) return;
    res.json({ name: L.row.name, department: L.data.department || '', school: L.data.school || '',
      prefs: prefsOf(L.row), key: push.keys().publicKey, devices: subsOf(L.row.token).length });
  });
  app.post('/api/t/:token/subscribe', (req, res) => {
    const L = T(req, res); if (!L) return;
    const s = cleanSub(req.body && req.body.subscription);
    if (!s) return res.status(400).json({ error: 'اشتراك غير صالح' });
    const was = db.prepare('SELECT token FROM teacher_subs WHERE endpoint = ?').get(s.endpoint);
    /* ⚠ الرابط لجهاز واحد (قرار المستخدم 2026-11-06: «كيف نضمن ان من لديه الرابط هو معلمي بالشعبة؟»):
       ما دام جهاز مفعلا عليه فلا يفعل غيره — فمن نسخ الرابط بعد تفعيله لم ينتفع به. ومن احتاج جهازا آخر
       اوقف الاول من صفحته، او اصدر له رئيس الشعبة رابطا جديدا */
    const other = db.prepare('SELECT 1 FROM teacher_subs WHERE token = ? AND endpoint <> ?').get(L.row.token, s.endpoint);
    if (other) return res.status(409).json({ error: 'هذا الرابط مفعّل على جهاز آخر', locked: true });
    db.prepare(`INSERT INTO teacher_subs (endpoint,token,p256dh,auth) VALUES (?,?,?,?)
                ON CONFLICT(endpoint) DO UPDATE SET token=excluded.token, p256dh=excluded.p256dh, auth=excluded.auth`)
      .run(s.endpoint, L.row.token, s.p256dh, s.auth);
    if ((!was || was.token !== L.row.token) && !(req.body && req.body.quiet)) {
      const row = db.prepare('SELECT * FROM teacher_subs WHERE endpoint = ?').get(s.endpoint);
      return deliver(row, { title: 'تفعّلت إشعارات شعبة', body: 'تصلك على هذا الجهاز تنبيهات حصصك، ورسائل رئيس الشعبة.',
        tag: 'hello', url: '/t/' + L.row.token, ttl: 600 }).then(sent => res.json({ ok: true, sent }));
    }
    res.json({ ok: true, sent: false });
  });
  app.post('/api/t/:token/unsubscribe', (req, res) => {
    const L = T(req, res); if (!L) return;
    db.prepare('DELETE FROM teacher_subs WHERE endpoint = ? AND token = ?').run(String((req.body && req.body.endpoint) || ''), L.row.token);
    res.json({ ok: true });
  });
  app.put('/api/t/:token/prefs', (req, res) => {
    const L = T(req, res); if (!L) return;
    /* الاختيار للجهاز المفعل وحده — لا لمن فتح الرابط من غيره */
    if (!db.prepare('SELECT 1 FROM teacher_subs WHERE token = ? AND endpoint = ?').get(L.row.token, String((req.body && req.body.endpoint) || '')))
      return res.status(409).json({ error: 'فعّل الإشعارات على هذا الجهاز أولاً', locked: true });
    const cur = prefsOf(L.row), b = req.body || {};
    KINDS.forEach(k => { if (k in b) cur[k] = !!b[k]; });
    const p = {}; KINDS.forEach(k => { p[k] = cur[k] ? 1 : 0; });
    db.prepare('UPDATE teacher_links SET prefs = ? WHERE token = ?').run(JSON.stringify(p), L.row.token);
    res.json({ prefs: cur });
  });

  /* الصفحة وملفا التطبيق: /t/<الرمز> · /t/<الرمز>/manifest.webmanifest · /t/sw.js
     ⚠ عامل خدمة مستقل بمجال /t/ — فلا يحمل جهاز المعلم ملفات المنصة كلها، ولا يمس عامل رئيس الشعبة */
  app.get('/t/sw.js', (_req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.sendFile(path.join(__dirname, 'public', 't-sw.js'));
  });
  app.get('/t/:token/manifest.webmanifest', (req, res) => {
    const L = T(req, res); if (!L) return;
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.end(JSON.stringify({ name: 'شعبة · إشعاراتي', short_name: 'شعبة', lang: 'ar', dir: 'rtl',
      start_url: '/t/' + L.row.token, scope: '/t/', display: 'standalone', orientation: 'portrait',
      background_color: '#EFE6D6', theme_color: '#16456E',
      icons: [{ src: '/identity/assets/app-icon-approved.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] }));
  });
  /* ⚠ الرابط الباطل او المبطل: الصفحة نفسها بهويتها ورده ٤٠٤ — وهي تسأل api/t/<الرمز> فتقول «لم يعد يعمل»
     بعناصرها لا بصفحة بيضاء (رصد معاينة السلوك، النسخة 0.37.0 · بناء 129) */
  app.get('/t/:token', (req, res) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.status(live(req.params.token) ? 200 : 404).sendFile(path.join(__dirname, 'public', 't.html'));
  });
}

/* الملفان في public فتخدمهما الملفات الساكنة لكل طارق — وطريقهما /t/<الرمز> و/t/sw.js وحدهما،
   فمباشرة ٤٠٤ كـface.html. ⚠ توصل قبل express.static في server.js */
function pages(app) {
  app.get(['/t.html', '/t-sw.js'], (_req, res) => res.status(404).type('text').send('Not found'));
}

function start() {
  setInterval(() => { tick().catch(e => console.error('فحص إشعارات المعلمين:', e.message)); }, 60 * 1000).unref();
  setInterval(sweep, 6 * 60 * 60 * 1000).unref();
  sweep();
}

module.exports = { routes, pages, start, tick, due, prefsOf, periodsOf };
