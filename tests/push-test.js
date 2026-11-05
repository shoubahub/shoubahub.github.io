// اختبار إشعارات الجوال — node tests/push-test.js (2026-11-05)
// قاعدة مؤقتة، ومرسل بديل يسجل ما يرسل بدل الإرسال الحقيقي. وساعات ثابتة بتوقيت الكويت (UTC+3).
const os = require('os'), fs = require('fs'), path = require('path'), http = require('http');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shouba-push-'));
process.env.DB_PATH = tmp;
process.env.ADMIN_PIN = 'test-000000';

const express = require('express');
const { db } = require('../db');
const auth = require('../auth');
const push = require('../push');

let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? '— ' + JSON.stringify(extra) : ''); } };

const sent = [];
let reject = null;                                  /* endpoint ⟵ رمز خطأ يحاكي رفض الجهاز */
push._setSender((sub, body) => {
  if (reject && reject[sub.endpoint]) return Promise.reject({ statusCode: reject[sub.endpoint] });
  sent.push({ to: sub.endpoint, m: JSON.parse(body) }); return Promise.resolve();
});

/* الثلاثاء 2026-11-10 بتوقيت الكويت: الساعة المحلية − 3 = UTC */
const at = (date, hm) => new Date(date + 'T' + hm + ':00+03:00');
const TUE = '2026-11-10', FRI = '2026-11-13';

const app = express();
app.use(express.json());
auth.routes(app);
push.routes(app, auth.requireUser);
const srv = app.listen(0, run);
function call(method, url, cookie, body) {
  return new Promise((done, no) => {
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    if (data) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = data.length; }
    const r = http.request({ port: srv.address().port, method, path: url, headers }, res => {
      const ch = []; res.on('data', c => ch.push(c));
      res.on('end', () => { let j = null; try { j = JSON.parse(Buffer.concat(ch).toString()); } catch (e) {}
        const sc = (res.headers['set-cookie'] || [])[0]; done({ status: res.statusCode, json: j, cookie: sc ? sc.split(';')[0] : null }); });
    });
    r.on('error', no); if (data) r.write(data); r.end();
  });
}
const SUB = n => ({ endpoint: 'https://push.example.com/ep-' + n, keys: { p256dh: 'BPk' + n, auth: 'au' + n } });

const DATA = {
  term: 'الأول', termStart: { 'الأول': '2026-09-06' },
  teachers: ['أحمد الفهد'],
  schedules: {
    'محمد البراك': { 'الثلاثاء': ['12/2 · الفلسفة', '', '11/1 · علم النفس', '', '', '', ''] },
    'أحمد الفهد': { 'الثلاثاء': ['10/1 · الفلسفة', '', '', '', '', '', ''] }
  },
  events: [
    { id: 'e1', date: TUE, type: 'اجتماع', title: 'اجتماع القسم', at: '10:30' },
    { id: 'e2', repeat: 'weekly', day: 'الثلاثاء', type: 'اجتماع', title: 'اجتماع الإدارة', at: '12:00' },
    { id: 'e3', date: TUE, type: 'اختبار', title: 'اختبار العاشر' },
    { id: 'e4', date: '2026-11-11', type: 'فعالية', title: 'غدا', at: '10:30' }
  ]
};

async function run() {
  try {
    // ── الساعة والدالة الخالصة
    const c = push.clock(at(TUE, '07:00'));
    ok(c.date === TUE && c.min === 420 && c.day === 'الثلاثاء', 'الساعة بتوقيت المدرسة لا UTC', c);

    let d = push.due(DATA, push.clock(at(TUE, '10:14')), 'محمد البراك');
    ok(!d.some(x => x.key.startsWith('ev:e1')), 'لا تذكير قبل ربع الساعة');
    d = push.due(DATA, push.clock(at(TUE, '10:15')), 'محمد البراك');
    const r1 = d.find(x => x.key === 'ev:e1:' + TUE);
    ok(r1 && r1.msg.title === 'اجتماع القسم' && /10:30/.test(r1.msg.body) && /ربع ساعة/.test(r1.msg.body), 'الموعد قبله بربع ساعة', d);
    d = push.due(DATA, push.clock(at(TUE, '10:27')), 'محمد البراك');
    ok(d.some(x => x.key === 'ev:e1:' + TUE && /بعد 3 دقائق/.test(x.msg.body)), 'من فاته الإرسال يلحقه بالدقائق الباقية', d);
    d = push.due(DATA, push.clock(at(TUE, '10:30')), 'محمد البراك');
    ok(!d.some(x => x.key.startsWith('ev:e1')), 'لا تذكير بعد حلول الموعد');
    d = push.due(DATA, push.clock(at(TUE, '11:45')), 'محمد البراك');
    ok(d.some(x => x.key === 'ev:e2:' + TUE), 'المتكرر أسبوعيا يذكر به في يومه');
    d = push.due(DATA, push.clock(at('2026-11-09', '11:45')), 'محمد البراك');
    ok(!d.some(x => x.key.startsWith('ev:e2')), 'والمتكرر لا يذكر به في غير يومه');
    ok(!push.due(DATA, push.clock(at(TUE, '10:20')), 'محمد البراك').some(x => x.key.startsWith('ev:e4')), 'موعد الغد لا يذكر به اليوم');

    // الملخص
    d = push.due(DATA, push.clock(at(TUE, '06:59')), 'محمد البراك');
    ok(!d.some(x => x.key.startsWith('am:')), 'لا ملخص قبل 7:00');
    d = push.due(DATA, push.clock(at(TUE, '07:00')), 'محمد البراك');
    const am = d.find(x => x.key === 'am:' + TUE);
    ok(am && am.msg.title === 'يومك: الثلاثاء', 'الملخص الساعة 7:00', d);
    ok(am && /الأولى \(12\/2\)/.test(am.msg.body) && /الثالثة \(11\/1\)/.test(am.msg.body) && !/10\/1/.test(am.msg.body), 'حصص رئيس الشعبة وحده', am && am.msg.body);
    ok(am && /اختبار العاشر/.test(am.msg.body) && /اجتماع القسم 10:30/.test(am.msg.body) && /اجتماع الإدارة 12:00/.test(am.msg.body), 'ومواعيد يومه كلها، بلا وقت وبه', am && am.msg.body);
    ok(am && am.msg.body.indexOf('اجتماع القسم') < am.msg.body.indexOf('اجتماع الإدارة'), 'المواعيد مرتبة بوقتها');
    d = push.due(DATA, push.clock(at(TUE, '07:00')), 'اسم عدل في الحساب');
    ok(/12\/2/.test((d.find(x => x.key.startsWith('am:')) || { msg: {} }).msg.body || ''), 'يعرف رئيس الشعبة ولو تغير اسمه في الحساب');
    ok(!push.due(DATA, push.clock(at(FRI, '07:00')), 'محمد البراك').some(x => x.key.startsWith('am:')), 'لا ملخص يوم الجمعة');
    ok(!push.due(DATA, push.clock(at(TUE, '10:00')), 'محمد البراك').some(x => x.key.startsWith('am:')), 'ولا ملخص بعد العاشرة');
    ok(!push.due(Object.assign({}, DATA, { termStart: { 'الأول': '2026-12-01' } }), push.clock(at(TUE, '07:00')), 'محمد البراك').some(x => x.key.startsWith('am:')),
      'ولا ملخص قبل أول يوم دراسي');
    ok(push.due({ events: [] }, push.clock(at(TUE, '07:00')), 'x').length === 0, 'يوم بلا حصص ولا مواعيد: لا شيء يرسل');
    ok(push.due(null, c, '').length === 0, 'بلا وثيقة: لا شيء');

    // ── المسارات
    const inv = require('../db').invite();
    const A = (await call('POST', '/api/register', null, { username: 'push1', pin: '111111', displayName: 'محمد البراك', inviteCode: inv })).cookie;
    const B = (await call('POST', '/api/register', null, { username: 'push2', pin: '222222', displayName: 'زميل', inviteCode: inv })).cookie;
    ok((await call('GET', '/api/push/key')).status === 401, 'المفتاح لا يعطى بلا دخول');
    const k = await call('GET', '/api/push/key', A);
    ok(k.status === 200 && /^[A-Za-z0-9_-]{80,}$/.test(k.json.key), 'يعطي المفتاح العام', k.json);
    ok((await call('GET', '/api/push/key', A)).json.key === k.json.key, 'والمفتاح ثابت لا يتغير');
    ok((await call('POST', '/api/push/subscribe', A, { subscription: { endpoint: 'http://x' } })).status === 400, 'يرفض اشتراكا غير صالح');

    sent.length = 0;
    const s1 = await call('POST', '/api/push/subscribe', A, { subscription: SUB(1) });
    ok(s1.status === 200 && sent.length === 1 && sent[0].m.title === 'تفعّلت إشعارات شعبة', 'التفعيل يرسل إشعار ترحيب', sent);
    await call('POST', '/api/push/subscribe', A, { subscription: SUB(1), quiet: true });
    await call('POST', '/api/push/subscribe', A, { subscription: SUB(1) });
    ok(sent.length === 1, 'التأكيد المتكرر لا يرسل الترحيب ثانية');
    await call('POST', '/api/push/subscribe', A, { subscription: SUB(2), quiet: true });
    await call('POST', '/api/push/subscribe', B, { subscription: SUB(3), quiet: true });
    ok(db.prepare('SELECT COUNT(*) c FROM push_subs').get().c === 3, 'ثلاثة أجهزة مشتركة');

    // ── الفحص الدوري: وثيقة push1 على الخادم
    const uid = db.prepare("SELECT id FROM users WHERE username='push1'").get().id;
    db.prepare("INSERT INTO shouba (user_id,data) VALUES (?,?)").run(uid, JSON.stringify(DATA));
    sent.length = 0;
    await push.tick(at(TUE, '07:00'));
    ok(sent.length === 2 && sent.every(x => x.m.tag === 'am') && sent.every(x => /ep-[12]$/.test(x.to)), 'الملخص يصل جهازي صاحبه وحده', sent);
    await push.tick(at(TUE, '07:01'));
    ok(sent.length === 2, 'ولا يتكرر في الدقيقة التالية');
    await push.tick(at(TUE, '10:15'));
    ok(sent.length === 4 && sent[2].m.title === 'اجتماع القسم', 'تذكير الموعد يصل جهازيه', sent.slice(2));
    await push.tick(at(TUE, '10:16'));
    ok(sent.length === 4, 'وتذكير الموعد مرة واحدة');

    // جهاز ألغى اشتراكه ⟵ يحذف
    reject = { 'https://push.example.com/ep-2': 410 };
    await push.tick(at(TUE, '11:45'));
    ok(!db.prepare('SELECT 1 FROM push_subs WHERE endpoint = ?').get(SUB(2).endpoint), 'الجهاز الذي رد ٤١٠ يحذف اشتراكه');
    reject = null;

    // ── إشعار التحديث
    const pub = fs.mkdtempSync(path.join(os.tmpdir(), 'shouba-pub-'));
    const ver = (b, v) => { fs.writeFileSync(path.join(pub, 'version.json'), JSON.stringify({ build: b }));
      fs.writeFileSync(path.join(pub, 'build.js'), "window.SHOUBA_VERSION = '" + v + "';\n"); };
    db.prepare("DELETE FROM settings WHERE key='push_build'").run();
    ver(124, '0.33.7'); sent.length = 0;
    ok(await push.announce(pub) === 0 && sent.length === 0, 'أول إقلاع يسجل البناء ولا يرسل');
    ok(await push.announce(pub) === 0, 'البناء نفسه لا يرسل');
    ver(125, '0.34.0');
    const n = await push.announce(pub);
    ok(n === 2 && sent.every(x => x.m.title === 'تحديث جديد لشعبة' && /النسخة 0\.34\.0 · بناء 125/.test(x.m.body)), 'بناء جديد: إشعار بالنسخة والبناء لكل جهاز', sent);
    ok(await push.announce(pub) === 0, 'ولا يتكرر مع إعادة التشغيل');

    // ── الإيقاف والحذف
    await call('POST', '/api/push/unsubscribe', B, { endpoint: SUB(1).endpoint });
    ok(!!db.prepare('SELECT 1 FROM push_subs WHERE endpoint = ?').get(SUB(1).endpoint), 'لا يوقف أحد اشتراك غيره');
    await call('POST', '/api/push/unsubscribe', A, { endpoint: SUB(1).endpoint });
    ok(!db.prepare('SELECT 1 FROM push_subs WHERE endpoint = ?').get(SUB(1).endpoint), 'صاحبه يوقفه');
    push.dropFor(db.prepare("SELECT id FROM users WHERE username='push2'").get().id);
    ok(db.prepare('SELECT COUNT(*) c FROM push_subs').get().c === 0, 'حذف الحساب يحذف اشتراكاته');
    fs.rmSync(pub, { recursive: true, force: true });
  } catch (e) { fail++; console.log('✗ خطأ غير متوقع:', e && e.stack || e); }
  srv.close(); db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${pass} نجح · ${fail} فشل`);
  process.exit(fail ? 1 : 0);
}
