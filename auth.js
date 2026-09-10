/* ===================================================================
   شعبة · المصادقة
   ────────────────────────────────────────────────────────────────
   اسم مستخدم + رقم سري من ستة أرقام. على أجهزتهم الخاصة، فلا يرى.

   ⚠ الرقم يخزن **مجزأ بـscrypt** لا نصا: الخادم يقارن ولا يقرأ.
     فلا يراه المدير ولا من قرأ القاعدة — ولا في لوحة الإدارة «إظهار»
     بل **«إعادة تعيين»** فقط (قرار المستخدم 2026-09-08).

   ⚠ ولا رقم إدارة افتراضي: في موقع التوقعات يعود إلى «1234» إن نسي
     المتغير — باب يفتح والموقع يبدو سليما. وهنا **يرفض الخادم أن يبدأ**.
   =================================================================== */
const crypto = require('crypto');
const { db, invite } = require('./db');

const SESSION_DAYS = 180;                 /* الجلسة تدوم فلا يعاد الدخول كل يوم */
const PIN_RE = /^\d{6}$/;
const USER_RE = /^[A-Za-z0-9_.\-]{3,24}$/;

/* ── الأرقام العربية ⟵ إنجليزية ──────────────────────
   ⚠ لوحة الأرقام على جهاز لغته العربية تكتب ٠١٢٣ لا 0123، فكان رقم الإدارة
     الصحيح يرفض (رصده المستخدم 2026-09-10). الرقم رقم بأي لوحة كتب.
     يطبق هنا لا في الصفحة وحدها: الخادم لا يثق بأن الصفحة نظفت. */
function latin(s) {
  return String(s == null ? '' : s)
    .replace(/[٠-٩]/g, d => d.charCodeAt(0) - 0x0660)
    .replace(/[۰-۹]/g, d => d.charCodeAt(0) - 0x06F0)
    .trim();
}

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

/* ── حد المحاولات: فلا يخمن رقم بالتكرار ────────── */
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

/* ── الكعكة: httpOnly فلا يبلغها كود الصفحة ───────── */
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

/* ── مفتاح صاحب النسخة المحلية ──────────────────────
   ⚠ بمعرف الحساب لا باسمه (2026-09-11): الاسم يعاد تسجيله بعد حذف حسابه، فكانت
     نسخة باقية على الجهاز ترتفع إلى الحساب الجديد ذي الاسم نفسه. والمعرف لا يعاد
     أبدا (AUTOINCREMENT). و«#» لا يقع في اسم مستخدم، فلا يلتبس اسم كـ«u3» بمفتاح. */
function ownerKey(u) { return '#' + u.id; }

/* ── حارس المستخدم ─────────────────────────────────── */
function requireUser(req, res, next) {
  const u = userOf(readCookie(req));
  if (!u) return res.status(401).json({ error: 'لم تسجل الدخول' });
  req.user = u;
  next();
}

/* ── حارس الإدارة ──────────────────────────────────── */
/* ⚠ قيمة المتغير تنظف كما ينظف المدخل: مسافة زائدة أو علامتا تنصيص
   تلصقان في لوحة Railway فيرفض الرقم الصحيح ولا يدري صاحبه لماذا. */
const RAW_ADMIN = process.env.ADMIN_PIN;
const ADMIN_PIN = latin(RAW_ADMIN).replace(/^(['"])(.*)\1$/, '$2');
if (ADMIN_PIN) {
  /* بصمة في سجل الخادم لا الرقم: طوله ونوعه — يكفي للتشخيص ولا يكشفه */
  console.log(`رقم الإدارة مضبوط: ${ADMIN_PIN.length} خانات`
    + (/^\d+$/.test(ADMIN_PIN) ? ' · أرقام فقط' : ' · فيه غير الأرقام')
    + (String(RAW_ADMIN) !== ADMIN_PIN ? ' · نظف من مسافات أو علامات تنصيص أو أرقام عربية' : ''));
}
function requireAdmin(req, res, next) {
  /* ⚠ Node يقرأ الترويسة حروفا لاتينية (latin1)، فالرقم العربي فيها يصل بايتات
     مشوهة لا يطابقها التحويل (رصد في الفحص 2026-09-10) — يعاد فكها UTF-8 أولا.
     والصفحة ترسله إنجليزيا أصلا؛ هذا لمن يطرق الخادم من غيرها. */
  const h = req.headers['x-admin-pin'];
  const given = latin(h ? Buffer.from(String(h), 'latin1').toString('utf8') : (req.body && req.body.adminPin));
  if (!ADMIN_PIN || !given || given !== ADMIN_PIN) {
    return res.status(403).json({ error: 'رقم الإدارة غير صحيح' });
  }
  next();
}

/* ── المسارات ──────────────────────────────────────── */
function routes(app) {
  /* تسجيل حساب جديد — لا يتم بلا رمز دعوة */
  app.post('/api/register', (req, res) => {
    const { username = '', pin = '', displayName = '', inviteCode = '' } = req.body || {};
    const u = latin(username).toLowerCase();
    const p = latin(pin);
    if (!USER_RE.test(u)) return res.status(400).json({ error: 'اسم المستخدم: ٣–٢٤ حرفا إنجليزيا أو رقما' });
    if (!PIN_RE.test(p)) return res.status(400).json({ error: 'الرقم السري ستة أرقام' });
    if (String(displayName).trim().length < 3) return res.status(400).json({ error: 'اكتب اسمك الكامل' });
    if (latin(inviteCode).toUpperCase() !== invite())
      return res.status(403).json({ error: 'رمز الدعوة غير صحيح — اطلبه من رئيس الشعبة' });
    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(u))
      return res.status(409).json({ error: 'اسم المستخدم مأخوذ' });

    const info = db.prepare('INSERT INTO users (username,pin_hash,display_name) VALUES (?,?,?)')
      .run(u, hashPin(p), String(displayName).trim());
    const token = openSession(info.lastInsertRowid);
    setCookie(res, token);
    res.json({ username: u, displayName: String(displayName).trim() });
  });

  /* الدخول */
  app.post('/api/login', (req, res) => {
    const { username = '', pin = '' } = req.body || {};
    const u = latin(username).toLowerCase();
    if (blocked(u)) return res.status(429).json({ error: 'محاولات كثيرة — أعد بعد عشر دقائق' });
    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(u);
    if (!row || !verifyPin(latin(pin), row.pin_hash)) {
      fail(u);
      return res.status(401).json({ error: 'اسم المستخدم أو الرقم السري غير صحيح' });
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
    if (!u) return res.status(401).json({ error: 'لم تسجل الدخول' });
    res.json({ username: u.username, displayName: u.display_name, owner: ownerKey(u) });
  });

  /* ── وثيقة الشعبة ───────────────────────────────── */
  /* ⚠ «user» في الجواب: النسخة المحلية تربط بصاحبها، فمن دخل بحساب آخر
     على الجهاز نفسه لا يرى بيانات من قبله ولا يعرض عليه «خلاف» معها. */
  app.get('/api/data', requireUser, (req, res) => {
    const row = db.prepare('SELECT data, rev, updated_at FROM shouba WHERE user_id = ?').get(req.user.id);
    res.json({ data: row ? JSON.parse(row.data) : null, rev: row ? row.rev : 0,
               updatedAt: row ? row.updated_at : null, user: req.user.username, owner: ownerKey(req.user) });
  });

  /* الكتابة المشروطة (optimistic concurrency): يرسل الجهاز «بنيت على المراجعة N».
     فإن كان على الخادم غيرها فقد سبقه جهاز آخر، فيرفض (409) ويعاد إليه
     ما على الخادم — **ولا يحسم الخلاف بقاعدة صامتة بل يعرض على صاحبه**.
     ⚠ الفحص والكتابة في معاملة واحدة، فلا يتسلل بينهما حفظ ثالث. */
  const writeDoc = db.transaction((userId, d, base) => {
    const row = db.prepare('SELECT data, rev, updated_at FROM shouba WHERE user_id = ?').get(userId);
    const cur = row ? row.rev : 0;
    if (base !== cur) return { conflict: true, rev: cur,
      data: row ? JSON.parse(row.data) : null, updatedAt: row ? row.updated_at : null };
    const next = cur + 1;
    db.prepare(`INSERT INTO shouba (user_id,data,rev,updated_at) VALUES (?,?,?,datetime('now'))
                ON CONFLICT(user_id) DO UPDATE SET data=excluded.data, rev=excluded.rev, updated_at=datetime('now')`)
      .run(userId, JSON.stringify(d), next);
    return { ok: true, rev: next };
  });

  app.put('/api/data', requireUser, (req, res) => {
    const d = req.body && req.body.data;
    if (!d || typeof d !== 'object' || Array.isArray(d)) return res.status(400).json({ error: 'بيانات غير صالحة' });
    const base = Number.isInteger(req.body.baseRev) ? req.body.baseRev : 0;
    const out = writeDoc(req.user.id, d, base);
    if (out.conflict) return res.status(409).json(Object.assign({ error: 'conflict' }, out));
    res.json(out);
  });

  /* ── الإدارة: وصف فقط ─────────────────────────────
     ⚠ لا مسار يعيد محتوى شعبة أحد. عمدا — لا سهوا.
       يرى المدير: من سجل، ومتى، وهل أتم إعداده. ولا يرى جدولا
       ولا معلما ولا سجلا (قرار المستخدم 2026-09-08). */
  app.get('/api/admin/users', requireAdmin, (_req, res) => {
    const rows = db.prepare(`
      SELECT u.id, u.username, u.display_name, u.created_at, u.last_login,
             CASE WHEN s.user_id IS NULL THEN 0 ELSE 1 END AS has_data,
             s.updated_at AS data_updated,
             LENGTH(COALESCE(s.data,'')) AS size
      FROM users u LEFT JOIN shouba s ON s.user_id = u.id
      ORDER BY u.created_at DESC`).all();
    /* ⚠ الحجم بالبايت وصف لا محتوى — يدل على أن ثمة عملا، لا على ما فيه */
    res.json({ users: rows });
  });

  app.post('/api/admin/users/:id/reset-pin', requireAdmin, (req, res) => {
    const pin = latin(req.body && req.body.pin);
    if (!PIN_RE.test(pin)) return res.status(400).json({ error: 'الرقم الجديد ستة أرقام' });
    const info = db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hashPin(pin), req.params.id);
    if (!info.changes) return res.status(404).json({ error: 'لا حساب بهذا الرقم' });
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.params.id);   /* جلساته تغلق */
    res.json({ ok: true });
  });

  /* حذف حساب (طلب المستخدم 2026-09-10) — **نهائي**: الحساب وجلساته ووثيقة شعبته
     في معاملة واحدة، فلا يبقى نصفه.
     ⚠ لا نسخة عند الإدارة — فالإدارة لا ترى المحتوى أصلا؛ ومن أراد الاحتفاظ بشعبته
       يصدرها من إعداداته قبل الحذف.
     ⚠ والتأكيد يفحص هنا لا في الصفحة وحدها: اسم المستخدم مكتوبا كما هو، فلا
       يحذف حسابا طلب أرسل خطأ أو زر ضغط سهوا. */
  const dropUser = db.transaction(id => {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM shouba WHERE user_id = ?').run(id);
    return db.prepare('DELETE FROM users WHERE id = ?').run(id).changes;
  });
  app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
    const u = db.prepare('SELECT id, username FROM users WHERE id = ?').get(req.params.id);
    if (!u) return res.status(404).json({ error: 'لا حساب بهذا الرقم' });
    const said = latin(req.body && req.body.confirm).replace(/^@/, '').toLowerCase();
    if (said !== u.username) return res.status(400).json({ error: 'اكتب اسم المستخدم كما هو للتأكيد' });
    dropUser(u.id);
    tries.delete(u.username);
    res.json({ ok: true });
  });

  app.get('/api/admin/invite', requireAdmin, (_req, res) => res.json({ code: invite() }));
  app.post('/api/admin/invite', requireAdmin, (_req, res) => res.json({ code: require('./db').newInvite() }));
}

module.exports = { routes, requireAdmin, ADMIN_PIN };
