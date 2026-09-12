/* ===================================================================
   شعبة · التقاط شاشات المنصة بمقاس الهاتف، دفعة واحدة
     node capture.mjs                  كل اللقطات — بوضع العرض (الافتراضي)
     node capture.mjs board-main.png   لقطة بعينها
     node capture.mjs --show           بمتصفح ظاهر (للتشخيص)
     node capture.mjs --live           من المنصة الحية بجلسة دخول، بدل وضع العرض
     node capture.mjs --login          الدخول للوضع الحي مرة واحدة
   ── وضع العرض: خادم المنصة المحلي + بيانات وهمية من demo.json + راية المعاينة
      shouba.sim التي يقبلها حارس الجلسة على localhost وحده — بلا حساب ولا دخول،
      ولا يمس المنصة الحية.
   ⚠ ويرفض الالتقاط ان اختلفت النسخة المحلية عن المنشورة، او كان في public
     تعديل غير مودع: المنشور لا يعد الا بما في المنصة المنشورة.
     (--force يتجاوز فرق النسخة للتجربة وحدها — ولا ينشر ما التقط به.)
   المخرج في screens/ بالاسماء المذكورة في posts.json.
   =================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { launch, sleep, FONTS_READY } from './src/chrome.mjs';
import { ROOT } from './src/templates.mjs';

const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'shots.json'), 'utf8'));
const D = CFG.defaults || {};
const SESSION = path.join(ROOT, '.session');
const SCREENS = path.join(ROOT, 'screens');
const REPO = path.resolve(ROOT, '..');
const LOCAL = /^(localhost|127\.0\.0\.1)$/;

/* ---------------------------------------------------------------- وضع العرض */
/* البيانات تكتب في مخزن المتصفح قبل سكربتات كل صفحة — وعلى localhost وحده */
function demoScript(demo) {
  return `(() => {
    if (!${LOCAL}.test(location.hostname)) return;
    try {
      sessionStorage.setItem('shouba.sim', '1');
      localStorage.setItem('shouba.setup', ${JSON.stringify(JSON.stringify(demo.setup))});
      localStorage.setItem('shouba.user', ${JSON.stringify(JSON.stringify(demo.user))});
      localStorage.removeItem('shouba.owner');
    } catch (e) {}
  })();`;
}

async function buildOf(base) {
  try { return (await (await fetch(base + '/version.json', { cache: 'no-store' })).json()).build ?? null; }
  catch { return null; }
}

/* الصدق: النسخة المحلية هي المنشورة، ولا تعديل غير مودع في public (عدا _dev) */
async function honesty(localBase) {
  const [loc, live] = await Promise.all([buildOf(localBase), buildOf(CFG.base)]);
  if (loc == null) return { fatal: `خادم المنصة المحلي لا يجيب على ${localBase} — شغله أولا`, issues: [] };
  const issues = [];
  if (live == null) issues.push('تعذر معرفة بناء المنصة المنشورة — تحقق من الاتصال');
  else if (loc !== live) issues.push(`النسخة المحلية بناء ${loc} والمنشورة بناء ${live}`);
  try {
    const dirty = execFileSync('git', ['status', '--porcelain', '--', 'public', ':(exclude)public/_dev'],
      { cwd: REPO, encoding: 'utf8' }).trim();
    if (dirty) issues.push('في public تعديلات غير مودعة:\n' + dirty);
  } catch { issues.push('تعذر فحص git'); }
  return { fatal: null, issues, build: loc };
}

/* ---------------------------------------------------------------- الوضع الحي */
/* الدخول مرة واحدة: نافذة ظاهرة، وتكتشف الاداة نجاحه وحدها (api/me يجيب بنجاح)
   فتحفظ الجلسة وتغلق — بلا ضغط Enter، فيشغلها المستخدم او كلود سواء */
async function login() {
  const pg = await launch({ headless: false, profile: SESSION });
  let closed = false, ok = false;
  pg.ws.addEventListener('close', () => { closed = true; });
  /* السؤال يسقط اثناء التنقل بين الصفحات — فيعد «لم يدخل بعد» ولا يعلق */
  const me = () => Promise.race([
    pg.eval(`fetch('/api/me', { credentials: 'include', cache: 'no-store' }).then(r => r.ok, () => false)`).catch(() => false),
    sleep(3000).then(() => false)]);
  try {
    await pg.goto(CFG.base + '/login.html').catch(() => {});
    console.log('سجل الدخول في النافذة المفتوحة — تغلق وحدها بعد نجاحه (المهلة عشر دقائق).');
    for (const t0 = Date.now(); !closed && Date.now() - t0 < 10 * 60000; await sleep(1500))
      if (await me()) { ok = true; break; }
    if (ok) await sleep(1500);                      /* تستقر الكعكة قبل الاغلاق */
  } finally { await pg.close(); }
  console.log(ok ? 'تم الدخول — حفظت الجلسة في .session/'
    : closed ? 'أغلقت النافذة قبل الدخول — لم تحفظ جلسة.' : 'انتهت المهلة قبل الدخول.');
  if (!ok) process.exitCode = 1;
}

/* ---------------------------------------------------------------- الالتقاط */
async function capture(only, { show, live, force }) {
  const shots = (CFG.shots || []).filter(s => !only || s.file === only);
  if (!shots.length) { console.log('لا لقطة بهذا الاسم:', only); process.exitCode = 1; return; }

  const demo = !live && CFG.demo;
  let base = CFG.base, profile = SESSION, init = null;
  if (demo) {
    base = demo.base;
    if (!LOCAL.test(new URL(base).hostname)) throw new Error('وضع العرض على الجهاز المحلي وحده — demo.base يجب ان يكون localhost');
    const h = await honesty(base);
    if (h.fatal) { console.log('⛔', h.fatal); process.exitCode = 1; return; }
    h.issues.forEach(x => console.log('⛔', x));
    if (h.issues.length && !force) { console.log('لم يلتقط شيء — المنشور لا يعد الا بما في المنصة المنشورة.'); process.exitCode = 1; return; }
    console.log(`وضع العرض · بناء ${h.build}${h.issues.length ? ' (تجاوز بـ --force — لا تنشر هذه اللقطات)' : ' = المنشور'}`);
    profile = null;                                   /* ملف مؤقت: لا جلسة ولا بقايا */
    init = demoScript(JSON.parse(fs.readFileSync(path.join(ROOT, demo.data), 'utf8')));
  }
  fs.mkdirSync(SCREENS, { recursive: true });

  const pg = await launch({ headless: !show, profile });
  try {
    /* هاتف: عرضه وكثافته من الاعداد، واللمس مفعل، وبتوقيت الكويت ولغتها */
    await pg.emulate({ width: D.width ?? 390, height: D.height ?? 844, scale: D.scale ?? 2,
      mobile: true, touch: true, locale: 'ar-KW', timezone: 'Asia/Kuwait' });
    if (init) await pg.init(init);
    for (const s of shots) {
      const url = /^https?:/.test(s.path) ? s.path : base + s.path;
      await pg.setClock(s.clock ?? D.clock ?? null);
      await pg.goto(url);

      if ((await pg.eval('location.pathname')).includes('login') && !s.path.includes('login')) {
        console.log(`! ${s.file}: أعيد التوجيه إلى صفحة الدخول`
          + (demo ? ' — راية المعاينة لم تقبل' : ' — شغل node capture.mjs --login أولا'));
        continue;
      }
      if (s.click && !(await pg.click(s.click))) console.log(`تنبيه · ${s.file}: لم يوجد ${s.click} للضغط`);
      if (s.wait_for && !(await pg.waitFor(s.wait_for))) console.log(`تنبيه · ${s.file}: لم يظهر ${s.wait_for}`);
      await sleep(s.wait_ms ?? D.wait_ms ?? 900);
      const hide = s.hide || D.hide || [];
      if (hide.length) await pg.hide(hide);
      await pg.eval(FONTS_READY);

      await pg.shot(path.join(SCREENS, s.file));
      console.log(`${s.file} ← ${url}`);
    }
  } finally { await pg.close(); }
}

const args = process.argv.slice(2);
const flag = f => args.includes(f);
if (flag('--login')) await login();
else await capture(args.find(a => !a.startsWith('--')), { show: flag('--show'), live: flag('--live'), force: flag('--force') });
