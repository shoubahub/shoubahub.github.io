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
function call(method, url, cookie, body, extra) {
  return new Promise((done, no) => {
    const headers = Object.assign({}, extra || {});
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

    // ── مواعيد التسليم (المرحلة الثانية): دالة خالصة
    const DLS = Object.assign({}, DATA, { deadlines: [
      { id: 'd1', title: 'تسليم مشروع الوحدة الثانية', date: '2026-11-11', to: ['أحمد الفهد', 'سالم العلي'], done: [] },
      { id: 'd2', title: 'خطة العلاج', date: '2026-11-15', to: ['أحمد الفهد'], done: [] },
      { id: 'd3', title: 'تقرير الزيارة', date: '2026-11-11', to: ['أحمد الفهد'], done: ['أحمد الفهد'] },
      { id: 'd4', title: 'ليس له', date: '2026-11-11', to: ['سالم العلي'], done: [] }
    ] });
    const dd = (date, hm, data) => tpush.dueDeadlines(data || DLS, 'أحمد الفهد', push.clock(at(date, hm)), 'tok');
    ok(dd(TUE, '06:59').length === 0, 'الموعد: لا تنبيه قبل 7:00');
    d = dd(TUE, '07:00');
    ok(d.length === 1 && d[0].key === 'dl:d1:pre:2026-11-11' && d[0].msg.title === 'غداً موعد تسليم'
      && d[0].msg.body === 'تسليم مشروع الوحدة الثانية', 'الموعد: صباح اليوم السابق «غداً موعد تسليم»', d);
    ok(d[0].msg.url === '/t/tok#' + encodeURIComponent('المواعيد'), 'والإشعار يفتح «المواعيد»');
    ok(dd(TUE, '15:00').length === 1 && dd(TUE, '20:00').length === 0, 'ومن فاته 7:00 يلحقه يومه حتى 20:00 لا بعدها');
    d = dd('2026-11-11', '07:00');
    ok(d.length === 1 && d[0].key === 'dl:d1:day:2026-11-11' && d[0].msg.title === 'اليوم موعد تسليم', 'الموعد: صباح يومه «اليوم موعد تسليم»', d);
    d = dd('2026-11-12', '07:00');
    ok(d.length === 1 && d[0].key === 'dl:d2:pre:2026-11-15' && d[0].msg.title === 'الأحد موعد تسليم', 'موعد الأحد: ينبه الخميس قبله باسم اليوم', d);
    ok(dd('2026-11-14', '07:00').length === 0, 'ولا ينبه يوم السبت');
    ok(tpush.alertDay('2026-11-15') === '2026-11-12' && tpush.alertDay('2026-11-11') === '2026-11-10', 'يوم التنبيه الأول: آخر يوم دراسي قبله');
    ok(dd(TUE, '07:00', Object.assign({}, DLS, { teachers: ['سالم العلي'] })).length === 0, 'ومن أزيل من الشعبة لا ينبه بمواعيده');
    const up = tpush.upcoming(DLS, 'أحمد الفهد', TUE);
    ok(up.length === 2 && up[0].title === 'تسليم مشروع الوحدة الثانية' && up[0].when === 'غداً' && up[1].when === 'الأحد 15 نوفمبر',
      'مواعيده القادمة: ما لم يسلّمه بالأقرب', up);
    ok(tpush.upcoming(DLS, 'أحمد الفهد', '2026-11-12').length === 1, 'وما مضى لا يظهر في القادمة');

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

    // ── صفحة المعلم: بلا حساب، والرمز بوابتها — ولا يفتح شيء حتى يقبل رئيس الشعبة الجهاز (2026-11-08)
    const IPH = { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' };
    const AND = { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36' };
    db.prepare('INSERT INTO push_subs (endpoint,user_id,p256dh,auth) VALUES (?,?,?,?)').run('https://push.example.com/head', uid, 'BPh', 'auh');
    const head = () => sent.filter(x => /\/head$/.test(x.to));
    const reqs = async () => (await call('GET', '/api/tpush/requests', A)).json.requests;
    /* جهاز يطلب، ورئيس الشعبة يقبله — يعيد كعكته */
    async function approved(t, ua, name) {
      const a = await call('POST', '/api/t/' + t + '/ask', null, {}, ua || AND);
      const q = (await reqs()).filter(x => x.name === name).pop();
      await call('POST', '/api/tpush/decide', A, { id: q.id, ok: true });
      return a.cookie;
    }

    r = await call('GET', '/api/t/' + tok);
    ok(r.status === 200 && r.json.state === 'none' && !r.json.name && !r.json.key, 'قبل الطلب: حاله وحدها بلا اسم ولا مفتاح', r.json);
    ok((await call('GET', '/api/t/0000000000000000')).status === 404, 'رمز مجهول: ٤٠٤');
    ok((await call('GET', '/api/t/zz')).status === 404, 'رمز غير صالح: ٤٠٤');
    ok((await call('GET', '/api/t/' + tok + '/face')).status === 403, 'ولا يقرأ الواجهة قبل القبول');
    ok((await call('POST', '/api/t/' + tok + '/subscribe', null, { subscription: SUB(1) })).status === 403, 'ولا يفعّل الإشعارات قبل القبول');
    r = await call('GET', '/t/' + tok);
    ok(r.status === 200 && /text\/html/.test(r.type) && /إشعاراتي/.test(r.raw), 'الصفحة تفتح برابطه');
    r = await call('GET', '/t/0000000000000000');
    ok(r.status === 404 && /إشعاراتي/.test(r.raw) && /tokens\.css/.test(r.raw), 'والرابط المبطل: الصفحة نفسها بهويتها وردها ٤٠٤');
    ok((await call('GET', '/t.html')).status === 404 && (await call('GET', '/t-sw.js')).status === 404, 'ولا تفتح الصفحة ولا عاملها مباشرة');
    ok((await call('GET', '/teacher.html')).status === 200, 'وسائر الملفات الساكنة تخدم كما هي');
    r = await call('GET', '/t/' + tok + '/manifest.webmanifest');
    ok(r.status === 200 && r.json.start_url === '/t/' + tok && r.json.scope === '/t/', 'ملف التطبيق قبل القبول (للتثبيت على آيفون) يفتح على رابطه', r.json);
    r = await call('GET', '/t/sw.js');
    ok(r.status === 200 && /javascript/.test(r.type) && /showNotification/.test(r.raw), 'عامل الخدمة الخاص بـ/t/');

    // ── الطلب
    sent.length = 0;
    r = await call('POST', '/api/t/' + tok + '/ask', null, {}, IPH);
    const D1 = r.cookie;
    ok(r.status === 200 && r.json.state === 'pending' && /^tdev=[0-9a-f]{32}$/.test(D1 || ''), 'الطلب يعطي الجهاز كعكته وحاله «ينتظر»', { j: r.json, c: D1 });
    await new Promise(z => setTimeout(z, 30));
    ok(head().length === 1 && head()[0].m.title === 'طلب فتح رابط أ. أحمد الفهد' && /آيفون/.test(head()[0].m.body)
      && /teacher\.html\?t=/.test(head()[0].m.url), 'ويصل رئيس الشعبة إشعار باسم المعلم ونوع الجهاز', head());
    r = await call('POST', '/api/t/' + tok + '/ask', D1, {}, IPH);
    ok(r.json.state === 'pending' && head().length === 1, 'وإعادة الطلب من الجهاز نفسه لا تكرر الإشعار');
    ok((await call('GET', '/api/t/' + tok, D1)).json.state === 'pending', 'وصفحته تعرف أنه ينتظر');
    let q = await reqs();
    ok(q.length === 1 && q[0].name === 'أحمد الفهد' && q[0].label === 'آيفون' && q[0].id, 'الطلب في «بحاجة إلى إجراء»', q);
    ok((await call('GET', '/api/tpush/requests', B)).status === 404 && (await call('POST', '/api/tpush/decide', B, { id: q[0].id, ok: true })).status === 404,
      'ومن خارج التجربة لا يرى الطلبات ولا يحسمها');
    r = await call('GET', '/api/tpush/links', A);
    ok(r.json.links.find(l => l.name === 'أحمد الفهد').pending.length === 1, 'والطلب في ملف المعلم أيضاً');

    // ── الرفض
    const bad = await call('POST', '/api/t/' + tok + '/ask', null, {}, AND);
    q = await reqs();
    r = await call('POST', '/api/tpush/decide', A, { id: q.find(x => x.label === 'أندرويد').id, ok: false });
    ok(r.json.state === 'no' && (await call('GET', '/api/t/' + tok, bad.cookie)).json.state === 'no', 'المرفوض يعرف أنه رُفض');
    ok((await call('POST', '/api/t/' + tok + '/ask', bad.cookie, {}, AND)).json.state === 'no', 'ولا يعيد الطلب');
    ok((await call('GET', '/api/t/' + tok + '/face', bad.cookie)).status === 403, 'ولا يقرأ شيئاً');

    // ── القبول
    r = await call('POST', '/api/tpush/decide', A, { id: q.find(x => x.label === 'آيفون').id, ok: true });
    ok(r.json.state === 'ok', 'يقبل الجهاز', r.json);
    ok((await call('POST', '/api/tpush/decide', A, { id: q.find(x => x.label === 'آيفون').id, ok: false })).status === 409, 'والمحسوم لا يحسم ثانية');
    r = await call('GET', '/api/t/' + tok, D1);
    ok(r.json.state === 'ok' && r.json.name === 'أحمد الفهد' && r.json.department === 'المواد الفلسفية' && r.json.key && !r.json.schedules,
      'بعد القبول: اسمه وقسمه والمفتاح فقط', r.json);
    ok((await call('GET', '/api/t/' + tok)).json.state === 'none', 'ومن غير جهازه لا يرى شيئاً');
    ok((await call('GET', '/api/t/' + tok + '/face', D1)).status === 404, 'بلا واجهة منشورة: لا نسخة');
    db.prepare("INSERT INTO face (user_id, slug, data, at, rev) VALUES (?,?,?,?,1)").run(uid, 'abcdef0123', JSON.stringify({ dept: 'المواد الفلسفية' }), '2026-11-06T10:00:00Z');
    r = await call('GET', '/t/' + tok, D1);
    ok(r.status === 200 && /واجهة الشعبة/.test(r.raw) && /tabN/.test(r.raw), 'والواجهة منشورة: جهازه المقبول يفتح الواجهة بتبويب «إشعاراتي»');
    ok(!/tabN/.test((await call('GET', '/t/' + tok)).raw), 'وغير المقبول يفتح صفحة الحال وحدها');
    r = await call('GET', '/api/t/' + tok + '/face', D1);
    ok(r.status === 200 && r.json.data.dept === 'المواد الفلسفية', 'ويقرأ الواجهة المنشورة من رابطه', r.json);
    db.prepare("UPDATE face SET data = '' WHERE user_id = ?").run(uid);
    ok(!/tabN/.test((await call('GET', '/t/' + tok, D1)).raw), 'وإن سُحب النشر عاد إلى صفحة الإشعارات وحدها');
    ok((await call('GET', '/api/t/0000000000000000/face')).status === 404, 'ولا واجهة لرابط باطل');

    sent.length = 0;
    ok((await call('POST', '/api/t/' + tok + '/subscribe', D1, { subscription: { endpoint: 'http://x' } })).status === 400, 'يرفض اشتراكا غير صالح');
    r = await call('POST', '/api/t/' + tok + '/subscribe', D1, { subscription: SUB(1) });
    ok(r.status === 200 && sent.length === 1 && sent[0].m.title === 'تفعّلت إشعارات شعبة', 'التفعيل يرسل إشعار ترحيب', sent);
    await call('POST', '/api/t/' + tok + '/subscribe', D1, { subscription: SUB(1), quiet: true });
    ok(sent.length === 1, 'والتأكيد الصامت لا يكرره');
    ok((await call('GET', '/api/t/' + tok, D1)).json.devices === 1, 'والصفحة تعرف أنه مفعّل على جهازه');
    ok((await call('PUT', '/api/t/' + tok + '/prefs', bad.cookie, { start: false, endpoint: SUB(1).endpoint })).status === 403, 'ولا يغيّر اختياره من غير جهازه');
    const DS = await approved(tokS, AND, 'سالم العلي');
    await call('POST', '/api/t/' + tokS + '/subscribe', DS, { subscription: SUB(3), quiet: true });
    r = await call('GET', '/api/tpush/links', A);
    let la = r.json.links.find(l => l.name === 'أحمد الفهد');
    ok(la.devices === 1 && la.device && la.device.label === 'آيفون' && la.pending.length === 0, 'رئيس الشعبة يرى جهازه المقبول', la);

    // ── الفحص الدوري
    sent.length = 0;
    await tpush.tick(at(TUE, '07:50'));
    ok(sent.length === 1 && /t-1$/.test(sent[0].to) && sent[0].m.title === 'حصتك الأولى بعد 5 دقائق', 'التنبيه يصل جهازه هو وحده', sent);
    await tpush.tick(at(TUE, '07:51'));
    ok(sent.length === 1, 'ولا يتكرر في الدقيقة التالية');
    await tpush.tick(at(TUE, '08:40'));
    ok(sent.length === 2 && /t-3$/.test(sent[1].to) && /الثانية/.test(sent[1].m.title), 'وزميله يصله تنبيه حصته', sent.slice(1));

    // ── اختياره من صفحته
    r = await call('PUT', '/api/t/' + tok + '/prefs', D1, { start: false, endpoint: SUB(1).endpoint });
    ok(r.status === 200 && r.json.prefs.start === false && r.json.prefs.pre === true, 'يطفئ «عند البداية» من صفحته', r.json);
    sent.length = 0;
    await tpush.tick(at(TUE, '07:55'));
    ok(sent.length === 0, 'فلا يصله عند البداية');
    await tpush.tick(at(TUE, '08:35'));
    ok(sent.length === 1 && /نهاية/.test(sent[0].m.title), 'ويبقى ما لم يطفئه', sent);
    await call('PUT', '/api/t/' + tok + '/prefs', D1, { start: true, endpoint: SUB(1).endpoint });

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
    ok(sent[0].m.url === '/t/' + tokS + '#' + encodeURIComponent('الرسائل'), 'والرسالة تفتح «الرسائل»', sent[0].m.url);

    // ── «الرسائل»: الأرشيف ورقم غير المقروء
    ok((await call('GET', '/api/t/' + tokS + '/messages')).status === 403 && (await call('GET', '/api/t/' + tokS + '/messages', bad.cookie)).status === 403,
      'الأرشيف لا يُقرأ من غير جهازه');
    r = await call('GET', '/api/t/' + tokS + '/messages', DS);
    ok(r.status === 200 && r.json.messages.length === 2 && r.json.messages[0].title === 'تذكير' && r.json.messages[0].body === 'سلّم الخطة غداً'
      && r.json.messages[1].title === 'رسالة من رئيس الشعبة' && r.json.messages[0].at && r.json.seen === 0,
      'أرشيفه رسائله هو، الأحدث أولاً', r.json);
    ok((await call('GET', '/api/t/' + tok + '/messages', D1)).json.messages.length === 1, 'وزميله أرشيفه ما وصله وحده');
    ok((await call('GET', '/api/t/' + tokS, DS)).json.unread === 2, 'وصفحته تعرف رقم غير المقروء');
    ok((await call('POST', '/api/t/' + tokS + '/seen', DS, { id: r.json.messages[0].id })).status === 200
      && (await call('GET', '/api/t/' + tokS, DS)).json.unread === 0, 'وفتح «الرسائل» يصفّره');
    await call('POST', '/api/t/' + tokS + '/seen', DS, { id: 1 });
    ok((await call('GET', '/api/t/' + tokS + '/messages', DS)).json.seen === r.json.messages[0].id, 'ولا يرجع إلى الوراء');
    ok((await call('POST', '/api/t/' + tokS + '/seen', bad.cookie, { id: 1 })).status === 403, 'ولا يغيّره غير جهازه');
    await call('PUT', '/api/t/' + tokS + '/prefs', DS, { pre: false, start: false, end: false, endpoint: SUB(3).endpoint });
    sent.length = 0;
    await call('POST', '/api/tpush/send', A, { to: ['سالم العلي'], body: 'رسالة' });
    ok(sent.length === 1, 'والرسالة الحرة تصل ولو أطفأ تنبيهات الحصص');
    ok((await call('GET', '/api/t/' + tokS, DS)).json.unread === 1, 'والجديدة بعد الفتح تُعدّ وحدها');

    // ── جهاز ألغى اشتراكه ⟵ يحذف
    reject = { 'https://push.example.com/t-1': 410 };
    await call('POST', '/api/tpush/send', A, { to: ['أحمد الفهد'], body: 'x' });
    ok(!db.prepare('SELECT 1 FROM teacher_subs WHERE endpoint = ?').get(SUB(1).endpoint), 'الجهاز الذي رد ٤١٠ يحذف اشتراكه');
    reject = null;
    await call('POST', '/api/t/' + tok + '/subscribe', D1, { subscription: SUB(1), quiet: true });

    // ── الإيقاف من صفحته
    await call('POST', '/api/t/' + tok + '/unsubscribe', D1, { endpoint: SUB(1).endpoint });
    ok(!db.prepare('SELECT 1 FROM teacher_subs WHERE endpoint = ?').get(SUB(1).endpoint), 'يوقف إشعاراته من صفحته');
    await call('POST', '/api/t/' + tok + '/subscribe', D1, { subscription: SUB(1), quiet: true });

    // ── جهاز جديد يُقبل: يوقف القديم (جهاز واحد لكل معلم)
    const D2 = await approved(tok, AND, 'أحمد الفهد');
    ok((await call('GET', '/api/t/' + tok, D1)).json.state === 'gone' && (await call('GET', '/api/t/' + tok, D2)).json.state === 'ok',
      'قبول جهاز جديد يوقف القديم');
    ok(!db.prepare('SELECT 1 FROM teacher_subs WHERE endpoint = ?').get(SUB(1).endpoint), 'وتحذف اشتراكات القديم');
    sent.length = 0;
    await call('POST', '/api/tpush/send', A, { to: ['أحمد الفهد'], body: 'x' });
    ok(sent.length === 0, 'فلا يصله شيء');
    await call('POST', '/api/t/' + tok + '/subscribe', D2, { subscription: SUB(2), quiet: true });
    // ── إلغاء الجهاز من ملف المعلم
    ok((await call('POST', '/api/tpush/drop', A, { name: 'أحمد الفهد' })).status === 200
      && (await call('GET', '/api/t/' + tok, D2)).json.state === 'gone' && !db.prepare('SELECT 1 FROM teacher_subs WHERE endpoint = ?').get(SUB(2).endpoint),
      'إلغاء الجهاز من ملفه يوقفه ويحذف اشتراكه');
    // ── حد الطلبات المعلقة
    for (let i = 0; i < 3; i++) await call('POST', '/api/t/' + tok + '/ask', null, {}, AND);
    ok((await call('POST', '/api/t/' + tok + '/ask', null, {}, AND)).status === 429, 'ولا يقبل أكثر من ثلاثة طلبات معلقة');

    // ── ما سبق الميزة بلا جهاز: يحذف عند الإقلاع
    db.prepare('INSERT INTO teacher_subs (endpoint,token,p256dh,auth) VALUES (?,?,?,?)').run('https://push.example.com/old', tokS, 'x', 'y');
    delete require.cache[require.resolve('../tpush')]; require('../tpush');
    ok(!db.prepare('SELECT 1 FROM teacher_subs WHERE endpoint = ?').get('https://push.example.com/old'), 'الاشتراك القديم بلا جهاز يحذف فيطلب القبول من جديد');

    // ── الإبطال
    r = await call('POST', '/api/tpush/link', A, { name: 'أحمد الفهد', renew: true });
    ok(r.json.token !== tok && r.json.devices === 0, 'الإبطال يصدر رابطا جديدا بلا أجهزة', r.json);
    ok((await call('GET', '/api/t/' + tok)).status === 404, 'والرابط القديم لا يعمل');
    ok(!db.prepare('SELECT 1 FROM teacher_subs WHERE token = ?').get(tok) && !db.prepare('SELECT 1 FROM teacher_devices WHERE token = ?').get(tok),
      'وأجهزته وطلباته القديمة حذفت');

    // ── مواعيد التسليم: من الوثيقة إلى جهازه، و«سُلّم» يوقفها
    const tok2 = (await call('POST', '/api/tpush/link', A, { name: 'أحمد الفهد' })).json.token;
    const D7 = await approved(tok2, AND, 'أحمد الفهد');
    await call('POST', '/api/t/' + tok2 + '/subscribe', D7, { subscription: SUB(7), quiet: true });
    db.prepare('UPDATE shouba SET data = ? WHERE user_id = ?').run(JSON.stringify(DLS), uid);
    r = await call('GET', '/api/t/' + tok2, D7);
    ok(r.json.deadlines && r.json.deadlines.length >= 1 && r.json.deadlines.every(x => x.title && x.date && x.when && !x.to && !x.done),
      'صفحته تعطي مواعيده القادمة بعنوانها وتاريخها وحدهما', r.json.deadlines);
    sent.length = 0;
    const his = () => sent.filter(x => /t-7$/.test(x.to));
    await tpush.tick(at(TUE, '07:00'));
    ok(his().length === 1 && his()[0].m.title === 'غداً موعد تسليم' && his()[0].m.body === 'تسليم مشروع الوحدة الثانية',
      'الفحص يرسل تنبيه الموعد إلى جهازه', sent);
    ok(sent.filter(x => /t-3$/.test(x.to)).map(x => x.m.body).sort().join('|') === 'تسليم مشروع الوحدة الثانية|ليس له',
      'وزميله تصله مواعيده هو', sent);
    await tpush.tick(at(TUE, '07:01'));
    ok(his().length === 1, 'ولا يتكرر');
    const DONE = JSON.parse(JSON.stringify(DLS)); DONE.deadlines[0].done = ['أحمد الفهد'];
    db.prepare('UPDATE shouba SET data = ? WHERE user_id = ?').run(JSON.stringify(DONE), uid);
    await tpush.tick(at('2026-11-11', '07:00'));
    ok(his().length === 1 && sent.some(x => /t-3$/.test(x.to) && x.m.title === 'اليوم موعد تسليم' && x.m.body === 'تسليم مشروع الوحدة الثانية'),
      'ومن أُشّر له «سُلّم» لا يصله تنبيه يوم الموعد، ويصل من لم يسلّم', sent);

    // ── يوم مراقبة الشعبة: يصل المعلم المقبول، ولا يطفئه
    const DU = Object.assign({}, DLS, { duty: { 'الثلاثاء': true } });
    db.prepare('UPDATE shouba SET data = ? WHERE user_id = ?').run(JSON.stringify(DU), uid);
    await call('PUT', '/api/t/' + tok2 + '/prefs', D7, { pre: false, start: false, end: false, endpoint: SUB(7).endpoint });
    sent.length = 0;
    await tpush.tick(at(TUE, '10:15'));
    ok(his().length === 1 && his()[0].m.title === 'مراقبة الشعبة بعد 5 دقائق' && his()[0].m.url === '/t/' + tok2 + '#' + encodeURIComponent('المواعيد'),
      'المراقبة تصل المعلم قبل الفرصة ولو أطفأ تنبيهات الحصص', sent);
    await tpush.tick(at(TUE, '10:16'));
    ok(his().length === 1, 'ولا تتكرر');

    // ── من أزيل من الشعبة سكت رابطه
    db.prepare('UPDATE shouba SET data = ? WHERE user_id = ?').run(JSON.stringify(Object.assign({}, DATA, { teachers: ['أحمد الفهد'] })), uid);
    ok((await call('GET', '/api/t/' + tokS)).status === 404, 'المعلم المزال: رابطه لا يعمل');
    ok(!(await call('GET', '/api/tpush/links', A)).json.links.some(l => l.name === 'سالم العلي'), 'ولا يظهر في الروابط');
  } catch (e) { fail++; console.log('✗ استثناء:', e.stack); }
  srv.close();
  console.log(`\n${pass} ناجحة · ${fail} فاشلة`);
  process.exit(fail ? 1 : 0);
}
