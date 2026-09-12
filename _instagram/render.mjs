/* ===================================================================
   شعبة · تصيير منشورات انستجرام (Node + كروم المثبت — بلا Python)
     node render.mjs                كل المنشورات
     node render.mjs p-001-jadwal   منشور بعينه
     node render.mjs --check        فحص القواعد بلا تصيير
   المخرج: out/<id>/01.png … بمقاس 1080×1080، ومعه caption.txt
   =================================================================== */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, FONTS_READY } from './src/chrome.mjs';
import { renderSlide, page, captionOf, ROOT, TEMPLATES } from './src/templates.mjs';

const SIZE = 1080;
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

/* تداخل يقاس في الشريحة المرسومة نفسها، لا بالعين */
const LAYOUT = `(() => {
  const r = s => { const el = document.querySelector(s); return el ? el.getBoundingClientRect() : null; };
  const hit = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const foot = r('.foot'), phone = r('.phone'), zoom = r('.zoom'), text = r('.cap') || r('.side-txt');
  const out = [];
  if (hit(foot, phone)) out.push('النطاق تحت إطار الهاتف');
  if (hit(foot, zoom))  out.push('النطاق تحت بطاقة التكبير');
  if (hit(text, phone)) out.push('النص يتداخل مع إطار الهاتف');
  if (hit(text, zoom))  out.push('النص يتداخل مع بطاقة التكبير');
  return out;
})()`;

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
    await pg.emulate({ width: SIZE, height: SIZE, scale: 1 });
    for (const post of todo) {
      const dir = path.join(ROOT, 'out', post.id);
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      for (const [i, slide] of post.slides.entries()) {
        const n = String(i + 1).padStart(2, '0');
        const html = path.join(tmp, `${post.id}-${n}.html`);
        fs.writeFileSync(html, page(renderSlide(slide, post, cfg), css));
        await pg.goto(pathToFileURL(html).href);
        if (!(await pg.eval(FONTS_READY))) console.log(`تنبيه · ${post.id}/${n}: الخط لم يحمل — تحقق من الاتصال بالانترنت`);
        for (const x of await pg.eval(LAYOUT)) console.log(`تنبيه · ${post.id}/${n}: ${x}`);
        await pg.shot(path.join(dir, `${n}.png`), { x: 0, y: 0, width: SIZE, height: SIZE });
      }
      const cap = captionOf(post, cfg);
      if (cap) fs.writeFileSync(path.join(dir, 'caption.txt'), cap);
      console.log(`${post.id} · ${post.slides.length} شريحة ← out/${post.id}/`);
    }
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
