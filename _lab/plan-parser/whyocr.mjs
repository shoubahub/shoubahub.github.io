// لماذا لم يبن الجدول من القراءة الضوئية؟ — node whyocr.mjs <ملف.pdf> [صفحة=1] [مجلد المخبأ]
// نظير why.mjs لمسار ocrpage.mjs: الخطوط من البكسل والنص من المحرك، ويمر بشروط tableFrom واحدا واحدا.
// (2026-09-12 — كتب مؤقتا مرات في قياس الرياضيات ثم ابقي اداة دائمة)
import { execFileSync } from 'child_process';
import os from 'os';
import { norm } from './lib3.mjs';

const [file, pg = '1'] = process.argv.slice(2);
const d = JSON.parse(execFileSync(`${os.homedir()}/.cache/shouba-lab/ocr`, [file, pg, '--scale', '3', '--json', '--lines'], { maxBuffer: 256 << 20 }));
const r1 = Math.round;
const cl = (vals, t) => { const s = [...vals].sort((a, b) => a - b), o = []; for (const v of s) { if (!o.length || v - o[o.length - 1] > t) o.push(v); else o[o.length - 1] = (o[o.length - 1] + v) / 2; } return o; };
const H = d.lines.filter(r => r.h <= 2.5 && r.w > 5).map(r => ({ x1: r.x, x2: r.x + r.w, y: r.y }));
const V = d.lines.filter(r => r.w <= 2.5 && r.h > 8).map(r => ({ y1: r.y, y2: r.y + r.h, x: r.x, len: r.h }));
console.log(`١) خطوط البكسل: افقية ${H.length} · رأسية ${V.length} · سطور نص ${d.items.length}`);
const bareS = s => norm(s).replace(/\s+/g, '');
const cands = d.items.filter(i => /سبوع|week/i.test(i.s));
console.log(`٢) ما فيه «سبوع»: ${cands.map(i => `«${i.s}»@${r1(i.x)},${r1(i.y)}`).join(' ') || 'لا شيء'}`);
const head = d.items.filter(i => /^(ال)?[أا]?سبوع$|^الاسبوع$|^الأسبوع$|^سبوع$/.test(bareS(i.s)) || /^weeks?$/i.test(i.s.trim())).sort((p, q) => q.y - p.y);
if (!head.length) { console.log('   ✗ لا ترويسة يقبلها tableFrom (يشترط «الأسبوع» سطرا وحده) — هنا يسقط'); process.exit(); }
const hy = head[0].y;
const below = V.filter(v => v.y2 <= hy + 6);
const xs = cl(below.map(v => v.x), 4);
const weight = xs.map(x => ({ x: r1(x), len: r1(below.filter(v => Math.abs(v.x - x) <= 4).reduce((a, b) => a + b.len, 0)) }));
console.log(`٣) hy ${r1(hy)} · رأسية تحت الترويسة ${below.length}${below.length < 6 ? ' ✗ اقل من ٦ — هنا يسقط' : ''} · مواضعها:اطوالها ${weight.map(w => w.x + ':' + w.len).join(' ')}`);
if (below.length < 6) process.exit();
const colX = [...weight].sort((a, b) => b.len - a.len).slice(0, 6).map(o => o.x).sort((a, b) => a - b);
const cols = []; for (let i = colX.length - 1; i > 0; i--) cols.push({ a: colX[i - 1], b: colX[i] });
const bodyH = H.filter(h => h.y <= hy + 6);
const cov = (y, c) => { const s = bodyH.filter(h => Math.abs(h.y - y) <= 2.5 && h.x2 > c.a && h.x1 < c.b).map(h => [Math.max(h.x1, c.a), Math.min(h.x2, c.b)]).sort((p, q) => p[0] - q[0]); let v = 0, e = c.a; for (const [a, b] of s) if (b > e) { v += b - Math.max(a, e); e = b; } return r1(v / (c.b - c.a) * 100); };
const through = y => [1, 2, 3, 4].map(i => V.some(v => Math.abs(v.x - colX[i]) <= 4 && v.y1 <= y + 1 && v.y2 >= y - 1) ? 1 : 0).join('');
console.log(`٤) colX ${colX.join(' ')} — تغطية ٪ لكل خط افقي (اسبوع · وحدة · درس · حصص) | مرور الاعمدة الداخلية`);
for (const y of cl(bodyH.map(h => h.y), 3)) console.log(`   y${r1(y)}: ${cols.slice(0, 4).map(c => String(cov(y, c)).padStart(3)).join(' ')}   | ${through(y)}`);
