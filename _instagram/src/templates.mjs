/* ===================================================================
   شعبة · قوالب شرائح انستجرام — HTML لكل شريحة من posts.json
   ────────────────────────────────────────────────────────────────
   head رأس عمود مثبت · a هاتف في الوسط (الافتراضي) · b هاتف جانبا
   z تكبير تفصيل بلا اطار · num رقم
   ⚠ الشعار والالوان من هوية المنصة نفسها (public/identity) لا من نسخ هنا —
     فأي تعديل على الهوية يصل المنشورات وحده.
   =================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IDENTITY = path.resolve(ROOT, '..', 'public', 'identity');

/* العمود ← السطح. غير هنا وحدك ان غيرت الوان الاعمدة */
export const COLUMN_SURFACE = { 'نظِّم': 'navy', 'تابِع': 'cream', 'أصدِر': 'amber' };
export const TEMPLATES = ['head', 'a', 'b', 'z', 'num'];

const e = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const uris = new Map();
function dataUri(p) {
  if (!uris.has(p)) uris.set(p, `data:${MIME[path.extname(p).toLowerCase()] || 'image/png'};base64,`
    + fs.readFileSync(p).toString('base64'));
  return uris.get(p);
}

/* التوقيع: النطاق ان كتب في الاعداد، والا اسم المنصة — مفتاح واحد يبدل الشرائح والنصوص معا */
export const signOf = cfg => cfg.domain || cfg.name || '';

/* قاعدة الدليل: لا يوضع الشعار على لون ثالث ⟵ لا علامة على العنبري */
function logo(surface) {
  if (surface === 'amber') return '';
  return dataUri(path.join(IDENTITY, 'assets', surface === 'navy' ? 'logo-vec-dark.svg' : 'logo-vec-color.svg'));
}
const mark = surface => (logo(surface) ? `<div class="lock"><img src="${logo(surface)}" alt=""></div>` : '');
/* النطاق لاتيني يكتب من اليسار بتباعد، والاسم عربي من اليمين بلا تباعد (التباعد يقطع وصل الحروف) */
const foot = sign => /^[\x20-\x7E]*$/.test(sign)
  ? `<div class="foot" dir="ltr">${e(sign)}</div>`
  : `<div class="foot ar" dir="rtl">${e(sign)}</div>`;
const missing = (what, name) => `<div class="ph-holder"><span>${what}</span>${name ? `<b dir="ltr">${e(name)}</b>` : ''}</div>`;

/* اطار الهاتف: لقطة حقيقية من screens/ ، والا مربع بديل يسمي الناقص فلا يتعطل البناء */
function screen(slide, klass) {
  const name = slide.screen;
  const p = name && path.join(ROOT, 'screens', name);
  const inner = !name ? missing('لا لقطة')
    : fs.existsSync(p) ? `<img src="${dataUri(p)}" alt="">` : missing('لقطة ناقصة', name);
  return `<div class="phone ${klass}">${inner}</div>`;
}

export function renderSlide(slide, post, cfg) {
  const tpl = slide.template || 'a';
  const surface = slide.surface || COLUMN_SURFACE[post.column];
  const sign = signOf(cfg);
  const step = slide.step ?? post.column;

  if (tpl === 'head') {
    const l = logo(surface);
    return `<div class="cv ${surface} hd"><div class="echo"></div>${l ? `<img class="hd-mark" src="${l}" alt="">` : ''}`
      + `<div class="pin">مثبّت</div><h1>${e(slide.title)}</h1><p>${e(slide.sub)}</p>${foot(sign)}</div>`;
  }

  if (tpl === 'num') {
    return `<div class="cv amber num"><div class="echo"></div><div class="big" dir="ltr">${e(slide.number)}</div>`
      + `<div class="n-sub">${e(slide.sub)}</div>${foot(sign)}</div>`;
  }

  if (tpl === 'b') {
    return `<div class="cv ${surface}"><div class="echo"></div><div class="side-txt"><span class="rule"></span>`
      + `<span class="step">${e(step)}</span><h1>${e(slide.title)}</h1><p>${e(slide.sub)}</p>${foot(sign)}</div>`
      + `${screen(slide, 'side')}</div>`;
  }

  if (tpl === 'z') {
    const d = slide.detail || {};
    let body;
    if (d.crop) {
      const p = path.join(ROOT, 'screens', d.crop);
      body = fs.existsSync(p) ? `<div class="z-crop"><img src="${dataUri(p)}" alt=""></div>`
        : `<div class="z-sub">لقطة ناقصة: ${e(d.crop)}</div>`;
    } else {
      body = `<div class="z-sub">${e(d.sub)}</div>`;
      if (d.bar != null) body += `<div class="z-bar"><span style="width:${parseInt(d.bar, 10)}%"></span></div>`;
      if (d.buttons && d.buttons.length) {
        body += '<div class="z-btns">' + d.buttons.map((b, i) =>
          `<span class="${i === 0 ? 'primary' : 'ghost'}">${e(b)}</span>`).join('') + '</div>';
      }
    }
    const head = d.crop ? '' : `<h2>${e(d.title ?? slide.title)}</h2>`;
    return `<div class="cv ${surface}"><div class="echo"></div>${mark(surface)}`
      + `<div class="cap high"><span class="step">${e(step)}</span><h1>${e(slide.title)}</h1><p>${e(slide.sub)}</p></div>`
      + `<div class="zoom${d.warn ? ' warn' : ''}">${head}${body}</div>${foot(sign)}</div>`;
  }

  /* القالب الافتراضي: a */
  return `<div class="cv ${surface}"><div class="echo"></div>${mark(surface)}`
    + `<div class="cap"><span class="step">${e(step)}</span><h1>${e(slide.title)}</h1><p>${e(slide.sub)}</p></div>`
    + `${screen(slide, 'center')}${foot(sign)}</div>`;
}

/* رموز الهوية (tokens.css) تحقن قبل style.css — منها الالوان والخطوط */
const TOKENS = fs.readFileSync(path.join(IDENTITY, 'tokens.css'), 'utf8');
export function page(slideHtml, css) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${TOKENS}\n${css}</style></head><body>${slideHtml}</body></html>`;
}

/* نص المنشور: {sign} يستبدل بالتوقيع من الاعداد — موضع واحد له */
export const captionOf = (post, cfg) => String(post.caption || '').replaceAll('{sign}', signOf(cfg));
