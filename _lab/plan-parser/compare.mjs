// مقارنة قياسين للمرحلة نفسها — node compare.mjs <قبل.json> <بعد.json>
// لكل خطة: الحال والاسابيع والحصص والمعلن قبل وبعد؛ ويبرز التراجع (سليم صار يراجع او بلا جدول)
// كي لا يكسب تحسين في خطط ويخسر في غيرها بصمت (2026-09-12)
import fs from 'fs';
const [A, B] = process.argv.slice(2).map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
const key = r => r.gradeId + '|' + r.subjectId + '|' + r.id;
const before = new Map(A.results.map(r => [key(r), r]));
const rank = { ok: 2, review: 1, 'no-table': 0 };
const rows = { up: [], down: [], same: [], changed: [], added: [], removed: [] };
for (const r of B.results) {
  const o = before.get(key(r)); before.delete(key(r));
  if (!o) { rows.added.push(r); continue; }
  const d = (rank[r.status] ?? -1) - (rank[o.status] ?? -1);
  const moved = r.weeks !== o.weeks || r.periods !== o.periods || r.stated !== o.stated;
  (d > 0 ? rows.up : d < 0 ? rows.down : moved ? rows.changed : rows.same).push([o, r]);
}
rows.removed = [...before.values()];
const line = (o, r) => `  ${r.grade} · ${r.subject} (#${r.id}): ${o.status} ${o.weeks ?? '-'}أ/${o.periods ?? '-'}ح/${o.stated ?? '-'} ⟵ ${r.status} ${r.weeks ?? '-'}أ/${r.periods ?? '-'}ح/${r.stated ?? '-'}${r.ocr ? ' [ضوئي ' + r.ocr.pages + 'ص' + (r.ocr.cellsMissed ? '، فائت ' + r.ocr.cellsMissed : '') + ']' : ''}${r.issues?.length ? '  — ' + r.issues.join(' | ') : ''}`;
const c = (R, s) => R.results.filter(r => r.status === s).length;
console.log(`${B.stage}: قبل ${c(A, 'ok')}/${c(A, 'review')}/${c(A, 'no-table')} ⟵ بعد ${c(B, 'ok')}/${c(B, 'review')}/${c(B, 'no-table')}  (سليم/يراجع/بلا جدول)`);
if (rows.up.length) { console.log(`▲ تحسن ${rows.up.length}:`); rows.up.forEach(([o, r]) => console.log(line(o, r))); }
if (rows.down.length) { console.log(`▼ تراجع ${rows.down.length}:`); rows.down.forEach(([o, r]) => console.log(line(o, r))); }
if (rows.changed.length) { console.log(`◆ تغير بلا تبدل حال ${rows.changed.length}:`); rows.changed.forEach(([o, r]) => console.log(line(o, r))); }
if (rows.added.length) { console.log(`+ خطط جديدة الاختيار ${rows.added.length}:`); rows.added.forEach(r => console.log(line({}, r))); }
if (rows.removed.length) { console.log(`− خرجت من الاختيار ${rows.removed.length}:`); rows.removed.forEach(r => console.log(`  ${r.grade} · ${r.subject} (#${r.id}) — ${r.desc}`)); }
console.log(`= بلا تغير ${rows.same.length}`);
