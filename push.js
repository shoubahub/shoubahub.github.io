/* ===================================================================
   شعبة · إشعارات الجوال (Web Push) — 2026-11-05، طلب المستخدم:
   «تظهر على الهاتف ولو دون فتح الموقع».
   ────────────────────────────────────────────────────────────────
   ثلاثة إشعارات لا غير (النطاق المعتمد، الخيار ٣):
     ① تحديث المنصة: مرة واحدة لكل بناء منشور، لكل جهاز مشترك.
     ② الموعد: قبله بربع ساعة، لما له وقت (المؤرخ والمتكرر أسبوعيا).
     ③ ملخص اليوم: الساعة 7:00 في أيام الدوام — حصص رئيس الشعبة ومواعيده.

   ⚠ الخادم يقرأ وثيقة الشعبة المحفوظة عنده — فما أضيف بلا إنترنت لا يعرفه
     حتى يصل. ولا يخرج من الوثيقة إلا عنوان الموعد ووقته وصف الحصة، إلى
     أجهزة صاحبها وحده.
   ⚠ مفاتيح VAPID: من متغيري البيئة إن ضبطا، وإلا تولد مرة وتحفظ في القاعدة
     (على القرص الدائم) — فلا سر في المستودع، ولا خطوة يدوية في Railway.
     وتغيرها يبطل اشتراكات الأجهزة كلها، فلا تمس.
   ⚠ كل إشعار يسجل في push_sent قبل إرساله بمفتاحه — فلا يتكرر مع إعادة
     تشغيل الخادم، ومن فاته الموعد بدقيقة (إقلاع أو نشر) يلحقه ما دام في نافذته.
   =================================================================== */
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');
const { db } = require('./db');

const TZ = process.env.PUSH_TZ || 'Asia/Kuwait';          /* توقيت المدرسة لا توقيت الخادم (Railway على UTC) */
const BEFORE = 15;                                         /* دقائق التذكير قبل الموعد */
const MORNING = 7 * 60;                                    /* الملخص: 7:00 */
const MORNING_LAST = 10 * 60;                              /* ومن فاته (إقلاع) يلحقه حتى العاشرة، وبعدها لا معنى له */
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const ORD = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة'];

db.exec(`
  /* اشتراك جهاز: العنوان يصدره متصفح الجهاز، فهو المفتاح. والجهاز لحساب واحد —
     من دخل بحساب آخر على الجهاز نفسه ينقل الاشتراك إليه */
  CREATE TABLE IF NOT EXISTS push_subs (
    endpoint   TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    p256dh     TEXT NOT NULL,
    auth       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS push_sent (
    user_id INTEGER NOT NULL,
    key     TEXT NOT NULL,
    sent_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, key)
  );
`);

/* ── المفاتيح ───────────────────────────────────────── */
function setting(k) { const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(k); return r ? r.value : null; }
function setSetting(k, v) {
  db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, String(v));
}
let KEYS = null;
function keys() {
  if (KEYS) return KEYS;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    KEYS = { publicKey: process.env.VAPID_PUBLIC_KEY.trim(), privateKey: process.env.VAPID_PRIVATE_KEY.trim() };
  } else {
    const saved = setting('vapid');
    KEYS = saved ? JSON.parse(saved) : webpush.generateVAPIDKeys();
    if (!saved) setSetting('vapid', JSON.stringify(KEYS));
  }
  webpush.setVapidDetails(process.env.PUSH_SUBJECT || 'https://shoubahubgithubio-production.up.railway.app',
    KEYS.publicKey, KEYS.privateKey);
  return KEYS;
}

/* ── الإرسال ────────────────────────────────────────── */
let sender = (sub, body, opts) => webpush.sendNotification(sub, body, opts);   /* يبدل في الفحص */
function subsOf(userId) { return db.prepare('SELECT * FROM push_subs WHERE user_id = ?').all(userId); }

/* ⚠ ٤٠٤ و٤١٠: الجهاز ألغى الاشتراك (حذف التطبيق أو منع الإذن) — يحذف فلا يطرق أبدا */
function deliver(row, msg) {
  keys();
  const sub = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
  return Promise.resolve()
    .then(() => sender(sub, JSON.stringify(msg), { TTL: msg.ttl || 3600, urgency: msg.urgency || 'normal' }))
    .then(() => true)
    .catch(e => {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) db.prepare('DELETE FROM push_subs WHERE endpoint = ?').run(row.endpoint);
      else console.error('إشعار لم يرسل:', (e && (e.statusCode || e.message)) || e);
      return false;
    });
}
/* يسجل المفتاح أولا، فإن سبق لم يرسل — الإرسال مرة واحدة ولو تكرر الفحص */
function once(userId, key, msg) {
  const info = db.prepare('INSERT OR IGNORE INTO push_sent (user_id,key) VALUES (?,?)').run(userId, key);
  if (!info.changes) return Promise.resolve(0);
  return Promise.all(subsOf(userId).map(r => deliver(r, msg))).then(a => a.filter(Boolean).length);
}

/* ── الساعة بتوقيت المدرسة ──────────────────────────── */
function clock(now) {
  const p = {};
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' })
    .formatToParts(now || new Date()).forEach(x => { p[x.type] = x.value; });
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { date: p.year + '-' + p.month + '-' + p.day, min: (+p.hour) * 60 + (+p.minute), dow, day: DAYS[dow] };
}
function mins(at) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(at || ''));
  return m ? (+m[1]) * 60 + (+m[2]) : null;
}
/* «بعد ربع ساعة» · «بعد ٣ دقائق» — والعدد بأرقام المنصة اللاتينية كالأوقات */
function inText(n) {
  if (n === 15) return 'بعد ربع ساعة';
  if (n <= 1) return 'بعد دقيقة';
  if (n === 2) return 'بعد دقيقتين';
  return 'بعد ' + n + (n <= 10 ? ' دقائق' : ' دقيقة');
}

/* ── ما يستحق الإرسال الآن — دالة خالصة (تفحص وحدها) ──────
   data: وثيقة الشعبة · self: اسم رئيس الشعبة في الجداول · c: clock() */
function eventsToday(data, c) {
  return (data.events || []).filter(e => e && (e.date ? e.date === c.date : (e.repeat === 'weekly' && e.day === c.day)));
}
/* يوم دوام: الأحد—الخميس، ولا قبل أول يوم دراسي أدخله رئيس الشعبة (كما S.schoolDay) */
function schoolDay(data, c) {
  if (c.dow > 4) return false;
  const start = data.termStart && data.term ? data.termStart[data.term] : '';
  return !(start && /^\d{4}-\d{2}-\d{2}$/.test(start) && c.date < start);
}
function selfName(data, displayName) {
  const sc = data.schedules || {};
  if (displayName && sc[displayName]) return displayName;
  /* الاسم في الحساب قد يعدل بعد إدخال الجدول — فرئيس الشعبة من له جدول وليس في قائمة معلميه */
  const t = data.teachers || [];
  const rest = Object.keys(sc).filter(n => t.indexOf(n) === -1);
  return rest.length === 1 ? rest[0] : '';
}
function due(data, c, displayName) {
  const out = [];
  if (!data || typeof data !== 'object') return out;
  const today = eventsToday(data, c);
  const weeklyOk = schoolDay(data, c);

  /* ② المواعيد ذات الوقت: من ربع الساعة قبلها حتى حلولها */
  today.forEach(e => {
    if (!e.date && !weeklyOk) return;
    const at = mins(e.at);
    if (at === null || c.min < at - BEFORE || c.min >= at) return;
    out.push({ key: 'ev:' + (e.id || e.title) + ':' + c.date, msg: {
      title: String(e.title || 'موعد').slice(0, 80),
      body: (e.type || 'موعد') + ' الساعة ' + e.at + ' — ' + inText(at - c.min) + '.',
      tag: 'ev-' + (e.id || ''), url: 'board.html', ttl: (at - c.min) * 60 } });
  });

  /* ③ ملخص اليوم: 7:00 — وما لا شيء فيه لا يرسل */
  if (weeklyOk && c.min >= MORNING && c.min < MORNING_LAST) {
    const self = selfName(data, displayName);
    const row = self ? ((data.schedules || {})[self] || {})[c.day] || [] : [];
    const periods = [];
    row.forEach((v, i) => { if (v) periods.push(ORD[i] + ' (' + String(v).split(' · ')[0] + ')'); });
    const evs = today.filter(e => e.date || weeklyOk).slice()
      .sort((a, b) => (a.at || '~') < (b.at || '~') ? -1 : (a.at || '~') > (b.at || '~') ? 1 : 0)
      .map(e => String(e.title || 'موعد') + (e.at ? ' ' + e.at : ''));
    if (periods.length || evs.length) {
      const lines = [];
      lines.push(periods.length ? 'حصصك: ' + periods.join('، ') + '.' : 'لا حصص لك اليوم.');
      if (evs.length) lines.push('مواعيدك: ' + evs.join('، ') + '.');
      out.push({ key: 'am:' + c.date, msg: { title: 'يومك: ' + c.day, body: lines.join('\n'),
        tag: 'am', url: 'board.html', ttl: (MORNING_LAST - c.min) * 60 } });
    }
  }
  return out;
}

/* ── الفحص كل دقيقة ──────────────────────────────────── */
function tick(now) {
  const c = clock(now);
  const users = db.prepare(`SELECT DISTINCT u.id, u.display_name, s.data FROM push_subs p
                            JOIN users u ON u.id = p.user_id LEFT JOIN shouba s ON s.user_id = u.id`).all();
  const jobs = [];
  users.forEach(u => {
    let data = null;
    try { data = u.data ? JSON.parse(u.data) : null; } catch (e) { return; }
    due(data, c, u.display_name).forEach(j => jobs.push(once(u.id, j.key, j.msg)));
  });
  return Promise.all(jobs);
}
function sweep() { db.prepare("DELETE FROM push_sent WHERE sent_at < datetime('now','-14 days')").run(); }

/* ── ① تحديث المنصة: عند الإقلاع، مرة لكل بناء ──────────
   ⚠ أول إقلاع بعد هذه الميزة يسجل البناء ولا يرسل — فلا يبلغ عن بناء قديم.
   ⚠ الحجز بشرط في جملة واحدة (value < build): نسختان من الخادم لحظة النشر لا ترسلان معا */
function readBuild(pub) {
  try {
    const build = +JSON.parse(fs.readFileSync(path.join(pub, 'version.json'), 'utf8')).build;
    const m = /SHOUBA_VERSION\s*=\s*'([^']+)'/.exec(fs.readFileSync(path.join(pub, 'build.js'), 'utf8'));
    return build > 0 ? { build, version: m ? m[1] : '' } : null;
  } catch (e) { return null; }
}
function announce(pub) {
  const b = readBuild(pub);
  if (!b) return Promise.resolve(0);
  if (setting('push_build') === null) { setSetting('push_build', b.build); return Promise.resolve(0); }
  const won = db.prepare("UPDATE settings SET value = ? WHERE key = 'push_build' AND CAST(value AS INTEGER) < ?").run(String(b.build), b.build).changes;
  if (!won) return Promise.resolve(0);
  const msg = { title: 'تحديث جديد لشعبة',
    body: (b.version ? 'النسخة ' + b.version + ' · ' : '') + 'بناء ' + b.build + '. المسه لفتح المنصة عليه.',
    tag: 'update', url: 'board.html', ttl: 3 * 86400 };
  const rows = db.prepare('SELECT * FROM push_subs').all();
  return Promise.all(rows.map(r => deliver(r, msg))).then(a => a.filter(Boolean).length);
}

/* ── المسارات ───────────────────────────────────────── */
function cleanSub(s) {
  if (!s || typeof s !== 'object') return null;
  const ep = String(s.endpoint || ''), k = s.keys || {};
  if (!/^https:\/\/[^\s]{10,800}$/.test(ep) || !k.p256dh || !k.auth) return null;
  if (String(k.p256dh).length > 200 || String(k.auth).length > 100) return null;
  return { endpoint: ep, p256dh: String(k.p256dh), auth: String(k.auth) };
}
function routes(app, requireUser) {
  app.get('/api/push/key', requireUser, (_req, res) => res.json({ key: keys().publicKey }));

  /* quiet: جهاز مشترك من قبل يؤكد اشتراكه عند فتح الصفحة — بلا إشعار ترحيب */
  app.post('/api/push/subscribe', requireUser, (req, res) => {
    const s = cleanSub(req.body && req.body.subscription);
    if (!s) return res.status(400).json({ error: 'اشتراك غير صالح' });
    const was = db.prepare('SELECT user_id FROM push_subs WHERE endpoint = ?').get(s.endpoint);
    db.prepare(`INSERT INTO push_subs (endpoint,user_id,p256dh,auth) VALUES (?,?,?,?)
                ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id, p256dh=excluded.p256dh, auth=excluded.auth`)
      .run(s.endpoint, req.user.id, s.p256dh, s.auth);
    const fresh = !was || was.user_id !== req.user.id;
    if (fresh && !(req.body && req.body.quiet)) {
      const row = db.prepare('SELECT * FROM push_subs WHERE endpoint = ?').get(s.endpoint);
      return deliver(row, { title: 'تفعّلت إشعارات شعبة',
        body: 'تصلك على هذا الجهاز: تحديثات المنصة، ومواعيدك قبلها بربع ساعة، وملخص يومك الساعة 7:00.',
        tag: 'hello', url: 'account.html', ttl: 600 })
        .then(sent => res.json({ ok: true, sent }));
    }
    res.json({ ok: true, sent: false });
  });

  app.post('/api/push/unsubscribe', requireUser, (req, res) => {
    const ep = String((req.body && req.body.endpoint) || '');
    db.prepare('DELETE FROM push_subs WHERE endpoint = ? AND user_id = ?').run(ep, req.user.id);
    res.json({ ok: true });
  });
}

/* ── التشغيل ────────────────────────────────────────── */
function start(pub) {
  keys();
  setInterval(() => { tick().catch(e => console.error('فحص الإشعارات:', e.message)); }, 60 * 1000).unref();
  setInterval(sweep, 6 * 60 * 60 * 1000).unref();
  sweep();
  /* بعد دقيقة من الإقلاع: يكون الخادم قد اجتاز فحص الصحة واستقر النشر */
  setTimeout(() => { announce(pub).then(n => { if (n) console.log('إشعار التحديث أرسل إلى', n, 'جهاز'); })
    .catch(e => console.error('إشعار التحديث:', e.message)); }, 60 * 1000).unref();
}

module.exports = { routes, start, tick, due, clock, announce, selfName, keys, schoolDay, mins, ORD,
  send: (sub, body, opts) => sender(sub, body, opts),   /* إشعارات المعلمين (tpush.js) تمر بالمرسل نفسه — فيبدله الفحص مرة */
  dropFor: id => { db.prepare('DELETE FROM push_subs WHERE user_id = ?').run(id); db.prepare('DELETE FROM push_sent WHERE user_id = ?').run(id); },
  _setSender: f => { sender = f; } };
