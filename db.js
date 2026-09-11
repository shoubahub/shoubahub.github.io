/* ===================================================================
   شعبة · طبقة القاعدة
   ────────────────────────────────────────────────────────────────
   SQLite في الخادم نفسه — على منوال wc2026-server الذي جرّبه المستخدم.

   ⚠ المسار من متغيّر البيئة DB_PATH لا من مجلّد الكود:
     على Railway الكتابة في مجلّد النشر **مؤقّتة**، تُمحى مع كل نشرة.
     فيُوجَّه إلى **قرصٍ دائم (Volume)** وإلّا ضاعت سجلّات الزملاء.
     (رُصدت في floor-game، واحتاط لها موقع التوقّعات بالمتغيّر نفسه.)

   ⚠ بيانات الشعبة **وثيقةٌ واحدة** كما هي في المتصفّح اليوم — لا تُفكَّك:
     لا استعلامات عبر الشُّعب ولا تقارير مجمّعة تستدعي التفكيك، والترحيل
     بهذا يصير نسخاً لا تحويلاً. ويوم تلزم التقارير نفكّك حينئذٍ.
   =================================================================== */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dir = process.env.DB_PATH || __dirname;
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(path.join(dir, 'shouba.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    username     TEXT UNIQUE NOT NULL,
    pin_hash     TEXT NOT NULL,          -- بصمةٌ لا تُعكس · لا الرقم نفسه
    display_name TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    last_login   TEXT
  );

  /* وثيقة الشعبة كما هي — نصُّ JSON واحد لكل مستخدم */
  CREATE TABLE IF NOT EXISTS shouba (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data       TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  /* الجلسات: يُخزَّن **هاش** الرمز لا الرمز — فمن قرأ القاعدة لا ينتحل جلسة */
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  /* الملاحظات (2026-09-11): يكتبها المستخدم بنفسه من زر «ملاحظة» فتصل لوحة الادارة.
     لا شيء فيها من بيانات الشعبة — النص والنوع والشاشة ورقم البناء فقط. وتحذف مع حسابها. */
  CREATE TABLE IF NOT EXISTS feedback (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind       TEXT,
    page       TEXT,
    build      TEXT,
    text       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    read_at    TEXT
  );
`);

/* ⚠ رقم المراجعة (rev) — يرتفع مع كل حفظ، وبه يُعرف الترتيب لا بساعة جهاز
   (2026-09-10). القواعد القائمة قبله تُرحَّل هنا: الصفوف الموجودة تبدأ من ١،
   فلا يلتبس «لا بيانات» (٠) بـ«بياناتٌ لم تُرقَّم». */
const shoubaCols = db.prepare('PRAGMA table_info(shouba)').all().map(c => c.name);
if (!shoubaCols.includes('rev')) db.exec('ALTER TABLE shouba ADD COLUMN rev INTEGER NOT NULL DEFAULT 1');

/* رمز الدعوة: بلا رمزٍ صحيح لا يُنشأ حساب مهما عُرف الرابط */
function invite() {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('invite');
  if (row) return row.value;
  const code = newInvite();
  return code;
}
function newInvite() {
  const code = require('crypto').randomBytes(4).toString('hex').toUpperCase();
  db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run('invite', code);
  return code;
}

/* تنظيف الجلسات المنتهية — يُنادى عند الإقلاع وكل ساعة */
function sweep() {
  db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
}
sweep();
setInterval(sweep, 60 * 60 * 1000).unref();

module.exports = { db, invite, newInvite, dir };
