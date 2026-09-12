/* ===================================================================
   شعبة · تصيير منشورات انستجرام (Node + كروم المثبت — بلا Python)
     node render.mjs                كل المنشورات، ثم معاينة صفحة الحساب out/_grid.png
     node render.mjs p-001-jadwal   منشور بعينه
     node render.mjs --check        فحص القواعد بلا تصيير
   المخرج: out/<id>/01.png … بمقاس 4:5 (1080×1350)، ومعه caption.txt
   ⚠ مقاس واحد: شبكة صفحة الحساب في انستجرام طولية 3:4 وتعرض من الغلاف وسطه بعرض ثلاثة
     أرباع طوله — فالمربع كان يفقد ١٣٥ نقطة من كل جانب، و4:5 يفقد ٣٤ فقط. والقوالب مصممة
     عليه، وشرائح المنشور الواحد تعرض بمقاس أولاها. الفحص يقيس ما يخرج عن الشبكة.
   =================================================================== */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, FONTS_READY } from './src/chrome.mjs';
import { renderSlide, page, captionOf, ROOT, TEMPLATES } from './src/templates.mjs';

const W = 1080, H = 1350;
const CYCLE = ['نظِّم', 'تابِع', 'أصدِر'];
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

/* ---------------------------------------------------------------- الفحص
   قواعد اتفق عليها: ينبه على خرقها ولا يمنع التصيير */
function check(posts, shots, cfg) {
  const w = [];
  const flow = posts.filter(p => p.pinned !== true);
  flow.forEach((p, i) => {
    const want = CYCLE[i % 3];
    if (p.column !== want) w.push(`${p.id}: خارج الدور — المتوقع «${want}» والموجود «${p.column}»`);
  });

  const declared = new Set((shots.shots || []).map(s => s.file));
  for (const p of posts) {
    const cover = p.slides[0] || {};
    if (String(cover.title || '').trim().split(/\s+/).length > 4)
      w.push(`${p.id}: عنوان الغلاف أطول من أربع كلمات — يختفي في مقاس الشبكة`);
    if (cover.template === 'z') w.push(`${p.id}: الغلاف بقالب z — الهاتف هو الافتراضي للأغلفة`);
    if (p.slides.length > 20) w.push(`${p.id}: الشرائح أكثر من عشرين — انستجرام يقبل عشرين`);
    const cap = String(p.caption || '');
    if ([cfg.domain, cfg.name].some(x => x && cap.includes(x)))
      w.push(`${p.id}: التوقيع مكتوب باليد في النص — اكتب {sign} ليؤخذ من الاعداد`);
    if (cap.includes('{domain}')) w.push(`${p.id}: {domain} لم يعد مستعملا — اكتب {sign}`);
    for (const s of p.slides) {
      const t = s.template || 'a';
      if (!TEMPLATES.includes(t)) w.push(`${p.id}: قالب غير معروف «${t}»`);
      if (t !== 'a' && t !== 'b') continue;
      if (!s.screen) { w.push(`${p.id}: شريحة بإطار هاتف بلا لقطة`); continue; }
      if (!declared.has(s.screen)) w.push(`${p.id}: اللقطة ${s.screen} غير مذكورة في shots.json — لن تلتقط`);
      if (!fs.existsSync(path.join(ROOT, 'screens', s.screen))) w.push(`${p.id}: اللقطة غير موجودة في screens/ — ${s.screen}`);
    }
  }

  const covers = flow.map(p => p.slides[0] || {});
  if (covers.length && covers.filter(c => c.template === 'z').length * 3 > covers.length)
    w.push('أغلفة التكبير أكثر من واحد في كل ثلاثة');
  return w;
}

/* يقاس في الشريحة المرسومة نفسها، لا بالعين:
   ① التداخل — في كل شريحة
   ② الخروج عن منطقة الشبكة (وسط السطح بعرض ثلاثة أرباع طوله) — في الغلاف وحده، لان صفحة
      الحساب لا تعرض غيره وبقية الشرائح تفتح كاملة. ويقاس بمدى النص الفعلي لا صندوقه.
   ⚠ لا يرى الحركات النازلة عن السطر (يقيس الصناديق لا الحبر) — فالنظر في الشريحة باق لازما. */
const LAYOUT = cover => `(() => {
  const r = s => { const el = document.querySelector(s); return el ? el.getBoundingClientRect() : null; };
  const hit = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const foot = r('.foot'), phone = r('.phone'), zoom = r('.zoom'), text = r('.cap') || r('.side-txt');
  const out = [];
  if (hit(foot, phone)) out.push('النطاق تحت إطار الهاتف');
  if (hit(foot, zoom))  out.push('النطاق تحت بطاقة التكبير');
  if (hit(text, phone)) out.push('النص يتداخل مع إطار الهاتف');
  if (hit(text, zoom))  out.push('النص يتداخل مع بطاقة التكبير');
  if (!${cover}) return out;

  const cv = document.querySelector('.cv').getBoundingClientRect();
  const m = (cv.width - Math.min(cv.width, cv.height * 0.75)) / 2 + 6;
  const ext = el => { if (el.tagName === 'IMG') return el.getBoundingClientRect();
    const g = document.createRange(); g.selectNodeContents(el); return g.getBoundingClientRect(); };
  const PARTS = [['h1', 'العنوان'], ['.cap p, .side-txt p, .hd p, .n-sub', 'السطر الفرعي'], ['.step', 'المرحلة'],
                 ['.lock img, .hd-mark', 'الشعار'], ['.foot', 'التوقيع'], ['.big', 'الرقم'], ['.hd-arrow', 'السهم']];
  const off = [];
  PARTS.forEach(([sel, name]) => document.querySelectorAll(sel).forEach(el => {
    const b = ext(el);
    if (b.width && (b.left < m || b.right > cv.width - m) && off.indexOf(name) === -1) off.push(name);
  }));
  if (off.length) out.push('الغلاف تقصه شبكة الحساب: ' + off.join('، '));
  return out;
})()`;

/* ---------------------------------------------------------------- معاينة صفحة الحساب
   كما في انستجرام: ثلاثة أعمدة بمربعات 3:4، الأحدث أولا من اليسار، والمثبت في الصدر بعلامته */
const PIN = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 2.5l6 6-2 1.2-1.3-1.3-3.6 3.6.4 4.6-1.6 1.6-3.9-3.9L4 19.8 3 20.8l-.2-.2 5.5-5.6L4.4 11.1 6 9.5l4.6.4 3.6-3.6-1.3-1.3z"/></svg>';
async function grid(pg, posts, tmp) {
  const tiles = [...posts.filter(p => p.pinned === true).reverse().map(p => ({ p, pin: true })),
                 ...posts.filter(p => p.pinned !== true).reverse().map(p => ({ p, pin: false }))]
    .filter(t => fs.existsSync(path.join(ROOT, 'out', t.p.id, '01.png')));
  if (!tiles.length) return;
  const COL = 360, ROW = 480, GAP = 3, rows = Math.ceil(tiles.length / 3);
  const GW = COL * 3 + GAP * 2, GH = rows * ROW + (rows - 1) * GAP;
  const html = path.join(tmp, '_grid.html');
  fs.writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:#0C1014}
    .g{display:grid;grid-template-columns:repeat(3,${COL}px);grid-auto-rows:${ROW}px;gap:${GAP}px;direction:ltr}
    .t{position:relative;overflow:hidden;background:#1c1f24}
    .t img{width:100%;height:100%;object-fit:cover;object-position:center;display:block}
    .t i{position:absolute;top:10px;right:10px;width:24px;height:24px;color:#fff;filter:drop-shadow(0 1px 2px rgba(0,0,0,.7))}
  </style></head><body><div class="g">${tiles.map(t => `<div class="t"><img src="${pathToFileURL(path.join(ROOT, 'out', t.p.id, '01.png')).href}">`
    + `${t.pin ? `<i>${PIN}</i>` : ''}</div>`).join('')}</div></body></html>`);
  await pg.emulate({ width: GW, height: GH, scale: 1 });
  await pg.goto(pathToFileURL(html).href);
  await pg.shot(path.join(ROOT, 'out', '_grid.png'), { x: 0, y: 0, width: GW, height: GH });
  console.log('معاينة صفحة الحساب ← out/_grid.png');
}

/* ---------------------------------------------------------------- التصيير */
async function render(only) {
  const { config: cfg = {}, posts } = read('posts.json');
  check(posts, read('shots.json'), cfg).forEach(x => console.log('تنبيه ·', x));

  const todo = posts.filter(p => !only || p.id === only);
  if (!todo.length) { console.log('لا منشور بهذا المعرف:', only); process.exitCode = 1; return; }

  const css = fs.readFileSync(path.join(ROOT, 'src', 'style.css'), 'utf8');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shuba-ig-html-'));
  const pg = await launch();
  try {
    for (const post of todo) {
      const dir = path.join(ROOT, 'out', post.id);
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      for (const [i, slide] of post.slides.entries()) {
        const n = String(i + 1).padStart(2, '0');
        const html = path.join(tmp, `${post.id}-${n}.html`);
        fs.writeFileSync(html, page(renderSlide(slide, post, cfg), css));
        await pg.emulate({ width: W, height: H, scale: 1 });
        await pg.goto(pathToFileURL(html).href);
        if (!(await pg.eval(FONTS_READY))) console.log(`تنبيه · ${post.id}/${n}: الخط لم يحمل — تحقق من الاتصال بالانترنت`);
        for (const x of await pg.eval(LAYOUT(i === 0))) console.log(`تنبيه · ${post.id}/${n}: ${x}`);
        await pg.shot(path.join(dir, `${n}.png`), { x: 0, y: 0, width: W, height: H });
      }
      const cap = captionOf(post, cfg);
      if (cap) fs.writeFileSync(path.join(dir, 'caption.txt'), cap);
      console.log(`${post.id} · ${post.slides.length} شريحة ← out/${post.id}/`);
    }
    await grid(pg, posts, tmp);
  } finally {
    await pg.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const args = process.argv.slice(2);
if (args.includes('--check')) {
  const { config: cfg = {}, posts } = read('posts.json');
  const ws = check(posts, read('shots.json'), cfg);
  console.log(ws.length ? ws.map(x => 'تنبيه · ' + x).join('\n') : 'لا تنبيهات.');
} else {
  await render(args.find(a => !a.startsWith('--')));
}
