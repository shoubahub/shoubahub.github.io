// تصدير الخطط للمنصة — node export.mjs <مجلد العمل> <ملف الخرج> [العام=2026/2027] [الفصل=1]
// (2026-09-13، الخطوة أ من بناء شريط الخطة). يقرأ نتائج القياس الثلاث extract-{24,15,17}-t<الفصل>.json ويكتب ملفا واحدا:
//   • calendar — تقويم الفصل من تواريخ الخطط نفسها: لكل اسبوع اكثر بداية كتبتها الخطط (الاغلبية)، والنهاية الخميس بعدها،
//     وما لا تاريخ له يستنتج من الاسبوع الاول بسبعة ايام — فالاسبوع الجاري يعرف من التقويم لا بالعد؛
//   • plans — كل خطة قرئت: مرحلتها وصفها ومادتها ومصدرها (رقم الملف في مكتبة المعلم) وحالها واسباب مراجعتها ومجموعها
//     واسابيعها بدروسها وحصصها. والصف بلا رقم اسبوع يلحق بالاسبوع قبله (تكملة لا اسبوع جديد).
// ⚠ ليس للعرض العام: الملف في plans/ خارج public، ويقرؤه الخادم في الخطوة ب لمراجعة المالك — ولا يصل رئيس شعبة
//   قبل اعتماده (قرار المستخدم 2026-09-12). وخطط المنازل مستبعدة من القياس اصلا (قراره 2026-09-13).
import fs from 'fs';
const [W, OUT, YEAR = '2026/2027', TERM = '1'] = process.argv.slice(2);
if (!W || !OUT) { console.log('node export.mjs <مجلد العمل> <ملف الخرج> [العام] [الفصل]'); process.exit(1); }
const STAGES = ['24', '15', '17'];
const plans = [], votes = {};
const iso = d => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };

for (const s of STAGES) {
  const f = `${W}/plans/extract-${s}-t${TERM}.json`;
  if (!fs.existsSync(f)) { console.log('⚠ لا قياس للمرحلة', s); continue; }
  const X = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const r of X.results) {
    if (!Array.isArray(r.plan)) continue;                       /* تعذر تنزيله او لم يقرأ */
    for (const w of r.plan) if (w.n && w.from && !w.nInferred && !w.span) {
      (votes[w.n] ||= {}); votes[w.n][w.from] = (votes[w.n][w.from] || 0) + 1;
    }
    const weeks = [];
    for (const w of r.plan) {
      const lessons = (w.lessons || []).filter(l => l.title).map(l => ({ t: l.title, p: l.periods || 0 }));
      if (!w.n) { if (weeks.length) weeks[weeks.length - 1].lessons.push(...lessons); continue; }
      const prev = weeks[weeks.length - 1];
      if (prev && prev.n === w.n) { prev.lessons.push(...lessons); continue; }   /* صفان للاسبوع نفسه */
      weeks.push({ n: w.n, ...(w.span > 1 ? { span: w.span } : {}), ...(w.nInferred ? { inferred: true } : {}), lessons });
    }
    plans.push({
      key: [s, r.gradeId, r.subjectId, r.id].join('|'),
      stageId: s, stage: X.stage, gradeId: r.gradeId, grade: r.grade, subjectId: r.subjectId, subject: r.subject,
      elective: !!r.elective || undefined,
      source: { id: r.id, desc: r.desc, uploaded: r.uploaded },
      status: r.status, issues: r.issues || [], stated: r.stated ?? null, periods: r.periods ?? null,
      weeks
    });
  }
}

/* التقويم: لكل اسبوع اكثر بداية كتبتها الخطط، وما لا اغلبية له من الاسبوع الاول */
const nums = Object.keys(votes).map(Number).sort((a, b) => a - b), maxN = Math.max(13, ...plans.map(p => Math.max(0, ...p.weeks.map(w => w.n + (w.span || 1) - 1))));
const top = n => { const v = votes[n]; if (!v) return null; return Object.entries(v).sort((a, b) => b[1] - a[1])[0]; };
const w1 = top(1) ? top(1)[0] : null;
const calendar = [];
for (let n = 1; n <= maxN; n++) {
  const t = top(n), guess = w1 ? addDays(w1, (n - 1) * 7) : null;
  /* الاغلبية ان وافقت خطوة الاسابيع (سبعة ايام من الاول) او لم يكن لها مخالف — والا فالخطوة */
  const from = t && (!guess || t[0] === guess || t[1] >= 3) ? t[0] : guess;
  calendar.push({ n, from, to: from ? addDays(from, 4) : null, votes: t ? t[1] : 0 });
}

const out = { year: YEAR, term: +TERM, at: new Date().toISOString(), calendar, plans };
fs.mkdirSync(OUT.replace(/\/[^/]+$/, ''), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
const c = k => plans.filter(p => p.status === k).length;
console.log(`كتبت ${OUT} — ${plans.length} خطة (سليم ${c('ok')} · يراجع ${c('review')} · بلا جدول ${c('no-table')}) · ${(fs.statSync(OUT).size / 1024).toFixed(0)} ك.ب`);
console.log('التقويم:', calendar.map(w => w.n + ':' + (w.from || '?').slice(5) + '(' + w.votes + ')').join(' '));
