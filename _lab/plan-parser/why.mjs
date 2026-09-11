// لماذا لم يقرأ الجدول؟ — node why.mjs <ملف.pdf> [صفحة=1]
// يمر بشروط readTable (lib3.mjs) واحدا واحدا ويطبع عند ايها يسقط، مع كلمات الترويسة ومواضعها.
// (2026-09-12: خطط الرياضيات في الابتدائي والمتوسط نصها سليم وجدولها لا يتعرف عليه)
import { openDoc, ligatureMap, makeFixer, rects, norm } from './lib2.mjs';

const file = process.argv[2], pn = +(process.argv[3] || 1);
const doc = await openDoc(file);
const page = await doc.getPage(pn);
const rs = await rects(page);
const fix = makeFixer(await ligatureMap(page));
const tc = await page.getTextContent();
const items = tc.items.filter(i => i.str.trim()).map(i => ({ s: fix(i.str).normalize('NFKC'), x: i.transform[4], y: i.transform[5], w: i.width,
  rot: Math.abs(i.transform[0]) < 0.01 && Math.abs(i.transform[1]) > 0.01 }));
const r1 = v => Math.round(v);
console.log(`صفحات ${doc.numPages} · الصفحة ${pn} · مستطيلات/خطوط ${rs.length} · عناصر نص ${items.length}`);

const H = rs.filter(r => Math.abs(r.h) <= 2.5 && Math.abs(r.w) > 5);
const V = rs.filter(r => Math.abs(r.w) <= 2.5 && Math.abs(r.h) > 8);
const big = rs.filter(r => Math.abs(r.w) > 2.5 && Math.abs(r.h) > 2.5);
console.log(`١) خطوط افقية ${H.length} · رأسية ${V.length} · مستطيلات ممتلئة (خلايا مرسومة كتلا لا خطوطا) ${big.length}`);
if (big.length) console.log('   عينة مستطيلات: ' + big.slice(0, 6).map(r => `[${r1(r.x)},${r1(r.y)} ${r1(r.w)}×${r1(r.h)}]`).join(' '));

const bareS = s => norm(s).replace(/\s+/g, '');
const cand = items.filter(i => /سبوع|week|الاسابيع|الأسابيع|التاريخ|الوحدة|الدرس|الحصص|المحور|المجال|الموضوع/i.test(bareS(i.s)));
console.log(`٢) عناوين محتملة (${cand.length}): ` + cand.slice(0, 16).map(i => `«${i.s.trim()}»@${r1(i.x)},${r1(i.y)}${i.rot ? '↻' : ''}`).join('  '));
const head = items.filter(i => !i.rot && (/^(ال)?[أا]?سبوع$|^الاسبوع$|^الأسبوع$|^سبوع$/.test(bareS(i.s)) || /^weeks?$/i.test(i.s.trim())));
console.log(`   ترويسة «الأسبوع» التي يقبلها readTable: ${head.length ? head.map(h => `«${h.s}»@y${r1(h.y)}`).join(' ') : '✗ لا شيء — هنا يسقط الجدول'}`);
if (!head.length) process.exit(0);
const hy = head.sort((p, q) => q.y - p.y)[0].y;

const below = V.filter(v => Math.max(v.y, v.y + v.h) <= hy + 6);
console.log(`٣) خطوط رأسية تحت الترويسة ${below.length} ${below.length < 6 ? '✗ اقل من ٦ — هنا يسقط' : '✓'}`);
const xs = [...new Set(below.map(v => r1(v.x)))].sort((a, b) => a - b);
console.log(`   مواضعها (x): ${xs.join(' ')}`);
const hdrRow = items.filter(i => !i.rot && Math.abs(i.y - hy) < 14).sort((a, b) => b.x - a.x);
console.log(`٤) صف الترويسة من اليمين: ${hdrRow.map(i => `«${i.s.trim()}»@${r1(i.x)}`).join(' | ')}`);
