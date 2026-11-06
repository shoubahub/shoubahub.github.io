// اختبار إشعارات معلمي الشعبة — node tests/tpush-test.js (2026-11-06)
// قاعدة مؤقتة، ومرسل بديل يسجل ما يرسل. وساعات ثابتة بتوقيت الكويت (UTC+3). أوقات الثانوي من refdata.js:
// الأولى 07:55–08:40 · الثانية 08:45–09:30 · الثالثة 09:35–10:20
const os = require('os'), fs = require('fs'), path = require('path'), http = require('http');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shouba-tpush-'));
process.env.DB_PATH = tmp;
process.env.ADMIN_PIN = 'test-000000';
process.env.FACE_BETA = 'head1';

const express = require('express');
const { db } = require('../db');
const auth = require('../auth');
const push = require('../push');
const tpush = require('../tpush');

let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? '— ' + JSON.stringify(extra) : ''); } };

const sent = [];
let reject = null;
push._setSender((sub, body) => {
  if (reject && reject[sub.endpoint]) return Promise.reject({ statusCode: reject[sub.endpoint] });
  sent.push({ to: sub.endpoint, m: JSON.parse(body) }); return Promise.resolve();
});

const at = (date, hm) => new Date(date + 'T' + hm + ':00+03:00');
const TUE = '2026-11-10', FRI = '2026-11-13';
const ALL = { pre: true, start: true, end: true };

const app = express();
app.use(express.json());
auth.routes(app);
tpush.pages(app);
app.use(express.static(path.join(__dirname, '..', 'public')));
tpush.routes(app, auth.requireUser);
const srv = app.listen(0, run);
function call(method, url, cookie, body) {
  return new Promise((done, no) => {
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    if (data) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = data.length; }
    const r = http.request({ port: srv.address().port, method, path: url, headers }, res => {
      const ch = []; res.on('data', c => ch.push(c));
      res.on('end', () => { const raw = Buffer.concat(ch).toString(); let j = null; try { j = JSON.parse(raw); } catch (e) {}
        const sc = (res.headers['set-cookie'] || [])[0]; done({ status: res.statusCode, json: j, raw, type: res.headers['content-type'] || '', cookie: sc ? sc.split(';')[0] : null }); });
    });
    r.on('error', no); if (data) r.write(data); r.end();
  });
}
const SUB = n => ({ endpoint: 'https://push.example.com/t-' + n, keys: { p256dh: 'BPk' + n, auth: 'au' + n } });

const DATA = {
  stage: 'ثانوي', department: 'المواد الفلسفية',
  term: 'الأول', termStart: { 'الأول': '2026-09-06' },
  teachers: ['أحمد الفهد', 'سالم العلي'],
  schedules: {
    'محمد البراك': { 'الثلاثاء': ['12/2 · الفلسفة', '', '', '', '', '', ''] },
    'أحمد الفهد': { 'الثلاثاء': ['10/1 · الفلسفة', '', '11/2 د · علم النفس', '', '', '', ''] },
    'سالم العلي': { 'الثلاثاء': ['', '12/1 · المنطق', '', '', '', '', ''] }
  }
};

async function run() {
  try {
    // ── الدالة الخالصة
    const due = (hm, prefs, data, date) => tpush.due(data || DATA, 'أحمد الفهد', prefs || ALL, push.clock(at(date || TUE, hm)), 'tok');
    ok(due('07:49').length === 0, 'لا شيء قبل الخمس دقائق');
    let d = due('07:50');
    ok(d.length === 1 && d[0].key === 'pre:1:' + TUE && d[0].msg.title === 'حصتك الأولى بعد 5 دقائق'
      && d[0].msg.body === '10/1 · الفلسفة، من 07:55 إلى 08:40.', 'قبل الحصة بخمس دقائق', d);
    d = due('07:51');
    ok(d.length === 1 && /بعد 4 دقائق/.test(d[0].msg.title), 'من فاته الفحص يلحقه في الدقيقة التالية', d);
    ok(due('07:52').length === 0, 'ولا يلحقه بعد دقيقتين');
    d = due('07:55');
    ok(d.length === 1 && d[0].key === 'start:1:' + TUE && d[0].msg.title === 'بدأت حصتك الأولى' && /حتى 08:40/.test(d[0].msg.body), 'عند بداية الحصة', d);
    d = due('08:35');
    ok(d.length === 1 && d[0].key === 'end:1:' + TUE && d[0].msg.title === 'بقيت 5 دقائق على نهاية حصتك الأولى'
      && /^اختم درسك\./.test(d[0].msg.body), 'قبل نهاية الحصة بخمس دقائق', d);
    ok(due('08:40').length === 0, 'لا شيء عند انتهائها');
    ok(due('08:40').length === 0 && due('08:45').length === 0, 'الحصة الثانية ليست له: لا شيء');
    d = due('09:30');
    ok(d.length === 1 && d[0].key === 'pre:3:' + TUE && /الثالثة/.test(d[0].msg.title) && /11\/2 د · علم النفس/.test(d[0].msg.body), 'الحصة الثالثة بفصلها ومادتها', d);
    ok(d[0].msg.url === '/t/tok', 'لمس الإشعار يفتح صفحته');
    ok(due('07:50', { pre: false, start: true, end: true }).length === 0, 'من أطفأ «قبل البداية» لا يصله');
    ok(due('07:55', { pre: true, start: false, end: true }).length === 0, 'من أطفأ «عند البداية» لا يصله');
    ok(due('08:35', { pre: true, start: true, end: false }).length === 0, 'من أطفأ «قبل النهاية» لا يصله');
    ok(due('07:50', null, null, FRI).length === 0, 'لا تنبيه يوم الجمعة');
    ok(due('07:50', null, Object.assign({}, DATA, { termStart: { 'الأول': '2026-12-01' } })).length === 0, 'ولا قبل أول يوم دراسي');
    ok(due('07:50', null, Object.assign({}, DATA, { teachers: ['سالم العلي'] })).length === 0, 'من أزيل من القائمة سكت');
    const MID = Object.assign({}, DATA, { stage: 'متوسط' });   /* المتوسط: الأولى 07:40–08:25 */
    d = tpush.due(MID, 'أحمد الفهد', ALL, push.clock(at(TUE, '07:35')), 'x');
    ok(d.length === 1 && /من 07:40 إلى 08:25/.test(d[0].msg.body) && due('07:35').length === 0, 'الأوقات بمرحلة الشعبة', d);

    // ── حسابان: head1 في التجربة، head2 خارجها
    const inv = require('../db').invite();
    const A = (await call('POST', '/api/register', null, { username: 'head1', pin: '111111', displayName: 'محمد البراك', inviteCode: inv })).cookie;
    const B = (await call('POST', '/api/register', null, { username: 'head2', pin: '222222', displayName: 'زميل', inviteCode: inv })).cookie;
    const uid = db.prepare("SELECT id FROM users WHERE username='head1'").get().id;
    const uidB = db.prepare("SELECT id FROM users WHERE username='head2'").get().id;
    db.prepare('INSERT INTO shouba (user_id,data) VALUES (?,?)').run(uid, JSON.stringify(DATA));
    db.prepare('INSERT INTO shouba (user_id,data) VALUES (?,?)').run(uidB, JSON.stringify(DATA));

    ok((await call('GET', '/api/tpush/links')).status === 401, 'الروابط لا تعطى بلا دخول');
    ok((await call('GET', '/api/tpush/links', B)).status === 404, 'ومن خارج التجربة: ٤٠٤ كأن لا باب');
    ok((await call('POST', '/api/tpush/link', B, { name: 'أحمد الفهد' })).status === 404, 'ولا ينشئ رابطا');
    let r = await call('GET', '/api/tpush/links', A);
    ok(r.status === 200 && r.json.links.length === 0, 'لا روابط ابتداء');
    ok((await call('POST', '/api/tpush/link', A, { name: 'مجهول' })).status === 400, 'لا رابط لمن ليس في الشعبة');
    r = await call('POST', '/api/tpush/link', A, { name: 'أحمد الفهد' });
    const tok = r.json && r.json.token;
    ok(r.status === 200 && /^[0-9a-f]{16}$/.test(tok) && r.json.devices === 0 && r.json.prefs.pre && r.json.prefs.end, 'ينشئ رابطا بالتنبيهات الثلاثة', r.json);
    ok((await call('POST', '/api/tpush/link', A, { name: 'أحمد الفهد' })).json.token === tok, 'ويعيده نفسه لا جديدا');
    const tokS = (await call('POST', '/api/tpush/link', A, { name: 'سالم العلي' })).json.token;

    // ── صفحة المعلم: بلا حساب، والرمز بوابتها
    r = await call('GET', '/api/t/' + tok);
    ok(r.status === 200 && r.json.name === 'أحمد الفهد' && r.json.department === 'المواد الفلسفية' && r.json.key && !r.json.schedules,
      'صفحته تعطي اسمه وقسمه والمفتاح فقط', r.json);
    ok((await call('GET', '/api/t/0000000000000000')).status === 404, 'رمز مجهول: ٤٠٤');
    ok((await call('GET', '/api/t/zz')).status === 404, 'رمز غير صالح: ٤٠٤');
    r = await call('GET', '/t/' + tok);
    ok(r.status === 200 && /text\/html/.test(r.type) && /إشعاراتي/.test(r.raw), 'الصفحة تفتح برابطه');
    r = await call('GET', '/t/0000000000000000');
    ok(r.status === 404 && /إشعاراتي/.test(r.raw) && /tokens\.css/.test(r.raw), 'والرابط المبطل: الصفحة نفسها بهويتها وردها ٤٠٤');
    ok((await call('GET', '/t.html')).status === 404 && (await call('GET', '/t-sw.js')).status === 404, 'ولا تفتح الصفحة ولا عاملها مباشرة');
    ok((await call('GET', '/teacher.html')).status === 200, 'وسائر الملفات الساكنة تخدم كما هي');
    ok((await call('GET', '/api/t/' + tok + '/face')).status === 404, 'بلا واجهة منشورة: لا نسخة');
    db.prepare("INSERT INTO face (user_id, slug, data, at, rev) VALUES (?,?,?,?,1)").run(uid, 'abcdef0123', JSON.stringify({ dept: 'المواد الفلسفية' }), '2026-11-06T10:00:00Z');
    r = await call('GET', '/t/' + tok);
    ok(r.status === 200 && /واجهة الشعبة/.test(r.raw) && /tabN/.test(r.raw), 'والواجهة منشورة: رابطه يفتح الواجهة بتبويب «إشعاراتي»');
    r = await call('GET', '/api/t/' + tok + '/face');
    ok(r.status === 200 && r.json.data.dept === 'المواد الفلسفية', 'ويقرأ الواجهة المنشورة من رابطه', r.json);
    db.prepare("UPDATE face SET data = '' WHERE user_id = ?").run(uid);
    ok(/إشعاراتي/.test((await call('GET', '/t/' + tok)).raw) && !/tabN/.test((await call('GET', '/t/' + tok)).raw), 'وإن سُحب النشر عاد إلى صفحة الإشعارات وحدها');
    db.prepare("UPDATE face SET data = ? WHERE user_id = ?").run(JSON.stringify({ dept: 'x' }), uid);
    ok((await call('GET', '/api/t/0000000000000000/face')).status === 404, 'ولا واجهة لرابط باطل');
    db.prepare("UPDATE face SET data = '' WHERE user_id = ?").run(uid);
    r = await call('GET', '/t/' + tok + '/manifest.webmanifest');
    ok(r.status === 200 && r.json.start_url === '/t/' + tok && r.json.scope === '/t/', 'ملف التطبيق يفتح على رابطه هو', r.json);
    r = await call('GET', '/t/sw.js');
    ok(r.status === 200 && /javascript/.test(r.type) && /showNotification/.test(r.raw), 'عامل الخدمة الخاص بـ/t/');

    sent.length = 0;
    ok((await call('POST', '/api/t/' + tok + '/subscribe', null, { subscription: { endpoint: 'http://x' } })).status === 400, 'يرفض اشتراكا غير صالح');
    r = await call('POST', '/api/t/' + tok + '/subscribe', null, { subscription: SUB(1) });
    ok(r.status === 200 && sent.length === 1 && sent[0].m.title === 'تفعّلت إشعارات شعبة', 'التفعيل يرسل إشعار ترحيب', sent);
    await call('POST', '/api/t/' + tok + '/subscribe', null, { subscription: SUB(1), quiet: true });
    ok(sent.length === 1, 'والتأكيد الصامت لا يكرره');
    r = await call('POST', '/api/t/' + tok + '/subscribe', null, { subscription: SUB(2) });
    ok(r.status === 409 && r.json.locked && !db.prepare('SELECT 1 FROM teacher_subs WHERE endpoint = ?').get(SUB(2).endpoint),
      'الرابط لجهاز واحد: جهاز ثان لا يفعّل به', r.json);
    ok((await call('GET', '/api/t/' + tok)).json.devices === 1, 'والصفحة تعرف أنه مفعّل على جهاز');
    ok((await call('PUT', '/api/t/' + tok + '/prefs', null, { start: false })).status === 409, 'ولا يغيّر اختياره من غير جهازه');
    await call('POST', '/api/t/' + tokS + '/subscribe', null, { subscription: SUB(3), quiet: true });
    r = await call('GET', '/api/tpush/links', A);
    ok(r.json.links.find(l => l.name === 'أحمد الفهد').devices === 1, 'رئيس الشعبة يرى عدد أجهزته', r.json);

    // ── الفحص الدوري
    sent.length = 0;
    await tpush.tick(at(TUE, '07:50'));
    ok(sent.length === 1 && /t-1$/.test(sent[0].to) && sent[0].m.title === 'حصتك الأولى بعد 5 دقائق', 'التنبيه يصل جهازه هو وحده', sent);
    await tpush.tick(at(TUE, '07:51'));
    ok(sent.length === 1, 'ولا يتكرر في الدقيقة التالية');
    await tpush.tick(at(TUE, '08:40'));
    ok(sent.length === 2 && /t-3$/.test(sent[1].to) && /الثانية/.test(sent[1].m.title), 'وزميله يصله تنبيه حصته', sent.slice(1));

    // ── اختياره من صفحته
    r = await call('PUT', '/api/t/' + tok + '/prefs', null, { start: false, endpoint: SUB(1).endpoint });
    ok(r.status === 200 && r.json.prefs.start === false && r.json.prefs.pre === true, 'يطفئ «عند البداية» من صفحته', r.json);
    sent.length = 0;
    await tpush.tick(at(TUE, '07:55'));
    ok(sent.length === 0, 'فلا يصله عند البداية');
    await tpush.tick(at(TUE, '08:35'));
    ok(sent.length === 1 && /نهاية/.test(sent[0].m.title), 'ويبقى ما لم يطفئه', sent);
    await call('PUT', '/api/t/' + tok + '/prefs', null, { start: true, endpoint: SUB(1).endpoint });

    // ── الرسالة الحرة
    ok((await call('POST', '/api/tpush/send', A, { to: 'all', body: '' })).status === 400, 'لا رسالة بلا نص');
    ok((await call('POST', '/api/tpush/send', A, { to: [], body: 'x' })).status === 400, 'ولا بلا من تصله');
    ok((await call('POST', '/api/tpush/send', B, { to: 'all', body: 'x' })).status === 404, 'ومن خارج التجربة لا يرسل');
    sent.length = 0;
    r = await call('POST', '/api/tpush/send', A, { to: 'all', title: '', body: 'تهنئة بنجاح الفعالية' });
    ok(r.status === 200 && r.json.teachers === 2 && r.json.devices === 2 && sent.length === 2
      && sent.every(x => x.m.title === 'رسالة من رئيس الشعبة' && x.m.body === 'تهنئة بنجاح الفعالية'), 'للكل: تصل كل الأجهزة', { r: r.json, sent });
    sent.length = 0;
    r = await call('POST', '/api/tpush/send', A, { to: ['سالم العلي'], title: 'تذكير', body: 'سلّم الخطة غداً' });
    ok(r.json.teachers === 1 && sent.length === 1 && /t-3$/.test(sent[0].to) && sent[0].m.title === 'تذكير', 'لمن تختار: تصله وحده', sent);
    await call('PUT', '/api/t/' + tokS + '/prefs', null, { pre: false, start: false, end: false, endpoint: SUB(3).endpoint });
    sent.length = 0;
    await call('POST', '/api/tpush/send', A, { to: ['سالم العلي'], body: 'رسالة' });
    ok(sent.length === 1, 'والرسالة الحرة تصل ولو أطفأ تنبيهات الحصص');

    // ── جهاز ألغى اشتراكه ⟵ يحذف
    reject = { 'https://push.example.com/t-1': 410 };
    await call('POST', '/api/tpush/send', A, { to: ['أحمد الفهد'], body: 'x' });
    ok(!db.prepare('SELECT 1 FROM teacher_subs WHERE endpoint = ?').get(SUB(1).endpoint), 'الجهاز الذي رد ٤١٠ يحذف اشتراكه');
    reject = null;
    r = await call('POST', '/api/t/' + tok + '/subscribe', null, { subscription: SUB(2), quiet: true });
    ok(r.status === 200, 'وبعد خلو الرابط يفعّل به جهاز آخر');
    await call('POST', '/api/t/' + tok + '/unsubscribe', null, { endpoint: SUB(2).endpoint });
    await call('POST', '/api/t/' + tok + '/subscribe', null, { subscription: SUB(1), quiet: true });

    // ── الإيقاف من صفحته
    await call('POST', '/api/t/' + tok + '/unsubscribe', null, { endpoint: SUB(1).endpoint });
    ok(!db.prepare('SELECT 1 FROM teacher_subs WHERE endpoint = ?').get(SUB(1).endpoint), 'يوقف إشعاراته من صفحته');
    await call('POST', '/api/t/' + tok + '/subscribe', null, { subscription: SUB(1), quiet: true });

    // ── الإبطال
    r = await call('POST', '/api/tpush/link', A, { name: 'أحمد الفهد', renew: true });
    ok(r.json.token !== tok && r.json.devices === 0, 'الإبطال يصدر رابطا جديدا بلا أجهزة', r.json);
    ok((await call('GET', '/api/t/' + tok)).status === 404, 'والرابط القديم لا يعمل');
    ok(!db.prepare('SELECT 1 FROM teacher_subs WHERE token = ?').get(tok), 'وأجهزته القديمة حذفت');

    // ── من أزيل من الشعبة سكت رابطه
    db.prepare('UPDATE shouba SET data = ? WHERE user_id = ?').run(JSON.stringify(Object.assign({}, DATA, { teachers: ['أحمد الفهد'] })), uid);
    ok((await call('GET', '/api/t/' + tokS)).status === 404, 'المعلم المزال: رابطه لا يعمل');
    ok(!(await call('GET', '/api/tpush/links', A)).json.links.some(l => l.name === 'سالم العلي'), 'ولا يظهر في الروابط');
  } catch (e) { fail++; console.log('✗ استثناء:', e.stack); }
  srv.close();
  console.log(`\n${pass} ناجحة · ${fail} فاشلة`);
  process.exit(fail ? 1 : 0);
}
