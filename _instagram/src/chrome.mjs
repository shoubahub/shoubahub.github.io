/* ===================================================================
   شعبة · تحكم بكروم المثبت عبر بروتوكول التحكم (CDP) — بلا مكتبات ولا تنزيل متصفح
   ────────────────────────────────────────────────────────────────
   launch() يطلق كروم ويعيد صفحة واحدة: goto · eval · emulate · setClock
   · click · waitFor · hide · shot · close.
   ⚠ لا تستعمل --screenshot في وضع headless=new: يلتقط ثم يبقى كروم معلقا.
   ⚠ الخط يحمل من الانترنت (كالمنصة نفسها): FONTS_READY ينتظره صراحة قبل
     الالتقاط — document.fonts.ready وحده يرجع قبل وصول ورقة الخطوط.
   =================================================================== */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const sleep = ms => new Promise(r => setTimeout(r, ms));

/* يرجع true ان حمل «بلكس» بأوزانه الخمسة */
export const FONTS_READY = `Promise.all(['300','400','500','600','700'].map(w =>
    document.fonts.load(w + ' 40px "IBM Plex Sans Arabic"', 'نظم شعبة')))
  .then(() => document.fonts.ready)
  .then(() => document.fonts.check('700 40px "IBM Plex Sans Arabic"', 'نظم'))`;

/* ساعة ثابتة للصفحة: كل Date يعطي الوقت المطلوب نفسه ولا يمضي — فتخرج اللقطة
   بالرقم نفسه كل مرة (عداد «باقي» في اللوحة لا يتحرك بين التحميل والالتقاط) */
const clockScript = iso => `(() => {
  const R = Date, T = new R(${JSON.stringify(iso)}).getTime();
  if (isNaN(T)) return;
  function D(...a) {
    if (!new.target) return new R(T).toString();
    return a.length ? new R(...a) : new R(T);
  }
  D.prototype = R.prototype; D.now = () => T; D.parse = R.parse; D.UTC = R.UTC;
  globalThis.Date = D;
})();`;

function exited(proc, ms) {
  return new Promise(res => {
    if (proc.exitCode !== null || proc.signalCode) return res(true);
    const t = setTimeout(() => res(false), ms);
    proc.once('exit', () => { clearTimeout(t); res(true); });
  });
}

/* profile: مجلد ملف شخصي تبقى فيه الجلسة — وبدونه مجلد مؤقت يمحى عند الاغلاق */
export async function launch({ headless = true, profile = null } = {}) {
  if (!fs.existsSync(CHROME)) throw new Error('لم يوجد كروم في ' + CHROME + ' — اضبط CHROME_PATH');
  const temp = !profile;
  const dir = profile || fs.mkdtempSync(path.join(os.tmpdir(), 'shuba-ig-chrome-'));
  fs.mkdirSync(dir, { recursive: true });
  const portFile = path.join(dir, 'DevToolsActivePort');
  fs.rmSync(portFile, { force: true });

  const args = ['--remote-debugging-port=0', `--user-data-dir=${dir}`, '--no-first-run',
    '--no-default-browser-check', '--hide-scrollbars'];
  if (headless) args.push('--headless=new', '--disable-gpu');
  const proc = spawn(CHROME, [...args, 'about:blank'], { stdio: 'ignore' });
  const onInt = () => { proc.kill(); process.exit(130); };
  process.once('SIGINT', onInt);

  let port = null, wsUrl = null;
  for (let i = 0; i < 100 && !port; i++) {
    await sleep(100);
    try { port = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim() || null; } catch {}
  }
  for (let i = 0; port && i < 50 && !wsUrl; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      wsUrl = (list.find(t => t.type === 'page') || {}).webSocketDebuggerUrl || null;
    } catch {}
    if (!wsUrl) await sleep(100);
  }
  if (!wsUrl) {
    proc.kill(); process.off('SIGINT', onInt);
    throw new Error('لم يستجب كروم — هل مجلد الجلسة مفتوح في تشغيل آخر؟');
  }

  const pg = await connect(wsUrl);
  pg.close = async () => {
    try { await Promise.race([pg.send('Browser.close'), sleep(2000)]); } catch {}
    pg.ws.close();
    if (!(await exited(proc, 3000))) { proc.kill('SIGTERM'); if (!(await exited(proc, 2000))) proc.kill('SIGKILL'); }
    process.off('SIGINT', onInt);
    if (temp) fs.rmSync(dir, { recursive: true, force: true });
  };
  return pg;
}

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('تعذر الاتصال بكروم')); });
  let seq = 0;
  const waiting = new Map(), listeners = new Map();
  ws.onmessage = m => {
    const x = JSON.parse(m.data);
    if (x.id && waiting.has(x.id)) {
      const w = waiting.get(x.id); waiting.delete(x.id);
      x.error ? w.rej(new Error(w.method + ': ' + x.error.message)) : w.res(x.result);
    } else if (x.method) (listeners.get(x.method) || []).forEach(f => f(x.params));
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = ++seq; waiting.set(id, { res, rej, method });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const on = (ev, fn) => {
    listeners.set(ev, [...(listeners.get(ev) || []), fn]);
    return () => listeners.set(ev, (listeners.get(ev) || []).filter(f => f !== fn));
  };

  await send('Page.enable');
  await send('Network.enable');

  /* سكون الشبكة: لا طلب معلق نصف ثانية (كـ networkidle) */
  const inflight = new Set();
  let lastNet = Date.now();
  on('Network.requestWillBeSent', p => { inflight.add(p.requestId); lastNet = Date.now(); });
  const done = p => { inflight.delete(p.requestId); lastNet = Date.now(); };
  on('Network.loadingFinished', done);
  on('Network.loadingFailed', done);

  const pg = { ws, send, on };
  pg.eval = async expression => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception || {}).description || r.exceptionDetails.text);
    return r.result.value;
  };
  pg.goto = async (url, timeout = 20000) => {
    let loaded = false;
    const off = on('Page.loadEventFired', () => { loaded = true; });
    inflight.clear();
    const r = await send('Page.navigate', { url });
    if (r.errorText) { off(); throw new Error('تعذر فتح ' + url + ' — ' + r.errorText); }
    const t0 = Date.now();
    while (!loaded && Date.now() - t0 < timeout) await sleep(50);
    off();
    while (Date.now() - t0 < timeout && (inflight.size || Date.now() - lastNet < 500)) await sleep(50);
  };
  pg.emulate = async ({ width, height, scale = 1, mobile = false, touch = false, locale, timezone } = {}) => {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile });
    if (touch) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    if (locale) await send('Emulation.setLocaleOverride', { locale }).catch(() => {});
    if (timezone) await send('Emulation.setTimezoneOverride', { timezoneId: timezone }).catch(() => {});
  };
  let clockId = null;
  pg.setClock = async iso => {                       /* يسري من التنقل التالي */
    if (clockId) { await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: clockId }); clockId = null; }
    if (iso) clockId = (await send('Page.addScriptToEvaluateOnNewDocument', { source: clockScript(iso) })).identifier;
  };
  /* نص يجري في كل صفحة قبل سكربتاتها (بيانات وضع العرض) */
  pg.init = source => send('Page.addScriptToEvaluateOnNewDocument', { source });
  const q = s => JSON.stringify(s);
  pg.click = sel => pg.eval(`(() => { const el = document.querySelector(${q(sel)}); if (!el) return false; el.click(); return true; })()`);
  pg.waitFor = async (sel, timeout = 15000) => {
    for (const t0 = Date.now(); Date.now() - t0 < timeout; await sleep(100))
      if (await pg.eval(`!!document.querySelector(${q(sel)})`)) return true;
    return false;
  };
  pg.hide = sels => pg.eval(`${q(sels)}.forEach(s => document.querySelectorAll(s).forEach(e => e.style.visibility = 'hidden'))`);
  pg.shot = async (file, clip) => {
    const r = await send('Page.captureScreenshot', clip ? { format: 'png', clip: { ...clip, scale: 1 } } : { format: 'png' });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
  };
  return pg;
}
