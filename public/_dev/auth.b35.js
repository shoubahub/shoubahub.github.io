/* ===================================================================
   شعبة · المصادقة
   ────────────────────────────────────────────────────────────────
   اسم مستخدم + رقم سرّي من ستّة أرقام. على أجهزتهم الخاصّة، فلا يُرى.

   ⚠ الرقم يُخزَّن **مُجزَّأً بـscrypt** لا نصّاً: الخادم يقارن ولا يقرأ.
     فلا يراه المدير ولا مَن قرأ القاعدة — ولا في لوحة الإدارة «إظهار»
     بل **«إعادة تعيين»** فقط (قرار المستخدم 2026-09-08).

   ⚠ ولا رقم إدارةٍ افتراضي: في موقع التوقّعات يعود إلى «1234» إن نُسي
     المتغيّر — بابٌ يُفتح والموقع يبدو سليماً. وهنا **يرفض الخادم أن يبدأ**.
   =================================================================== */
const crypto = require('crypto');
const { db, invite } = require('./db');

const SESSION_DAYS = 180;                 /* الجلسة تدوم فلا يُعاد الدخول كل يوم */
const PIN_RE = /^\d{6}$/;
const USER_RE = /^[A-Za-z0-9_.\-]{3,24}$/;

/* ── تجزئة الرقم ───────────────────────────────────── */
function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(pin, salt, 32).toString('hex');
  return salt + ':' + key;
}
function verifyPin(pin, stored) {
  const [salt, key] = String(stored).split(':');
  if (!salt || !key) return false;
  const test = crypto.scryptSync(pin, salt, 32);
  const known = Buffer.from(key, 'hex');
  return known.length === test.length && crypto.timingSafeEqual(known, test);
}

/* ── حدّ المحاولات: فلا يُخمَّن رقمٌ بالتكرار ────────── */
const tries = new Map();                  /* اسم ⟵ { n, until } */
function blocked(username) {
  const t = tries.get(username);
  return !!(t && t.until > Date.now());
}
function fail(username) {
  const t = tries.get(username) || { n: 0, until: 0 };
  t.n += 1;
  if (t.n >= 5) { t.until = Date.now() + 10 * 60 * 1000; t.n = 0; }   /* ١٠ دقائق */
  tries.set(username, t);
}
function pass(username) { tries.delete(username); }

/* ── الجلسات ───────────────────────────────────────── */
function sha(t) { return crypto.createHash('sha256').update(t).digest('hex'); }

function openSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const exp = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString().slice(0, 19).replace('T', ' ');
  db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').run(sha(token), userId, exp);
  return token;
}
function userOf(token) {
  if (!token) return null;
  const row = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
                          WHERE s.token_hash = ? AND s.expires_at > datetime('now')`).get(sha(token));
  return row || null;
}
function closeSession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(token));
}

/* ── الكعكة: httpOnly فلا يبلغها كودُ الصفحة ───────── */
const COOKIE = 'shouba_s';
function readCookie(req) {
  const raw = req.headers.cookie || '';
  const hit = raw.split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='));
  return hit ? decodeURIComponent(hit.slice(COOKIE.length + 1)) : null;
}
function setCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie',
    `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`);
}
function clearCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

/* ── حارس المستخدم ─────────────────────────────────── */
function requireUser(req, res, next) {
  const u = userOf(readCookie(req));
  if (!u) return res.status(401).json({ error: 'لم تسجّل الدخول' });
  req.user = u;
  next();
}

/* ── حارس الإدارة ──────────────────────────────────── */
const ADMIN_PIN = process.env.ADMIN_PIN;
function requireAdmin(req, res, next) {
  const given = req.headers['x-admin-pin'] || (req.body && req.body.adminPin);
  if (!given || String(given) !== String(ADMIN_PIN)) {
    return res.status(403).json({ error: 'رقم الإدارة غير صحيح' });
  }
  next();
}

/* ── المسارات ──────────────────────────────────────── */
function routes(app) {
  /* تسجيل حساب جديد — لا يتمّ بلا رمز دعوة */
  app.post('/api/register', (req, res) => {
    const { username = '', pin = '', displayName = '', inviteCode = '' } = req.body || {};
    const u = String(username).trim().toLowerCase();
    if (!USER_RE.test(u)) return res.status(400).json({ error: 'اسم المستخدم: ٣–٢٤ حرفاً إنجليزياً أو رقماً' });
    if (!PIN_RE.test(pin)) return res.status(400).json({ error: 'الرقم السرّي ستّة أرقام' });
    if (String(displayName).trim().length < 3) return res.status(400).json({ error: 'اكتب اسمك الكامل' });
    if (String(inviteCode).trim().toUpperCase() !== invite())
      return res.status(403).json({ error: 'رمز الدعوة غير صحيح — اطلبه من رئيس الشعبة' });
    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(u))
      return res.status(409).json({ error: 'اسم المستخدم مأخوذ' });

    const info = db.prepare('INSERT INTO users (username,pin_hash,display_name) VALUES (?,?,?)')
      .run(u, hashPin(pin), String(displayName).trim());
    const token = openSession(info.lastInsertRowid);
    setCookie(res, token);
    res.json({ username: u, displayName: String(displayName).trim() });
  });

  /* الدخول */
  app.post('/api/login', (req, res) => {
    const { username = '', pin = '' } = req.body || {};
    const u = String(username).trim().toLowerCase();
    if (blocked(u)) return res.status(429).json({ error: 'محاولات كثيرة — أعِد بعد عشر دقائق' });
    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(u);
    if (!row || !verifyPin(String(pin), row.pin_hash)) {
      fail(u);
      return res.status(401).json({ error: 'اسم المستخدم أو الرقم السرّي غير صحيح' });
    }
    pass(u);
    db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(row.id);
    setCookie(res, openSession(row.id));
    res.json({ username: row.username, displayName: row.display_name });
  });

  app.post('/api/logout', (req, res) => {
    closeSession(readCookie(req));
    clearCookie(res);
    res.json({ ok: true });
  });

  app.get('/api/me', (req, res) => {
    const u = userOf(readCookie(req));
    if (!u) return res.status(401).json({ error: 'لم تسجّل الدخول' });
    res.json({ username: u.username, displayName: u.display_name });
  });

  /* ── وثيقة الشعبة ───────────────────────────────── */
  app.get('/api/data', requireUser, (req, res) => {
    const row = db.prepare('SELECT data, updated_at FROM shouba WHERE user_id = ?').get(req.user.id);
    res.json({ data: row ? JSON.parse(row.data) : null, updatedAt: row ? row.updated_at : null });
  });

  app.put('/api/data', requireUser, (req, res) => {
    const d = req.body && req.body.data;
    if (!d || typeof d !== 'object') return res.status(400).json({ error: 'بيانات غير صالحة' });
    db.prepare(`INSERT INTO shouba (user_id,data,updated_at) VALUES (?,?,datetime('now'))
                ON CONFLICT(user_id) DO UPDATE SET data=excluded.data, updated_at=datetime('now')`)
      .run(req.user.id, JSON.stringify(d));
    res.json({ ok: true });
  });

  /* ── الإدارة: وصفٌ فقط ─────────────────────────────
     ⚠ لا مسارَ يعيد محتوى شعبةِ أحد. عمداً — لا سهواً.
       يرى المدير: مَن سجّل، ومتى، وهل أتمّ إعداده. ولا يرى جدولاً
       ولا معلّماً ولا سجلاً (قرار المستخدم 2026-09-08). */
  app.get('/api/admin/users', requireAdmin, (_req, res) => {
    const rows = db.prepare(`
      SELECT u.id, u.username, u.display_name, u.created_at, u.last_login,
             CASE WHEN s.user_id IS NULL THEN 0 ELSE 1 END AS has_data,
             s.updated_at AS data_updated,
             LENGTH(COALESCE(s.data,'')) AS size
      FROM users u LEFT JOIN shouba s ON s.user_id = u.id
      ORDER BY u.created_at DESC`).all();
    /* ⚠ الحجم بالبايت وصفٌ لا محتوى — يدلّ على أن ثمّة عملاً، لا على ما فيه */
    res.json({ users: rows });
  });

  app.post('/api/admin/users/:id/reset-pin', requireAdmin, (req, res) => {
    const pin = String((req.body && req.body.pin) || '');
    if (!PIN_RE.test(pin)) return res.status(400).json({ error: 'الرقم الجديد ستّة أرقام' });
    const info = db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hashPin(pin), req.params.id);
    if (!info.changes) return res.status(404).json({ error: 'لا حساب بهذا الرقم' });
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.params.id);   /* جلساته تُغلق */
    res.json({ ok: true });
  });

  app.get('/api/admin/invite', requireAdmin, (_req, res) => res.json({ code: invite() }));
  app.post('/api/admin/invite', requireAdmin, (_req, res) => res.json({ code: require('./db').newInvite() }));
}

module.exports = { routes, requireAdmin, ADMIN_PIN };
