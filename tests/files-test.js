// اختبار المرفقات — node tests/files-test.js (2026-09-12)
// قاعدة مؤقتة في مجلد مؤقت (DB_PATH) وتطبيق express بمسارات files.js نفسها، وحارس يحاكي الجلسة
// بمعرف في ترويسة الاختبار — فلا حساب يدخل به ولا رقم سري ولا جلسة. وصفا المستخدمين في القاعدة
// المؤقتة لقيد المفتاح الاجنبي وحده (بصمة رقم «x» لا يدخل بها احد)، وتحذف القاعدة بعد الاختبار.
const os = require('os'), fs = require('fs'), path = require('path'), http = require('http');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shouba-files-'));
process.env.DB_PATH = tmp;

const express = require('express');
const { db } = require('../db');
const files = require('../files');
const auth = require('../auth');

db.prepare("INSERT INTO users (id, username, pin_hash, display_name) VALUES (1,'t1','x','أ'),(2,'t2','x','ب')").run();

const app = express();
app.use(express.json({ limit: '2mb' }));
const fake = (req, res, next) => {
  const id = Number(req.headers['x-test-user']);
  if (!id) return res.status(401).json({ error: 'لم تسجل الدخول' });
  req.user = { id }; next();
};
files.routes(app, fake);

let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? '— ' + JSON.stringify(extra) : ''); } };

const srv = app.listen(0, run);
function call(method, url, user, body, type) {
  return new Promise((done, no) => {
    const headers = {};
    if (user) headers['x-test-user'] = String(user);
    if (body) { headers['Content-Type'] = type || 'application/octet-stream'; headers['Content-Length'] = body.length; }
    const r = http.request({ port: srv.address().port, method, path: url, headers }, res => {
      const ch = [];
      res.on('data', c => ch.push(c));
      res.on('end', () => {
        const b = Buffer.concat(ch); let j = null;
        try { j = JSON.parse(b.toString()); } catch (e) {}
        done({ status: res.statusCode, headers: res.headers, body: b, json: j });
      });
    });
    r.on('error', no);
    if (body) r.write(body);
    r.end();
  });
}

const JPEG = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.alloc(2000, 7)]);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\n%%EOF');

async function run() {
  try {
    ok(typeof auth.requireUser === 'function', 'auth.js يحمل مع files.js ويصدر حارس المستخدم');

    // الرفع
    ok((await call('POST', '/api/files?rec=r1', 0, JPEG, 'image/jpeg')).status === 401, 'بلا جلسة: لا رفع (٤٠١)');
    const up = await call('POST', '/api/files?rec=r1', 1, JPEG, 'image/jpeg');
    ok(up.status === 200 && /^f[0-9a-f]{24}$/.test(up.json.id) && up.json.mime === 'image/jpeg' && up.json.size === JPEG.length, 'يرفع صورة JPEG ويعيد معرفها ونوعها وحجمها', up.json);
    const upPdf = await call('POST', '/api/files?rec=r2', 1, PDF, 'application/pdf');
    ok(upPdf.status === 200 && upPdf.json.mime === 'application/pdf', 'يرفع PDF', upPdf.json);
    const lie = await call('POST', '/api/files?rec=r1', 1, Buffer.from('<html>not an image</html>'), 'image/jpeg');
    ok(lie.status === 415, 'النوع من بصمة الملف لا من ترويسة الطلب: نص يدعي انه صورة يرفض', lie.status);
    ok((await call('POST', '/api/files?rec=bad/../id', 1, JPEG)).status === 400, 'معرف سجل غير صالح يرفض');
    const big = await call('POST', '/api/files?rec=r1', 1, Buffer.concat([JPEG, Buffer.alloc(files.MAX)]), 'image/jpeg');
    ok(big.status === 413 && big.json && /٤ ميغابايت/.test(big.json.error), 'اكبر من ٤ ميغابايت: ٤١٣ برسالة عربية لا صفحة خطأ', big.json);

    // العرض لصاحبه وحده
    const id = up.json.id;
    const g = await call('GET', '/api/files/' + id, 1);
    ok(g.status === 200 && g.body.equals(JPEG) && g.headers['content-type'] === 'image/jpeg', 'صاحبه يفتحه كما رفعه');
    ok(/no-store/.test(g.headers['cache-control']) && g.headers['x-content-type-options'] === 'nosniff' && g.headers['content-disposition'] === 'inline',
      'لا يخزن في وسيط ولا يخمن نوعه ويعرض في الصفحة', g.headers);
    ok((await call('GET', '/api/files/' + id, 2)).status === 404, 'غير صاحبه: «غير موجود» (٤٠٤ لا ٤٠٣)');
    ok((await call('GET', '/api/files/' + id, 0)).status === 401, 'بلا جلسة: لا عرض');
    ok((await call('HEAD', '/api/files/' + id, 1)).status === 200, 'HEAD يفحص البلوغ دون تحميله');
    const d2 = await call('DELETE', '/api/files/' + id, 2);
    ok(d2.json.deleted === 0 && (await call('GET', '/api/files/' + id, 1)).status === 200, 'غير صاحبه لا يحذفه');

    // المصالحة
    const doc = { recs: [{ id: 'r1', signed: { file: id, mime: 'image/jpeg' } }, { id: 'r9', values: { x: [{ file: 'fnone' }] } }] };
    ok(files.refsOf(doc).has(id) && files.refsOf(doc).has('fnone'), 'الاشارات تجمع من كل مفتاح «file» في السجلات (والمرفقات القادمة)');
    ok(files.reconcile(1, { recs: [] }) === 0, 'المصالحة لا تحذف ما رفع لتوه (المهلة) ولو لم يشر اليه سجل بعد');
    db.prepare("UPDATE files SET created_at = datetime('now','-2 hours') WHERE user_id = 1").run();
    ok(files.reconcile(1, doc) === 1, 'بعد المهلة: يحذف غير المشار اليه وحده (PDF سجل حذف)');
    ok((await call('GET', '/api/files/' + id, 1)).status === 200 && (await call('GET', '/api/files/' + upPdf.json.id, 1)).status === 404, 'المشار اليه باق، والمحذوف لا يفتح');

    // السقف
    db.prepare("INSERT INTO files (id,user_id,rec_id,mime,size,data) VALUES ('fquota',2,'r1','image/jpeg',?,x'00')").run(files.QUOTA - 100);
    const q = await call('POST', '/api/files?rec=r1', 2, JPEG, 'image/jpeg');
    ok(q.status === 413 && /٥٠٠/.test(q.json.error), 'سقف الحساب ٥٠٠ ميغابايت', q.json);
    ok((await call('POST', '/api/files?rec=r1', 1, JPEG, 'image/jpeg')).status === 200, 'وسقف حساب لا يمس غيره');

    // الحذف
    ok((await call('DELETE', '/api/files/' + id, 1)).json.deleted === 1 && (await call('GET', '/api/files/' + id, 1)).status === 404, 'صاحبه يحذفه فلا يفتح بعد');
    ok(files.dropFor(1) >= 1 && db.prepare('SELECT COUNT(*) c FROM files WHERE user_id = 1').get().c === 0, 'حذف الحساب يحذف ملفاته كلها');
  } catch (e) {
    fail++; console.log('✗ خطأ غير متوقع:', e.message);
  }
  srv.close();
  db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${fail ? '✗' : '✓'} ${pass} سليم · ${fail} معيب`);
  process.exit(fail ? 1 : 0);
}
