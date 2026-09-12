// اختبار خطط التوزيع ومراجعة المالك — node tests/plans-test.js (2026-09-13، الخطوة ب)
// قاعدة مؤقتة في مجلد مؤقت (DB_PATH) وتطبيق express بمسارات plans.js نفسها، وحارس يحاكي رقم الادارة بترويسة
// الاختبار — فلا رقم ادارة يكتب ولا دخول. والخطط من ملف المختبر الحقيقي plans/plans-2026-2027-t1.json.
const os = require('os'), fs = require('fs'), path = require('path'), http = require('http');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shouba-plans-'));
process.env.DB_PATH = tmp;

const express = require('express');
const { db } = require('../db');
const plans = require('../plans');

const app = express();
app.use(express.json({ limit: '2mb' }));
const fakeAdmin = (req, res, next) => req.headers['x-test-admin'] === '1' ? next() : res.status(401).json({ error: 'رقم الإدارة غير صحيح' });
/* جلسة رئيس الشعبة محاكاة بترويسة الاختبار — بلا حساب ولا رقم سري */
const fakeUser = (req, res, next) => req.headers['x-test-user'] === '1' ? next() : res.status(401).json({ error: 'لم تسجل الدخول' });
plans.routes(app, fakeAdmin, fakeUser);

let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? '— ' + JSON.stringify(extra) : ''); } };

const srv = app.listen(0, run);
function call(method, url, admin, body) {
  return new Promise((done, no) => {
    const headers = {}, data = body ? Buffer.from(JSON.stringify(body)) : null;
    if (admin) headers['x-test-admin'] = '1';
    if (data) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = data.length; }
    const r = http.request({ port: srv.address().port, method, path: url, headers }, res => {
      const ch = []; res.on('data', c => ch.push(c));
      res.on('end', () => { let j = null; try { j = JSON.parse(Buffer.concat(ch).toString()); } catch (e) {} done({ status: res.statusCode, json: j }); });
    });
    r.on('error', no); if (data) r.write(data); r.end();
  });
}

async function run() {
  try {
    ok((await call('GET', '/api/admin/plans', false)).status === 401, 'بلا رقم الادارة: لا قائمة (٤٠١)');
    const L = await call('GET', '/api/admin/plans', true);
    const ps = L.json.plans || [];
    ok(L.status === 200 && L.json.set && L.json.set.id === '2026-2027-t1' && ps.length === 172, 'القائمة: ١٧٢ خطة من ملف الفصل الاول ٢٠٢٦/٢٠٢٧', L.json.set);
    ok(ps.every(p => p.decision === null) && ps.every(p => p.weeks > 0 || p.status !== 'ok') && !('lessons' in ps[0]),
       'قبل المراجعة لا قرار في خطة، والقائمة ملخص بلا دروس');
    const sound = ps.filter(p => p.status === 'ok'), weak = ps.filter(p => p.status !== 'ok');
    ok(sound.length === 160 && weak.length === 12, '١٦٠ سليمة و١٢ تراجع', [sound.length, weak.length]);

    const k = encodeURIComponent(sound[0].key);
    const one = await call('GET', '/api/admin/plans/one?key=' + k, true);
    ok(one.status === 200 && one.json.plan.weeks.length && one.json.plan.weeks[0].lessons.length && one.json.calendar.length >= 13,
       'الخطة الواحدة باسابيعها ودروسها وتقويم الفصل', one.json && one.json.calendar && one.json.calendar.length);
    ok((await call('GET', '/api/admin/plans/one?key=nope', true)).status === 404, 'خطة غير موجودة: ٤٠٤');

    ok((await call('POST', '/api/admin/plans/decision', false, { key: sound[0].key, decision: 'approved' })).status === 401, 'القرار بلا رقم الادارة: ٤٠١');
    ok((await call('POST', '/api/admin/plans/decision', true, { key: sound[0].key, decision: 'maybe' })).status === 400, 'قرار غير معروف يرفض');
    ok((await call('POST', '/api/admin/plans/decision', true, { key: 'nope', decision: 'approved' })).status === 404, 'قرار في خطة غير موجودة: ٤٠٤');
    const a = await call('POST', '/api/admin/plans/decision', true, { key: sound[0].key, decision: 'approved' });
    const r = await call('POST', '/api/admin/plans/decision', true, { key: sound[1].key, decision: 'rejected', note: 'تجربة' });
    const L2 = (await call('GET', '/api/admin/plans', true)).json.plans;
    ok(a.json.ok && r.json.ok && L2.find(p => p.key === sound[0].key).decision === 'approved'
       && L2.find(p => p.key === sound[1].key).decision === 'rejected' && L2.find(p => p.key === sound[1].key).note === 'تجربة',
       'يعتمد خطة، ويرد اخرى بملاحظة، ويظهر القرار في القائمة');
    await call('POST', '/api/admin/plans/decision', true, { key: sound[0].key, decision: null });
    ok((await call('GET', '/api/admin/plans', true)).json.plans.find(p => p.key === sound[0].key).decision === null, 'القرار يلغى (null) فتعود «تنتظر»');

    const bulk = await call('POST', '/api/admin/plans/approve-sound', true, {});
    const L3 = (await call('GET', '/api/admin/plans', true)).json.plans;
    ok(bulk.json.approved === 159 && L3.find(p => p.key === sound[1].key).decision === 'rejected'
       && L3.filter(p => p.decision === 'approved').length === 159 && L3.filter(p => p.status !== 'ok').every(p => p.decision === null),
       'اعتماد السليمة دفعة: ١٥٩ (لا يمس «لا تعتمد» السابق ولا الخطط التي تراجع)', bulk.json);
    ok((await call('POST', '/api/admin/plans/approve-sound', true, {})).json.approved === 0, 'اعتماد السليمة ثانية لا يعتمد شيئا');
    ok(db.prepare('SELECT COUNT(*) n FROM plan_reviews').get().n === 160, 'القرارات محفوظة في القاعدة (جدول plan_reviews)');

    // رئيس الشعبة (الخطوة ج): المعتمد لمرحلته وحدها، وبصمة «لا جديد»
    const U = (url) => new Promise((done, no) => { const r = http.request({ port: srv.address().port, method: 'GET', path: url, headers: { 'x-test-user': '1' } }, res => {
      const ch = []; res.on('data', c => ch.push(c)); res.on('end', () => { let j = null; try { j = JSON.parse(Buffer.concat(ch).toString()); } catch (e) {} done({ status: res.statusCode, json: j }); }); }); r.on('error', no); r.end(); });
    ok((await call('GET', '/api/plans?stage=' + encodeURIComponent('ثانوي'), false)).status === 401, 'خطط رئيس الشعبة بلا جلسة: ٤٠١');
    const sec = await U('/api/plans?stage=' + encodeURIComponent('ثانوي'));
    const secApproved = L3.filter(p => p.stageId === '17' && p.decision === 'approved').length;
    ok(sec.status === 200 && sec.json.plans.length === secApproved && sec.json.plans.every(p => p.weeks && p.weeks.length)
       && sec.json.calendar.length >= 13 && !sec.json.plans.some(p => p.key === sound[1].key) && typeof sec.json.v === 'string' && sec.json.v,
       'الثانوي: المعتمد وحده بأسابيعه وتقويم الفصل — لا المردود ولا ما ينتظر ولا غير مرحلته', [sec.json.plans.length, secApproved]);
    ok(sec.json.plans.every(p => p.key.split('|')[0] === '17'), 'كل خطة مرحلتها الثانوي (١٧)');
    const same = await U('/api/plans?stage=' + encodeURIComponent('ثانوي') + '&v=' + encodeURIComponent(sec.json.v));
    ok(same.json && same.json.same === true && !same.json.plans, 'البصمة نفسها: «لا جديد» بلا خطط');
    await call('POST', '/api/admin/plans/decision', true, { key: sec.json.plans[0].key, decision: null });
    const changed = await U('/api/plans?stage=' + encodeURIComponent('ثانوي') + '&v=' + encodeURIComponent(sec.json.v));
    ok(changed.json && !changed.json.same && changed.json.plans.length === secApproved - 1, 'الغاء اعتماد خطة يغير البصمة فتسقط من خطط رئيس الشعبة');
    ok((await U('/api/plans?stage=bad')).json.plans.length === 0, 'مرحلة غير معروفة: لا خطط');
  } catch (e) { fail++; console.log('✗ خطأ غير متوقع', e && e.stack); }
  srv.close();
  try { db.close(); fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  console.log('\n' + (fail ? '✗' : '✓') + ' ' + pass + ' سليم · ' + fail + ' معيب');
  process.exit(fail ? 1 : 0);
}
