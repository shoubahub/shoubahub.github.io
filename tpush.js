/* ===================================================================
   شعبة · إشعارات معلمي الشعبة — 2026-11-06، طلب المستخدم:
   «رابط لمعلمي الشعبة يتيح من خلاله اشعارات الجدول… او ان ارسل لهم انا ما اشاء».
   ────────────────────────────────────────────────────────────────
   النطاق المعتمد (المرحلة الأولى):
     ① رابط خاص لكل معلم، بلا حساب — ينسخه رئيس الشعبة من «ملف المعلم».
     ② تنبيهات الجدول: قبل الحصة بخمس دقائق، وعند بدايتها، وقبل نهايتها بخمس.
        والمعلم يطفئ من صفحته ما لا يريد منها (تصله الثلاثة ابتداء).
     ③ رسالة حرة يرسلها رئيس الشعبة من «المعلمون»: للكل أو لمن يختار — ولا تطفأ.
     ④ مواعيد التسليم (المرحلة الثانية، 2026-11-06): يضيفها رئيس الشعبة من «المعلمون» بعنوان وتاريخ، للكل أو لمن
        يختار — في وثيقة الشعبة (deadlines). تنبيهان 7:00: آخر يوم دراسي قبل الموعد، ويوم الموعد. ومن أشّر له
        «سُلّم» لا يصله ما بقي. ويرى المعلم مواعيده القادمة في «إشعاراتي».

   ⚠ الرابط وحده لا يفتح شيئا (2026-11-08، اقتراح المستخدم: «ارسله للمعلم المعين ثم يصلني زر تفعيل او قبول»):
     من فتحه طلب القبول من جهازه، فيصل رئيس الشعبة إشعار وبند في «بحاجة إلى إجراء» — ولا يرى صاحب الطلب
     شيئا حتى يقبله. والجهاز كعكة tdev (عشوائية، httpOnly). ولكل معلم جهاز واحد مقبول: قبول جديد يوقف القديم.
     وعلى آيفون لا يطلب من سفاري، بل من أيقونة الشاشة الرئيسية (لكل منهما كعكاته فيكونان جهازين).
     وإبطال الرابط يحذف أجهزته وطلباته كلها، ويصدر رابطا غيره.
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
  CREATE TABLE IF NOT EXISTS teacher_devices (
    did        TEXT NOT NULL,                  -- كعكة الجهاز
    token      TEXT NOT NULL,
    label      TEXT NOT NULL,                  -- «آيفون» · «أندرويد» … للعرض على رئيس الشعبة
    state      TEXT NOT NULL DEFAULT 'pending',-- pending · ok · no (رفض) · gone (قبل غيره بعده، او ألغاه)
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    decided_at TEXT,
    PRIMARY KEY (did, token)
  );
  CREATE TABLE IF NOT EXISTS teacher_sent (
    token   TEXT NOT NULL,
    key     TEXT NOT NULL,
    sent_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (token, key)
  );
`);

/* الاشتراك لجهاز مقبول: device = كعكته. وما سبق الميزة بلا جهاز — يحذف، فيطلب كل جهاز القبول من جديد
   (قرار المستخدم 2026-11-08: «٢») */
if (!db.prepare("SELECT 1 FROM pragma_table_info('teacher_subs') WHERE name = 'device'").get())
  db.exec('ALTER TABLE teacher_subs ADD COLUMN device TEXT');
db.exec('DELETE FROM teacher_subs WHERE device IS NULL');

const TOKEN_RE = /^[0-9a-f]{16}$/;
const DID_RE = /^[0-9a-f]{32}$/;
const MAX_PENDING = 3;                             /* طلبات معلقة لرابط واحد — فلا يغرق رئيس الشعبة بطلبات عبث */
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
/* واجهة الشعبة المنشورة (face.js) — ويعمل هذا الملف بلا جدولها ان لم ينشأ بعد */
function faceOf(userId) {
  try { const r = db.prepare("SELECT data, at FROM face WHERE user_id = ? AND data <> ''").get(userId); return r || null; }
  catch (e) { return null; }
}
function dropLink(token) {
  db.prepare('DELETE FROM teacher_devices WHERE token = ?').run(token);
  db.prepare('DELETE FROM teacher_subs WHERE token = ?').run(token);
  db.prepare('DELETE FROM teacher_sent WHERE token = ?').run(token);
  db.prepare('DELETE FROM teacher_links WHERE token = ?').run(token);
}

/* ── الأجهزة: الطلب والقبول (2026-11-08) ───────────────── */
function didOf(req) {
  const hit = String(req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('tdev='));
  const v = hit ? hit.slice(5) : '';
  return DID_RE.test(v) ? v : '';
}
function setDid(res, did) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append('Set-Cookie', `tdev=${did}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${2 * 365 * 86400}${secure}`);
}
function labelOf(ua) {
  ua = String(ua || '');
  if (/iPhone|iPod/.test(ua)) return 'آيفون';
  if (/iPad/.test(ua)) return 'آيباد';
  if (/Android/.test(ua)) return 'أندرويد';
  if (/Macintosh/.test(ua)) return 'ماك';
  if (/Windows/.test(ua)) return 'حاسوب ويندوز';
  return 'جهاز';
}
function deviceOf(token, did) {
  return did ? db.prepare('SELECT rowid AS id, * FROM teacher_devices WHERE token = ? AND did = ?').get(token, did) : null;
}
function stateOf(token, did) { const d = deviceOf(token, did); return d ? d.state : 'none'; }
const iso = t => (t ? String(t).replace(' ', 'T') + 'Z' : '');
/* قبول جهاز: يوقف المقبول قبله واشتراكاته — فلكل معلم جهاز واحد (قرار المستخدم 05:11) */
function accept(row) {
  db.prepare("SELECT did FROM teacher_devices WHERE token = ? AND state = 'ok' AND did <> ?").all(row.token, row.did)
    .forEach(o => db.prepare('DELETE FROM teacher_subs WHERE token = ? AND device = ?').run(row.token, o.did));
  db.prepare("UPDATE teacher_devices SET state = 'gone', decided_at = datetime('now') WHERE token = ? AND state = 'ok' AND did <> ?").run(row.token, row.did);
  db.prepare("UPDATE teacher_devices SET state = 'ok', decided_at = datetime('now') WHERE token = ? AND did = ?").run(row.token, row.did);
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
/* اشتراكات الجهاز المقبول وحده — فما بقي من جهاز أوقف لا يصله شيء */
function subsOf(token) {
  return db.prepare(`SELECT s.* FROM teacher_subs s JOIN teacher_devices d ON d.token = s.token AND d.did = s.device AND d.state = 'ok'
                     WHERE s.token = ?`).all(token);
}
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

/* ── مواعيد التسليم (المرحلة الثانية) ───────────────────
   في وثيقة الشعبة: deadlines = [{ id, title, date: YYYY-MM-DD, to: [أسماء], done: [من سلّم] }]
   ⚠ التنبيه 7:00 — ومن فاته (موعد أضيف بعدها، او خادم كان متوقفا) يلحقه يومه حتى 20:00، لا بعدها */
const DL_FROM = 7 * 60, DL_TO = 20 * 60;
const WEEK = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
function utc(iso) { const p = iso.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); }
function addDays(iso, n) { const d = utc(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function dowOf(iso) { return utc(iso).getUTCDay(); }
/* يوم التنبيه الأول: اليوم السابق للموعد، فإن كان عطلة (الجمعة والسبت) فآخر يوم دراسي قبله (قرار المستخدم 17:36) */
function alertDay(iso) { let p = addDays(iso, -1); while (dowOf(p) > 4) p = addDays(p, -1); return p; }
function dayMonth(iso) { const p = iso.split('-'); return (+p[2]) + ' ' + (ref().months[+p[1] - 1] || ''); }
/* «اليوم» · «غداً» · «الأحد 15 نوفمبر» */
function whenText(iso, today) {
  if (iso === today) return 'اليوم';
  if (iso === addDays(today, 1)) return 'غداً';
  return WEEK[dowOf(iso)] + ' ' + dayMonth(iso);
}
function deadlinesOf(data, name) {
  return (data && Array.isArray(data.deadlines) ? data.deadlines : []).filter(d => d && typeof d.id === 'string'
    && String(d.title || '').trim() && ISO_RE.test(String(d.date || ''))
    && Array.isArray(d.to) && d.to.indexOf(name) > -1 && !(Array.isArray(d.done) && d.done.indexOf(name) > -1));
}
/* ما يستحق الإرسال الآن من مواعيد المعلم — دالة خالصة */
function dueDeadlines(data, name, c, token) {
  const out = [];
  if (!data || teachersOf(data).indexOf(name) === -1) return out;
  if (c.min < DL_FROM || c.min >= DL_TO) return out;
  const url = '/t/' + (token || '') + '#' + encodeURIComponent('إشعاراتي');
  deadlinesOf(data, name).forEach(d => {
    const title = String(d.title).trim(), m = { body: title, tag: 'dl' + d.id, url, ttl: 12 * 3600, urgency: 'high' };
    if (c.date === alertDay(d.date))
      out.push({ key: 'dl:' + d.id + ':pre:' + d.date,
        msg: Object.assign({ title: (d.date === addDays(c.date, 1) ? 'غداً' : WEEK[dowOf(d.date)]) + ' موعد تسليم' }, m) });
    if (c.date === d.date)
      out.push({ key: 'dl:' + d.id + ':day:' + d.date, msg: Object.assign({ title: 'اليوم موعد تسليم' }, m) });
  });
  return out;
}
/* مواعيده القادمة لصفحته: ما لم يسلّمه، من اليوم فصاعدا، بالأقرب */
function upcoming(data, name, today) {
  return deadlinesOf(data, name).filter(d => d.date >= today).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map(d => ({ title: String(d.title).trim(), date: d.date, when: whenText(d.date, today) }));
}

/* ── الفحص كل دقيقة ──────────────────────────────────── */
function tick(now) {
  const c = push.clock(now);
  const rows = db.prepare(`SELECT DISTINCT l.token FROM teacher_links l JOIN teacher_subs s ON s.token = l.token`).all();
  const jobs = [];
  rows.forEach(r => {
    const L = live(r.token);
    if (!L) return;
    due(L.data, L.row.name, prefsOf(L.row), c, L.row.token).concat(dueDeadlines(L.data, L.row.name, c, L.row.token))
      .forEach(j => jobs.push(once(L.row.token, j.key, j.msg)));
  });
  return Promise.all(jobs);
}
/* ⚠ مفتاح تنبيه الموعد يحمل تاريخه، ولا يعود يومه بعد مضيه — فثلاثة أيام تكفي هنا ايضا */
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
    res.json({ links: rows.filter(r => names.indexOf(r.name) > -1).map(r => {
      const ok = db.prepare("SELECT label, decided_at FROM teacher_devices WHERE token = ? AND state = 'ok'").get(r.token);
      return { name: r.name, token: r.token, devices: subsOf(r.token).length, prefs: prefsOf(r),
        device: ok ? { label: ok.label, at: iso(ok.decided_at) } : null, pending: pendingOf(r.token) };
    }) });
  });
  function pendingOf(token) {
    return db.prepare("SELECT rowid AS id, label, created_at FROM teacher_devices WHERE token = ? AND state = 'pending' ORDER BY created_at")
      .all(token).map(d => ({ id: d.id, label: d.label, at: iso(d.created_at) }));
  }

  /* ①ب طلبات القبول المعلقة — لبند «بحاجة إلى إجراء» في اللوحة */
  app.get('/api/tpush/requests', requireUser, gate, (req, res) => {
    const names = teachersOf(dataOf(req.user.id));
    const out = [];
    db.prepare('SELECT token, name FROM teacher_links WHERE user_id = ?').all(req.user.id)
      .filter(l => names.indexOf(l.name) > -1)
      .forEach(l => pendingOf(l.token).forEach(p => out.push(Object.assign({ name: l.name }, p))));
    res.json({ requests: out.sort((a, b) => (a.at < b.at ? -1 : 1)) });
  });
  /* ①ج القبول او الرفض: ok=true يقبل (ويوقف المقبول قبله) · false يرفض — والمرفوض لا يعيد الطلب */
  app.post('/api/tpush/decide', requireUser, gate, (req, res) => {
    const b = req.body || {};
    const row = db.prepare(`SELECT d.rowid AS id, d.*, l.name FROM teacher_devices d JOIN teacher_links l ON l.token = d.token
                            WHERE d.rowid = ? AND l.user_id = ?`).get(Number(b.id) || 0, req.user.id);
    if (!row) return res.status(404).json({ error: 'هذا الطلب لم يعد قائماً' });
    if (row.state !== 'pending') return res.status(409).json({ error: 'حُسم هذا الطلب من قبل', state: row.state });
    if (b.ok) accept(row);
    else db.prepare("UPDATE teacher_devices SET state = 'no', decided_at = datetime('now') WHERE rowid = ?").run(row.id);
    res.json({ ok: true, name: row.name, state: b.ok ? 'ok' : 'no' });
  });
  /* ①د إلغاء الجهاز المقبول من ملف المعلم: يتوقف الرابط عليه، ولا يعود إلا بطلب جديد */
  app.post('/api/tpush/drop', requireUser, gate, (req, res) => {
    const l = db.prepare('SELECT token FROM teacher_links WHERE user_id = ? AND name = ?').get(req.user.id, String((req.body && req.body.name) || ''));
    if (!l) return res.status(404).json({ error: 'لا رابط لهذا المعلم' });
    db.prepare("SELECT did FROM teacher_devices WHERE token = ? AND state = 'ok'").all(l.token)
      .forEach(o => db.prepare('DELETE FROM teacher_subs WHERE token = ? AND device = ?').run(l.token, o.did));
    db.prepare("UPDATE teacher_devices SET state = 'gone', decided_at = datetime('now') WHERE token = ? AND state = 'ok'").run(l.token);
    res.json({ ok: true });
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
  /* المقبول وحده: ما لم يقبل جهازه رئيس الشعبة فلا شيء غير حاله (قرار المستخدم 05:06: «٢» الصفحة كلها) */
  const A = (req, res) => {
    const L = T(req, res); if (!L) return null;
    const st = stateOf(L.row.token, didOf(req));
    if (st !== 'ok') { res.status(403).json({ error: 'بانتظار موافقة رئيس الشعبة', state: st }); return null; }
    return Object.assign(L, { did: didOf(req) });
  };
  app.get('/api/t/:token', (req, res) => {
    const L = T(req, res); if (!L) return;
    const st = stateOf(L.row.token, didOf(req));
    if (st !== 'ok') return res.json({ state: st });
    res.json({ state: 'ok', name: L.row.name, department: L.data.department || '', school: L.data.school || '',
      prefs: prefsOf(L.row), key: push.keys().publicKey,
      devices: db.prepare('SELECT COUNT(*) AS n FROM teacher_subs WHERE token = ? AND device = ?').get(L.row.token, didOf(req)).n,
      deadlines: upcoming(L.data, L.row.name, push.clock().date) });
  });
  /* الواجهة المنشورة لصاحب الرابط — كما تقرؤها /api/face/<الرمز> بلا زيادة */
  /* طلب القبول من هذا الجهاز: مرة واحدة — وما سبق طلبه يرد حاله ولا يعيد الإشعار */
  app.post('/api/t/:token/ask', (req, res) => {
    const L = T(req, res); if (!L) return;
    let did = didOf(req);
    const cur = deviceOf(L.row.token, did);
    if (cur) return res.json({ state: cur.state });
    const n = db.prepare("SELECT COUNT(*) AS n FROM teacher_devices WHERE token = ? AND state = 'pending'").get(L.row.token).n;
    if (n >= MAX_PENDING) return res.status(429).json({ error: 'طلبات كثيرة على هذا الرابط. اطلب من رئيس الشعبة أن ينظر فيها.' });
    if (!did) { did = crypto.randomBytes(16).toString('hex'); setDid(res, did); }
    const label = labelOf(req.headers['user-agent']);
    db.prepare('INSERT INTO teacher_devices (did, token, label) VALUES (?,?,?)').run(did, L.row.token, label);
    push.toUser(L.row.user_id, { title: 'طلب فتح رابط أ. ' + L.row.name, body: 'من ' + label + '. اقبله أو ارفضه من ملفه.',
      tag: 'ask' + L.row.token, url: '/teacher.html?t=' + encodeURIComponent(L.row.name) + '&link=1', ttl: 24 * 3600, urgency: 'high' })
      .catch(() => 0).then(() => res.json({ state: 'pending' }));
  });
  app.get('/api/t/:token/face', (req, res) => {
    const L = A(req, res); if (!L) return;
    const f = faceOf(L.row.user_id);
    if (!f) return res.status(404).json({ error: 'لا واجهة منشورة' });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ at: f.at, data: JSON.parse(f.data) }));
  });
  app.post('/api/t/:token/subscribe', (req, res) => {
    const L = A(req, res); if (!L) return;
    const s = cleanSub(req.body && req.body.subscription);
    if (!s) return res.status(400).json({ error: 'اشتراك غير صالح' });
    const was = db.prepare('SELECT token, device FROM teacher_subs WHERE endpoint = ?').get(s.endpoint);
    /* ⚠ الرابط لجهاز واحد: كان قفل «أول من فعّل» (0.37.3 · بناء 132)، وصار القبول (2026-11-08) — فالاشتراك
       للجهاز المقبول وحده، وما بقي لغيره على هذا الرابط يحذف */
    db.prepare('DELETE FROM teacher_subs WHERE token = ? AND device <> ?').run(L.row.token, L.did);
    db.prepare(`INSERT INTO teacher_subs (endpoint,token,p256dh,auth,device) VALUES (?,?,?,?,?)
                ON CONFLICT(endpoint) DO UPDATE SET token=excluded.token, p256dh=excluded.p256dh, auth=excluded.auth, device=excluded.device`)
      .run(s.endpoint, L.row.token, s.p256dh, s.auth, L.did);
    if ((!was || was.token !== L.row.token || was.device !== L.did) && !(req.body && req.body.quiet)) {
      const row = db.prepare('SELECT * FROM teacher_subs WHERE endpoint = ?').get(s.endpoint);
      return deliver(row, { title: 'تفعّلت إشعارات شعبة', body: 'تصلك على هذا الجهاز تنبيهات حصصك، ورسائل رئيس الشعبة.',
        tag: 'hello', url: '/t/' + L.row.token, ttl: 600 }).then(sent => res.json({ ok: true, sent }));
    }
    res.json({ ok: true, sent: false });
  });
  app.post('/api/t/:token/unsubscribe', (req, res) => {
    const L = A(req, res); if (!L) return;
    db.prepare('DELETE FROM teacher_subs WHERE endpoint = ? AND token = ?').run(String((req.body && req.body.endpoint) || ''), L.row.token);
    res.json({ ok: true });
  });
  app.put('/api/t/:token/prefs', (req, res) => {
    const L = A(req, res); if (!L) return;
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
    const L = live(req.params.token);
    /* رابط واحد للمعلم (قرار المستخدم 2026-11-06: «الا يمكن دمجهم برابط واحد؟»): الواجهة المنشورة ومعها
       تبويب «إشعاراتي» — وما لم تنشر الواجهة فصفحة الإشعارات وحدها */
    /* وما لم يقبل جهازه: صفحة الإشعارات تقول حاله وتطلب القبول (2026-11-08) */
    const page = L && stateOf(L.row.token, didOf(req)) === 'ok' && faceOf(L.row.user_id) ? 'face.html' : 't.html';
    res.status(L ? 200 : 404).sendFile(path.join(__dirname, 'public', page));
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

module.exports = { routes, pages, start, tick, due, dueDeadlines, upcoming, alertDay, prefsOf, periodsOf };
