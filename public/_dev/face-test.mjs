// اختبار واجهة الشعبة المنشورة — node public/_dev/face-test.mjs (2026-09-20)
// يشغل الخادم على قاعدة مؤقتة ومنفذ حر، وينشئ حسابا بجلسته، ثم يفحص:
// النشر · القراءة العامة بلا حساب · بوابة الصور · سحب النشر · ومنع تسرب ما لم ينشر.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { createRequire } from 'module';
const require2 = createRequire(import.meta.url);

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const DB = fs.mkdtempSync(path.join(os.tmpdir(), 'shouba-face-'));
const PORT = 4173 + Math.floor(Math.random() * 300);
const BASE = `http://127.0.0.1:${PORT}`;

let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? '— ' + JSON.stringify(extra) : ''); } };

const srv = spawn('node', ['server.js'], {
  cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'],
  env: { ...process.env, PORT: String(PORT), DB_PATH: DB, ADMIN_PIN: 'test-000000', NODE_ENV: 'test', FACE_BETA: 'facetest' }
});
const stop = () => { try { srv.kill(); } catch {} fs.rmSync(DB, { recursive: true, force: true }); };
process.on('exit', stop);

function tdbRows() {
  const D = require2('better-sqlite3');
  const d = new D(path.join(DB, 'shouba.db'), { readonly: true });
  const n = d.prepare('SELECT COUNT(*) AS n FROM face').get().n;
  d.close();
  return n > 1;   /* اكثر من سطر واحد = ولد رمز لغير صاحب المنصة */
}
async function up() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${BASE}/health`); if (r.ok) return true; } catch {}
    await new Promise(r => setTimeout(r, 150));
  }
  return false;
}
ok(await up(), 'الخادم يعمل على قاعدة مؤقتة');

// حساب بجلسته — رمز الدعوة يكتب في القاعدة المؤقتة مباشرة (لا باب ادارة في الاختبار)
let cookie = '';
const jar = r => { const c = r.headers.get('set-cookie'); if (c) cookie = c.split(';')[0]; };
const H = (extra = {}) => ({ 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...extra });

const Database = (await import('better-sqlite3')).default;
const tdb = new Database(path.join(DB, 'shouba.db'));
tdb.prepare("INSERT INTO settings (key,value) VALUES ('invite','TESTCODE') ON CONFLICT(key) DO UPDATE SET value=excluded.value").run();
tdb.close();

let r = await fetch(`${BASE}/api/register`, { method: 'POST', headers: H(),
  body: JSON.stringify({ username: 'facetest', pin: '482913', displayName: 'محمد البراك', inviteCode: 'TESTCODE' }) });
jar(r);
ok(r.ok, 'حساب رئيس شعبة بجلسته', await r.clone().text().catch(() => ''));

// رمز الرابط ينشأ قبل النشر وثابت
const me1 = await (await fetch(`${BASE}/api/face/me`, { headers: H() })).json();
const me2 = await (await fetch(`${BASE}/api/face/me`, { headers: H() })).json();
ok(/^[0-9a-f]{10}$/.test(me1.slug) && me1.slug === me2.slug, 'الرمز عشوائي وثابت من اول يوم', me1);
ok(me1.published === false, 'قبل النشر: الواجهة غير منشورة');

// قبل النشر لا شيء على الرابط
ok((await fetch(`${BASE}/api/face/${me1.slug}`)).status === 404, 'الرابط قبل النشر: لا واجهة');

// صورتان في الخزانة: واحدة تنشر والاخرى لا
/* الخزانة تقبل JPEG وPDF وحدهما (sniff في files.js): اصغر جسم يبدأ ببصمة JPEG */
const png = Buffer.from('ffd8ff' + 'db'.repeat(64), 'hex');
async function put() {
  const res = await fetch(`${BASE}/api/files?rec=r0000000000000000000000001`, { method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', Cookie: cookie }, body: png });
  return res.json();
}
const shown = await put(), hidden = await put();
ok(!!shown.id && !!hidden.id, 'صورتان في خزانة الحساب', { shown, hidden });

// النشر
const pub = await (await fetch(`${BASE}/api/face/publish`, { method: 'POST', headers: H(),
  body: JSON.stringify({ data: { diary: [{ at: '2026-09-18', text: 'زيارة صفية', photo: shown.id }] } }) })).json();
ok(pub.rev === 1 && pub.files === 1, 'النشر يسجل صورة الواجهة وحدها', pub);

// القراءة العامة بلا اي جلسة
const open = await fetch(`${BASE}/api/face/${me1.slug}`);
const body = await open.json();
ok(open.ok && body.data.diary[0].text === 'زيارة صفية', 'الزائر يقرأ الواجهة بلا حساب');
ok(open.headers.get('x-robots-tag')?.includes('noindex'), 'الرابط غير مفهرس');

// بوابة الصور
const sOK = await fetch(`${BASE}/api/pub/file/${shown.id}`);
ok(sOK.ok && (sOK.headers.get('content-type') || '').startsWith('image/'), 'صورة الواجهة تفتح للزائر بلا حساب');
ok((await fetch(`${BASE}/api/pub/file/${hidden.id}`)).status === 404, 'ما لم ينشر لا يفتح ولو عرف معرفه');
ok((await fetch(`${BASE}/api/files/${shown.id}`)).status === 401, 'خزانة المرفقات تبقى مغلقة على الزائر');

// سحب النشر
await fetch(`${BASE}/api/face/publish`, { method: 'DELETE', headers: H() });
ok((await fetch(`${BASE}/api/face/${me1.slug}`)).status === 404, 'سحب النشر يفرغ الرابط');
ok((await fetch(`${BASE}/api/pub/file/${shown.id}`)).status === 404, 'وسحبه يغلق الصورة في الحال');
const me3 = await (await fetch(`${BASE}/api/face/me`, { headers: H() })).json();
ok(me3.slug === me1.slug, 'والرمز باق فلا يبطل رابط ارسله');

// رمز مخترع لا يعيد شيئا
ok((await fetch(`${BASE}/api/face/0123456789`)).status === 404, 'رمز مخترع: لا واجهة');

// صفحة الرابط لا تحول الى الدخول
const page = await fetch(`${BASE}/face/${me1.slug}`);
const html = await page.text();
ok(page.ok && !/login|تسجيل الدخول/i.test(html), 'صفحة الرابط لا تعيد الزائر الى الدخول');

// زميل في التجربة: لا يجد الخاصية اصلا (بوابة FACE_BETA)
const mine = cookie;
let z = await fetch(`${BASE}/api/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'zameel', pin: '112233', displayName: 'زميل التجربة', inviteCode: 'TESTCODE' }) });
const zc = (z.headers.get('set-cookie') || '').split(';')[0];
ok(z.ok, 'حساب زميل في التجربة');
const ZH = { 'Content-Type': 'application/json', Cookie: zc };
ok((await fetch(`${BASE}/api/face/me`, { headers: ZH })).status === 404, 'الزميل: لا باب للواجهة عنده');
ok((await fetch(`${BASE}/api/face/publish`, { method: 'POST', headers: ZH, body: JSON.stringify({ data: { x: 1 } }) })).status === 404,
  'والزميل لا ينشر ولو نادى المسار بنفسه');
ok(!tdbRows(), 'ولا يولد له رمز رابط اصلا');
cookie = mine;
ok((await fetch(`${BASE}/api/face/me`, { headers: H() })).ok, 'وصاحب المنصة يجدها كما هي');

// صفحتا الواجهة خلف البوابة (2026-10-20): الملفات الساكنة لا تخدمهما لغير مستخدم التجربة
const anon = { };
ok((await fetch(`${BASE}/face-admin.html`, { headers: anon })).status === 404, 'شاشة الادارة: الزائر بلا حساب لا يجدها');
ok((await fetch(`${BASE}/face-admin.html`, { headers: ZH })).status === 404, 'شاشة الادارة: الزميل لا يجدها');
const adm = await fetch(`${BASE}/face-admin.html`, { headers: H() });
ok(adm.ok && (await adm.text()).includes('face-data.js'), 'شاشة الادارة: لصاحب المنصة');
ok((await fetch(`${BASE}/face.html`, { headers: anon })).status === 404, 'الصفحة مباشرة (face.html): مغلقة على الزائر — بابه /face/<الرمز>');
ok((await fetch(`${BASE}/face.html?preview=1`, { headers: ZH })).status === 404, 'والزميل لا يفتح المعاينة');
ok((await fetch(`${BASE}/face.html?preview=1`, { headers: H() })).ok, 'وصاحب المنصة يعاين بها');

// النسخة بشكلها الجديد تقرأ كما نشرت، والصفحة الحقيقية تخدم على الرابط
const snap = { v: 1, dept: 'علم النفس والفلسفة', days: ['الأحد'], times: [{ n: 1, from: '07:30', to: '08:15' }],
  people: [{ name: 'فيصل', subj: 'علم نفس', wk: { 'الأحد': ['12/1 · علم نفس'] } }],
  week: { kind: 'quote', text: 'العلم نور', who: '', to: '2099-01-01' },
  events: [{ title: 'ملتقى', date: '2026-10-01', who: [], about: '', photos: [shown.id], done: true }], stats: { meetings: 2 } };
const p2 = await (await fetch(`${BASE}/api/face/publish`, { method: 'POST', headers: H(), body: JSON.stringify({ data: snap }) })).json();
ok(p2.files === 1, 'صورة الفعالية في النسخة تفتح بابها', p2);
const back = await (await fetch(`${BASE}/api/face/${me1.slug}`)).json();
ok(JSON.stringify(back.data) === JSON.stringify(snap), 'النسخة تعود للزائر كما نشرت حرفا');
const pg = await fetch(`${BASE}/face/${me1.slug}`);
const pgt = await pg.text();
ok(pg.ok && pgt.includes('face-data.js') && pgt.includes('<base href="../"'), 'الرابط يخدم صفحة الزائر نفسها، واصولها من الجذر');
ok((pg.headers.get('x-robots-tag') || '').includes('noindex'), 'وصفحة الرابط غير مفهرسة');
ok(!/shell\.css|components\.css|frame\.css|components\.js/.test(pgt) && pgt.includes('face.css'), 'صفحة عرض مستقلة: لا تحمل قطع المنصة (tokens وface وحدهما)');
ok((await fetch(`${BASE}/face-data.js`)).ok && (await fetch(`${BASE}/face.css`)).ok, 'واصولها تفتح للزائر بلا حساب');

// بلا FACE_BETA: كل شيء مغلق ولو بجلسة صاحب المنصة (خادم ثان على القاعدة نفسها)
const PORT2 = PORT + 1, BASE2 = `http://127.0.0.1:${PORT2}`;
const srv2 = spawn('node', ['server.js'], {
  cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'],
  env: { ...process.env, PORT: String(PORT2), DB_PATH: DB, ADMIN_PIN: 'test-000000', NODE_ENV: 'test', FACE_BETA: '' }
});
let up2 = false;
for (let i = 0; i < 60 && !up2; i++) { try { up2 = (await fetch(`${BASE2}/health`)).ok; } catch {} if (!up2) await new Promise(r => setTimeout(r, 150)); }
ok(up2, 'خادم ثان بلا FACE_BETA');
ok((await fetch(`${BASE2}/face/${me1.slug}`)).status === 404, 'بلا FACE_BETA: الرابط لا يرد ولو نشر');
ok((await fetch(`${BASE2}/face-admin.html`, { headers: H() })).status === 404, 'بلا FACE_BETA: لا شاشة ادارة ولو لصاحب المنصة');
ok((await fetch(`${BASE2}/api/face/me`, { headers: H() })).status === 404, 'بلا FACE_BETA: والزر الاوسط يبقى «+» (me ترد ٤٠٤)');
try { srv2.kill(); } catch {}

console.log(`\n${fail ? '✗' : '✓'} ${pass} سليم · ${fail} معيب`);
stop();
process.exit(fail ? 1 : 0);
