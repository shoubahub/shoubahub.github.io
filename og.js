/* ===================================================================
   شعبة · وسوم المعاينة (og) — ما يظهر مع رابط المنصّة في واتساب وغيره
   ────────────────────────────────────────────────────────────────
   ⚠ الخادم يحقنها في كل صفحة، والعنوان المطلق من الطلب نفسه — لا عنوانٌ مكتوب:
     يوم يُشترى النطاق تتبعه المعاينة بلا تعديل (كـSHOUBA_HOME في الواجهة).
     وقارئ واتساب لا يشغّل JavaScript، فلا تُكتب الوسوم من الواجهة.
   ⚠ النصّ هنا وحده، و**بلا تشكيل** (قرار المستخدم 2026-09-11 — راحةٌ للعين).
   الصورة: identity/assets/og-cover.jpg · أصلها _dev/og-cover.html · توليدها _dev/og-render.sh
   =================================================================== */
const fs = require('fs');
const path = require('path');

const OG = {
  site: 'شعبة',
  title: 'شعبة — منصة رئيس الشعبة',
  description: 'جداول معلميك وسجلاتك ومواعيد شعبتك في مكان واحد، من أي جهاز.',
  image: '/identity/assets/og-cover.jpg',
  width: 1200, height: 630
};

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* رقم البناء من build.js — مصدره الواحد. يُلحق بعنوان الصورة، فتتبدّل الصورة
   المحفوظة عند واتساب يوم تتبدّل هي، لا أن يبقى القديم معلّقاً بالعنوان نفسه. */
function buildNo(publicDir) {
  try {
    const m = fs.readFileSync(path.join(publicDir, 'build.js'), 'utf8').match(/SHOUBA_BUILD\s*=\s*(\d+)/);
    return m ? m[1] : '0';
  } catch (e) { return '0'; }
}

/* العنوان المطلق من الطلب. خلف Railway يصل البروتوكول في x-forwarded-proto.
   ⚠ ترويسة المضيف يكتبها الطالب — فتُفحص ولا تُحقن كما هي. */
function origin(req) {
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (!/^https?$/.test(proto) || !/^[a-z0-9.\-]+(:\d+)?$/i.test(host)) return '';
  return proto + '://' + host;
}

function tags(req, v) {
  const o = origin(req);
  const t = [
    ['property', 'og:type', 'website'],
    ['property', 'og:site_name', OG.site],
    ['property', 'og:locale', 'ar_KW'],
    ['property', 'og:title', OG.title],
    ['property', 'og:description', OG.description],
    ['name', 'description', OG.description],
    ['name', 'twitter:card', 'summary_large_image']
  ];
  if (o) t.push(
    ['property', 'og:url', o + '/'],
    ['property', 'og:image', o + OG.image + '?v=' + v],
    ['property', 'og:image:width', OG.width],
    ['property', 'og:image:height', OG.height],
    ['property', 'og:image:type', 'image/jpeg'],
    ['property', 'og:image:alt', OG.title]
  );
  return t.map(([k, n, c]) => `<meta ${k}="${n}" content="${esc(c)}" />`).join('\n');
}

function send(req, res, file, v) {
  const src = fs.readFileSync(file, 'utf8');
  res.type('html').send(src.replace('</head>', tags(req, v) + '\n</head>'));
}

/* صفحات HTML تُقدَّم محقونةً بالوسوم؛ وما سواها يمرّ إلى express.static */
function html(publicDir) {
  const v = buildNo(publicDir);
  return function (req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    let p;
    try { p = decodeURIComponent(req.path); } catch (e) { return next(); }
    if (p.endsWith('/')) p += 'index.html';
    if (!p.endsWith('.html')) return next();
    const f = path.join(publicDir, p);
    if (!f.startsWith(publicDir + path.sep) || !fs.existsSync(f)) return next();
    send(req, res, f, v);
  };
}

/* المسار المجهول يعيد الموجِّه — محقوناً كذلك */
function fallback(publicDir) {
  const v = buildNo(publicDir);
  return (req, res) => send(req, res, path.join(publicDir, 'index.html'), v);
}

module.exports = { html, fallback, OG };
