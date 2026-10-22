// اختبار التمرير الافقي في واجهة الشعبة — node public/_dev/face-xscroll-test.mjs (2026-10-22)
// يفحص من face.css وface.html: الايام بلا تمرير افقي وتتقاسم العرض · الفريق شبكة اربعة اعمدة والاسم سطران ·
// و«الآن» يبقى يمرر بتلميحه: صنفا more-start/more-end يحسبان صحيحا في RTL عند البداية والوسط والنهاية، والقناع والسهمان.
import fs from 'fs';
import vm from 'vm';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const css = fs.readFileSync(path.join(ROOT, 'face.css'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'face.html'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, name, extra) => { if (c) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name, extra !== undefined ? '— ' + JSON.stringify(extra) : ''); } };
const rule = sel => { const m = css.match(new RegExp('(^|\\n)' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{([^}]*)\\}')); return m ? m[2] : ''; };

// ١) الايام: لا تمرير افقي، وكل يوم يتقاسم العرض
ok(rule('.days') === 'display:flex;gap:6px;margin-bottom:14px', 'الايام: flex بلا overflow-x', rule('.days'));
ok(!/\.days::-webkit-scrollbar/.test(css), 'الايام: لا قاعدة شريط تمرير');
ok(/^flex:1 1 0;min-width:0;/.test(rule('.day')), 'كل يوم flex:1 1 0 وmin-width:0', rule('.day'));

// ٢) الفريق: شبكة اربعة اعمدة تلتف، والاسم سطران على الاكثر
const ft = rule('.fteam');
ok(ft.includes('display:grid') && ft.includes('grid-template-columns:repeat(4,minmax(0,1fr))') && ft.includes('gap:16px 8px')
  && ft.includes('margin:16px 0 0') && ft.includes('padding:6px 0 4px') && ft.includes('justify-items:center') && !ft.includes('overflow'),
  'الفريق: شبكة اربعة اعمدة بلا تمرير', ft);
ok(!/\.fteam::-webkit-scrollbar/.test(css) && !/\.fteam \.tm\.head\{width/.test(css), 'الفريق: لا شريط تمرير ولا عرض ثابت للرئيس');
ok(/width:100%;max-width:92px/.test(rule('.fteam .tm')), 'عضو الفريق: عرض العمود حتى ٩٢', rule('.fteam .tm'));
const fb = rule('.fteam b');
ok(fb.includes('-webkit-line-clamp:2') && fb.includes('display:-webkit-box') && fb.includes('overflow:hidden') && !fb.includes('nowrap') && !fb.includes('ellipsis'),
  'الاسم: سطران على الاكثر، لا قطع بسطر واحد', fb);

// ٣) «الآن» يبقى يمرر، والتلميح محلي في face.css
ok(/overflow-x:auto/.test(rule('.nowrow')), '«الآن» يبقى يمرر افقيا');
ok(rule('.xwrap') === 'position:relative', 'غلاف نسبي يحمل السهمين');
const me = rule('.nowrow.more-end'), ms = rule('.nowrow.more-start');
ok(me.includes('-webkit-mask-image:linear-gradient(to right,transparent 0,transparent 30px,#000 56px);mask-image:linear-gradient(to right,transparent 0,transparent 30px,#000 56px)') && me.includes('-webkit-mask-image'), 'more-end: الطرف الايسر شفاف ٣٠ ثم يبهت حتى ٥٦', me);
ok(ms.includes('-webkit-mask-image:linear-gradient(to left,transparent 0,transparent 30px,#000 56px);mask-image:linear-gradient(to left,transparent 0,transparent 30px,#000 56px)') && ms.includes('-webkit-mask-image'), 'more-start: الطرف الايمن شفاف ٣٠ ثم يبهت حتى ٥٦', ms);
const both = 'linear-gradient(to right,transparent 0,transparent 30px,#000 56px,#000 calc(100% - 56px),transparent calc(100% - 30px),transparent 100%)';
ok(rule('.nowrow.more-start.more-end') === '-webkit-mask-image:' + both + ';\n  mask-image:' + both, 'وبالصنفين معا: الطرفان بالقيم نفسها', rule('.nowrow.more-start.more-end'));
const xa = rule('.xarr');
ok(['width:26px', 'height:26px', 'background:var(--shouba-raised)', 'border:1px solid var(--shouba-line)', 'box-shadow:var(--shadow-card)',
  'color:var(--shouba-navy)', 'opacity:0', 'transition:opacity 160ms', 'top:50%'].every(x => xa.includes(x)), 'السهم: ٢٦ بالقيم المعتمدة', xa);
ok(rule('.xarr svg').includes('width:12px') && rule('.xarr.end') === 'left:4px' && rule('.xarr.start') === 'right:4px', 'سهم ١٢ عند الطرف بازاحة ٤');
ok(css.includes('.more-end ~ .xarr.end,.more-start ~ .xarr.start{opacity:1;pointer-events:auto}'), 'السهم يظهر مع صنفه وحده');
ok((html.match(/class="xarr (start|end)" data-dir="\1" aria-label="المزيد"/g) || []).length === 2, 'سهمان بـ aria-label="المزيد"');
ok(html.includes("behavior: still ? 'auto' : 'smooth'") && html.includes("prefers-reduced-motion: reduce") && html.includes('el.clientWidth * 0.8'),
  'اللمسة تمرر ٨٠٪ بنعومة، وفوريا مع تقليل الحركة');
ok(html.includes("addEventListener('scroll', fn, { passive: true })") && html.includes('new ResizeObserver(fn)') && /\$\('nowSec'\)\.hidden = false;[^\n]*\n\s*xhint\(\$\('nowRow'\)\);/.test(html),
  'يحدث مع التمرير وتغير المقاس وبعد كل رسم لـ«الآن»');
/* components.css فيه منذ بناء 119 تنبيه المنصة ([data-xscroll].more-end) — والواجهة لا تحمله، فالمعتبر ألا يتسرب اليه صنف الواجهة */
ok(!/\.xarr|\.nowrow/.test(fs.readFileSync(path.join(ROOT, 'components.css'), 'utf8')) && !/components\.css/.test(html), 'الواجهة لا تحمل components.css، ولا شيء من صنفيها فيه');

// ٤) حساب الصنفين في RTL (scrollLeft صفر عند البداية وسالب نحو النهاية)
const src = html.match(/function xhint\(el\) \{[\s\S]*?\n  \}/)[0];
const c = {}; vm.createContext(c); vm.runInContext(src, c);
const fake = sl => { const s = new Set(); return { scrollLeft: sl, clientWidth: 362, scrollWidth: 1114,
  classList: { toggle: (k, on) => on ? s.add(k) : s.delete(k) }, cls: s }; };
const at = sl => { const e = fake(sl); c.xhint(e); return [...e.cls].sort().join(' '); };
ok(at(0) === 'more-end', 'البداية: more-end وحده', at(0));
ok(at(-290) === 'more-end more-start', 'الوسط: الصنفان', at(-290));
ok(at(-752) === 'more-start', 'النهاية: more-start وحده', at(-752));
ok(at(-1.5) === 'more-end' && at(-751) === 'more-start', 'هامش ٢ عند الطرفين');
ok(at(752) === 'more-start', 'وبقيمة موجبة (محركات قديمة) بالقيمة المطلقة');
{ const e = { scrollLeft: 0, clientWidth: 362, scrollWidth: 362, classList: { toggle: (k, on) => { if (on) throw k; } } }; let t = true; try { c.xhint(e); } catch { t = false; } ok(t, 'بلا فائض: لا صنف'); }

console.log(`\n${pass} نجح · ${fail} فشل`);
process.exit(fail ? 1 : 0);
