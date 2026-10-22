// اختبار معلومات الحساب — node tests/account-test.js (2026-10-22)
// قاعدة مؤقتة (DB_PATH) وتطبيق express بمسارات auth.js نفسها، ودخول حقيقي بكعكة الجلسة —
// فيختبر أن كل جهاز جلسة مستقلة، وأن تغيير الرقم يغلق الأجهزة الأخرى ويبقي هذا. وتحذف القاعدة بعده.
const os = require('os'), fs = require('fs'), path = require('path'), http = require('http');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shouba-account-'));
process.env.DB_PATH = tmp;
process.env.ADMIN_PIN = 'test-000000';

const express = require('express');
const { db } = require('../db');
const auth = require('../auth');

const app = express();
app.use(express.json());
auth.routes(app);

let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? '— ' + JSON.stringify(extra) : ''); } };

const srv = app.listen(0, run);
function call(method, url, cookie, body) {
  return new Promise((done, no) => {
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    if (data) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = data.length; }
    const r = http.request({ port: srv.address().port, method, path: url, headers }, res => {
      const ch = [];
      res.on('data', c => ch.push(c));
      res.on('end', () => {
        let j = null; try { j = JSON.parse(Buffer.concat(ch).toString()); } catch (e) {}
        const sc = (res.headers['set-cookie'] || [])[0];
        done({ status: res.statusCode, json: j, cookie: sc ? sc.split(';')[0] : null });
      });
    });
    r.on('error', no);
    if (data) r.write(data);
    r.end();
  });
}
const login = (u, p) => call('POST', '/api/login', null, { username: u, pin: p });

async function run() {
  try {
    const inv = require('../db').invite();
    const reg = await call('POST', '/api/register', null, { username: 'acc1', pin: '111111', displayName: 'محمد البراك', inviteCode: inv });
    ok(reg.status === 200 && reg.cookie, 'ينشأ حساب للاختبار', reg.json);
    await call('POST', '/api/register', null, { username: 'acc2', pin: '222222', displayName: 'زميل آخر', inviteCode: inv });
    const A = reg.cookie;
    const B = (await login('acc1', '111111')).cookie;           /* جهاز ثان للحساب نفسه */

    // القراءة
    ok((await call('GET', '/api/account')).status === 401, 'بلا جلسة: لا معلومات حساب (٤٠١)');
    const a = await call('GET', '/api/account', A);
    ok(a.status === 200 && a.json.username === 'acc1' && a.json.displayName === 'محمد البراك', 'يعيد اسم المستخدم والاسم', a.json);
    ok(a.json.email === '' && a.json.emailVerified === false && a.json.pinChangedAt === null, 'بلا بريد ولا تغيير رقم سابق', a.json);
    ok(!!a.json.lastLogin, 'التسجيل يملأ «آخر دخول»', a.json.lastLogin);
    ok(a.json.sessions === 2, 'يعد الجهازين الداخلين', a.json.sessions);
    ok(!('pin_hash' in a.json) && !('pinHash' in a.json), 'لا حقل بصمة في الجواب');
    ok(!JSON.stringify(a.json).includes(db.prepare("SELECT pin_hash FROM users WHERE username='acc1'").get().pin_hash), 'بصمة الرقم لا تظهر في الجواب');

    // الاسم
    ok((await call('PUT', '/api/account/name', A, { displayName: 'م' })).status === 400, 'اسم قصير يرفض');
    const nm = await call('PUT', '/api/account/name', A, { displayName: '  محمد   ناصر البراك ' });
    ok(nm.status === 200 && nm.json.displayName === 'محمد ناصر البراك', 'يعدل الاسم وينظف المسافات', nm.json);
    ok(db.prepare("SELECT display_name FROM users WHERE username='acc2'").get().display_name === 'زميل آخر', 'لا يمس اسم حساب آخر');

    // البريد
    ok((await call('PUT', '/api/account/email', A, { email: 'not-an-email' })).status === 400, 'بريد غير صحيح يرفض');
    const em = await call('PUT', '/api/account/email', A, { email: ' Moh@Example.COM ' });
    ok(em.status === 200 && em.json.email === 'moh@example.com' && em.json.emailVerified === false, 'يحفظ البريد صغيرا غير مؤكد', em.json);
    db.prepare("UPDATE users SET email_verified = 1 WHERE username='acc1'").run();
    const em2 = await call('PUT', '/api/account/email', A, { email: 'other@example.com' });
    ok(em2.json.emailVerified === false, 'تغيير البريد يعيده غير مؤكد', em2.json);
    const em3 = await call('PUT', '/api/account/email', A, { email: '' });
    ok(em3.status === 200 && em3.json.email === '', 'فارغا يحذف البريد', em3.json);

    // الرقم السري
    const wrong = await call('POST', '/api/account/pin', A, { current: '000000', next: '333333' });
    ok(wrong.status === 403 && /الحالي غير صحيح/.test(wrong.json.error), 'رقم حالي خاطئ يرفض بـ٤٠٣ لا ٤٠١ — فلا تحسبه الواجهة انتهاء جلسة', wrong);
    ok((await call('GET', '/api/account', A)).status === 200, 'والجلسة باقية بعد الرقم الخاطئ');
    ok((await call('POST', '/api/account/pin', A, { current: '111111', next: '12' })).status === 400, 'رقم جديد ليس ستة أرقام يرفض');
    ok((await call('POST', '/api/account/pin', A, { current: '111111', next: '111111' })).status === 400, 'الجديد هو الحالي يرفض');
    const pc = await call('POST', '/api/account/pin', A, { current: '١١١١١١', next: '٣٣٣٣٣٣' });
    ok(pc.status === 200 && pc.json.closed === 1 && pc.json.sessions === 1 && pc.json.pinChangedAt, 'يغير الرقم (بأرقام عربية) ويغلق الجهاز الآخر', pc.json);
    ok((await call('GET', '/api/account', A)).status === 200, 'جلسة هذا الجهاز باقية');
    ok((await call('GET', '/api/account', B)).status === 401, 'جلسة الجهاز الآخر أغلقت');
    ok((await login('acc1', '111111')).status === 401, 'الرقم القديم لا يدخل');
    const C = (await login('acc1', '333333')).cookie;
    ok(!!C, 'الرقم الجديد يدخل');
    ok((await login('acc2', '222222')).status === 200, 'حساب الزميل لم يمس');

    // حد المحاولات
    for (let i = 0; i < 5; i++) await call('POST', '/api/account/pin', A, { current: '999999', next: '444444' });
    ok((await call('POST', '/api/account/pin', A, { current: '333333', next: '444444' })).status === 429, 'خمس محاولات خاطئة توقف التغيير عشر دقائق');
    ok((await login('acc1', '333333')).status === 200, 'وقفل تغيير الرقم لا يقفل الدخول — عداد مستقل');

    // الخروج من الأجهزة الأخرى، ثم الخروج
    const so = await call('POST', '/api/account/signout-others', A);
    ok(so.status === 200 && so.json.closed === 2 && so.json.sessions === 1, 'يخرج الأجهزة الأخرى (اثنين) ويبقي هذا', so.json);
    ok((await call('GET', '/api/account', C)).status === 401, 'الجهاز الآخر خرج');
    await call('POST', '/api/logout', A);
    ok((await call('GET', '/api/account', A)).status === 401, 'تسجيل الخروج يغلق جلسة هذا الجهاز');
  } catch (e) { fail++; console.log('✗ خطأ:', e.stack); }
  srv.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${pass} ناجح · ${fail} فاشل`);
  process.exit(fail ? 1 : 0);
}
