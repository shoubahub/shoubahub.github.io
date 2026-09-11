// تقرير قراءة الخطط صفحة تفتح في المتصفح — node report-html.mjs <extract.json> <out.html>
// بهوية شعبة (tokens.css): كحلي · عنبري · كريمي · IBM Plex Sans Arabic. بلا تشكيل (قاعدة المنصة).
import fs from 'fs';
const [, , IN, OUT, STAMPS] = process.argv;
const X = JSON.parse(fs.readFileSync(IN, 'utf8'));
const R = X.results;
/* اسم المرحلة في العنوان — من البيانات لا ثابتا (2026-09-12: المتوسط والابتدائي بعد الثانوي) */
const STAGE = ({ 'الثانوية': 'الثانوي', 'المتوسط': 'المتوسط', 'الإبتدائية': 'الابتدائي', 'الابتدائية': 'الابتدائي' })[String(X.stage || '').trim()] || String(X.stage || '').trim();

/* اسم التوجيه: من اختام الخطط بكل اعوامها (stamps.mjs) — خطط ٢٠٢٦/٢٠٢٧ صار اسفلها جدول توقيع بلا اسم.
   ينظف ما التصق («لعلوم» ⟵ العلوم · «لغة العربية» ⟵ اللغة العربية) ويؤخذ الاكثر ورودا لكل مقرر. */
const ST = STAMPS && fs.existsSync(STAMPS) ? JSON.parse(fs.readFileSync(STAMPS, 'utf8')) : {};
const cleanDir = n => {
  /* ما بعد الاسم يقطع: «… الإدارة العامة» · «مدير …» (سطر التوقيع التالي) — رصد في المتوسط والابتدائي */
  let s = n.replace(/^التوجيه الفني\s+/, 'إدارة توجيه ').replace(/\s+(المسح|التشخيصي|الثاني|الأول|الإدارة|إدارة|مدير).*$/, '');
  s = s.replace(/الداراسات/g, 'الدراسات');   /* اصلاح «لا» افسد «الدراسات» */
  s = s.replace(/توجيه\s+مادة\s+/, 'توجيه ').replace(/توجيه\s+لغة\s+/, 'توجيه اللغة ')
       .replace(/توجيه\s+ل(?!ل)(?=\S)/, 'توجيه ال');   /* «لعلوم» ⟵ العلوم · «لدراسات» ⟵ الدراسات */
  return s.replace(/[()\[\]«»،.:\-–]+$/, '').trim();
};
const DIR = {};
for (const [k, arr] of Object.entries(ST)) {
  const c = {};
  arr.forEach(a => (a.names || []).forEach(n => {
    const m = cleanDir(n);
    if (m.replace(/^إدارة توجيه\s*/, '').length < 5) return;   /* «إدارة توجيه الد» اسم مبتور — لا يعرض؛ اقصر اسم سليم «العلوم» */
    c[m] = c[m] || { n: 0, year: a.year }; c[m].n++;
  }));
  const best = Object.entries(c).sort((a, b) => b[1].n - a[1].n)[0];
  DIR[k] = best ? { name: best[0], year: String(best[1].year || '').slice(0, 4) } : { name: null, template: arr.some(a => a.template) };
}
/* ⚠ الاختياري الحر كله تحت رقم مادة واحد عند الوزارة — فلا ينسب له اسم من ختم خطة غيره
   (نسب ختم «الثقافة المرورية» الى الموسيقى والتصميم وسائرها — رصد في النظرة قبل النشر) */
R.forEach(r => { const d = r.elective ? null : DIR[r.gradeId + '|' + r.subjectId]; r.directorate = d && d.name ? d.name : null; r.dirYear = d && d.year; r.dirTemplate = d && d.template; });
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const AR = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
const count = s => R.filter(r => r.status === s).length;
const ok = count('ok'), review = count('review'), noTable = count('no-table') + count('unreadable') + count('download-failed');
const old = R.filter(r => r.pick === 'old').length;
const core = R.filter(r => !r.elective), elect = R.filter(r => r.elective);

/* الشريط: الخطط المقروءة بجدول — للنموذج التفاعلي */
/* ⚠ عيب pdf.js المعروف في «لا»: يصل «االقتصادية» — يصلح للعرض كما في ادوات القراءة */
const lig = s => String(s || '').replace(/اال/g, 'الا').replace(/لال/g, 'للا').replace(/اإل/g, 'الإ').replace(/اآل/g, 'الآ').replace(/\s+/g, ' ').trim();
const stripData = R.filter(r => r.weeks > 0 && !r.elective).map(r => ({
  k: r.grade + ' · ' + r.subject, id: r.id, status: r.status,
  w: r.plan.map(w => ({ u: lig(w.unit), l: w.lessons.map(l => [lig(l.title), l.periods]) }))
}));

/* التوجيهات */
const dir = {};
for (const r of R) { const d = r.directorate || '— لم يقرأ الختم'; (dir[d] ||= new Set()).add(r.subject); }
const dirRows = Object.entries(dir).sort((a, b) => (a[0].startsWith('—') ? 1 : 0) - (b[0].startsWith('—') ? 1 : 0) || b[1].size - a[1].size);

const STATUS = { ok: ['سليم', 'ok'], review: ['يراجع', 'rev'], 'no-table': ['لم يقرأ جدولها', 'bad'], unreadable: ['لا يفتح', 'bad'], 'download-failed': ['تعذر تنزيلها', 'bad'] };
const CAUSE = { encoding: 'خط بترميز خاص — النص لا يقرأ، ويحتاج قراءة ضوئية', layout: 'نص سليم وجدول لم تتعرف عليه الاداة بعد' };
function row(r) {
  const [label, cls] = STATUS[r.status] || [r.status, 'bad'];
  /* «لم يقرأ الختم» من محاولة القراءة الاولى — عمود التوجيه يغني عنه */
  r.issues = (r.issues || []).filter(i => !/الختم/.test(i));
  if (r.cause && !(r.issues || []).some(i => /خط بترميز|لم تتعرف/.test(i))) r.issues = [CAUSE[r.cause]].concat((r.issues || []).filter(i => !/لم يقرأ جدول/.test(i)));
  if (r.segments) r.issues = (r.issues || []).concat(r.segments.map(s => 'قسم ص' + s.pages + (s.grade ? ' («' + s.grade + '»)' : '') + ': ' + s.weeks + ' أسبوعا · ' + s.periods + ' حصة' + (s.stated != null ? ' / ' + s.stated : '')));
  const tot = r.periods ? AR(r.periods) + (r.stated != null ? '<small> / ' + AR(r.stated) + '</small>' : '') : '—';
  return `<tr>
    <td><b>${esc(r.subject)}</b>${r.courseTitle && r.courseTitle !== r.subject ? `<small class="sub">${esc(r.courseTitle)}</small>` : ''}${r.pick === 'old' ? '<span class="tag old">خطة قديمة</span>' : ''}${r.pick === 'current-extra' ? '<span class="tag">خطة ثانية</span>' : ''}${r.homeVariant && r.homeVariant.length ? '<span class="tag">لها نسخة بديلة</span>' : ''}</td>
    <td><span class="pill ${cls}">${label}</span></td>
    <td class="num">${r.weeks ? AR(r.weeks) : '—'}</td>
    <td class="num">${tot}</td>
    <td class="dir">${r.directorate ? esc(r.directorate) + (r.dirYear ? `<small class="sub">ختم ${AR(r.dirYear)}</small>` : '') : `<span class="none">${r.dirTemplate ? 'جدول توقيع بلا اسم' : 'لا ختم مقروء'}</span>`}</td>
    <td class="iss">${(r.issues || []).filter(i => r.status !== 'ok' || /الختم/.test(i)).map(i => `<span>${esc(i)}</span>`).join('') || '<span class="none">لا ملاحظة</span>'}</td>
    <td><a href="https://elibrary.moe.edu.kw/api/File/preview/book/${r.id}" target="_blank" rel="noopener">الملف ↗</a></td>
  </tr>`;
}
const byGrade = {};
for (const r of core) (byGrade[r.grade] ||= []).push(r);
const gradeOrder = X.grades || [...new Set(core.map(r => r.grade))];
const tables = gradeOrder.filter(g => byGrade[g]).map(g => `
  <section class="grade">
    <h3>الصف ${esc(g)} <small>${AR(byGrade[g].length)} خطة</small></h3>
    <div class="scroll"><table>
      <thead><tr><th>المقرر</th><th>الحال</th><th>أسابيع</th><th>حصص <small>/ المعلن</small></th><th>التوجيه في الختم</th><th>الملاحظة</th><th></th></tr></thead>
      <tbody>${byGrade[g].sort((a, b) => a.subject.localeCompare(b.subject, 'ar')).map(row).join('')}</tbody>
    </table></div>
  </section>`).join('');
const electTable = elect.length ? `
  <section class="grade">
    <h3>مواد الاختيار الحر <small>${AR(elect.length)} خطة — كل خطة مقرر مستقل</small></h3>
    <div class="scroll"><table>
      <thead><tr><th>المقرر</th><th>الحال</th><th>أسابيع</th><th>حصص <small>/ المعلن</small></th><th>التوجيه في الختم</th><th>الملاحظة</th><th></th></tr></thead>
      <tbody>${elect.map(r => row({ ...r, subject: (r.desc.match(/[(«]\s*([^)»]+?)\s*[)»]/) || r.desc.match(/المنهج\s*[-–]?\s*(.+?)\s*20\d\d/) || [0, r.desc])[1] })).join('')}</tbody>
    </table></div>
  </section>` : '';

const html = `<title>خطط توزيع ${STAGE}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=IBM+Plex+Sans:wght@500;600;700&display=swap">
<style>
  :root{--navy:#16456E;--navy2:#1B5183;--amber:#E8A33D;--amberd:#A9701B;--ground:#EFE6D6;--paper:#F9F4E9;--sand:#EDE5D8;
    --ink:#24211C;--muted:#5F5648;--label:#8A7F6E;--line:#E2D7C2;--ok:#2E7D57;--okbg:#E3F0E7;--rev:#A9701B;--revbg:#F7EAD3;--bad:#B7443A;--badbg:#F6E1DE;
    --onnavy:#F4F1EA;--onnavy2:#A8C6E2;color-scheme:light}
  @media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--ground:#14202C;--paper:#1B2A39;--sand:#22344A;--ink:#EEE8DC;--muted:#C2B8A6;--label:#9C9280;--line:#2C4058;
    --okbg:#1E3A2C;--ok:#7CC79B;--revbg:#3A2F1C;--rev:#E8B96A;--badbg:#3E2422;--bad:#E48B81;--navy:#1B5183;color-scheme:dark}}
  :root[data-theme="dark"]{--ground:#14202C;--paper:#1B2A39;--sand:#22344A;--ink:#EEE8DC;--muted:#C2B8A6;--label:#9C9280;--line:#2C4058;
    --okbg:#1E3A2C;--ok:#7CC79B;--revbg:#3A2F1C;--rev:#E8B96A;--badbg:#3E2422;--bad:#E48B81;--navy:#1B5183;color-scheme:dark}
  *{box-sizing:border-box}
  body{margin:0;background:var(--ground);color:var(--ink);font:400 15px/1.8 'IBM Plex Sans Arabic',system-ui,sans-serif;direction:rtl}
  .num,.stat b,td.num{font-family:'IBM Plex Sans','IBM Plex Sans Arabic',sans-serif;font-variant-numeric:tabular-nums}
  header{background:linear-gradient(180deg,var(--navy2),var(--navy));color:var(--onnavy);padding:28px 20px 26px}
  .wrap{max-width:1080px;margin:0 auto;padding:0 20px}
  header .wrap{padding:0}
  .eyebrow{font-size:12px;font-weight:600;letter-spacing:.4px;color:var(--onnavy2)}
  h1{margin:4px 0 6px;font-size:28px;font-weight:700;line-height:1.35;text-wrap:balance}
  header p{margin:0;max-width:66ch;color:var(--onnavy2);font-size:14px}
  .verdict{margin-top:18px;display:flex;flex-wrap:wrap;gap:10px}
  .stat{background:rgba(244,241,234,.1);border-radius:12px;padding:8px 14px;display:flex;align-items:baseline;gap:8px}
  .stat b{font-size:22px;font-weight:700;color:var(--onnavy)} .stat span{font-size:12.5px;color:var(--onnavy2)}
  .stat.hl{background:var(--amber)} .stat.hl b,.stat.hl span{color:#241D06}
  main{display:flex;flex-direction:column;gap:34px;padding:30px 0 60px}
  h2{margin:0 0 4px;font-size:20px;font-weight:700;color:var(--ink);text-wrap:balance}
  .lead{margin:0 0 14px;color:var(--muted);max-width:70ch;font-size:14px}
  /* نموذج الشريط — بشكل بطاقة اللوحة في المنصة */
  .demo{display:grid;grid-template-columns:minmax(0,360px) minmax(0,1fr);gap:22px;align-items:start}
  @media (max-width:760px){.demo{grid-template-columns:1fr}}
  .phone{background:var(--paper);border-radius:22px;padding:16px 16px 18px;box-shadow:0 1px 0 var(--line),0 10px 24px rgba(40,30,15,.12)}
  .sect{display:flex;justify-content:space-between;align-items:baseline}
  .sect .h{font-size:14px;font-weight:700;border-inline-start:3px solid var(--amberd);padding-inline-start:8px}
  .sect .a{font-size:13px;font-weight:700;color:var(--amberd)}
  .slices{display:flex;gap:3px;margin:12px 0 10px}
  .slices i{flex:1;height:14px;border-radius:4px;background:var(--sand)}
  .slices i.done{background:var(--navy)} .slices i.now{background:var(--amber)}
  .planline{font-size:12.5px;color:var(--muted);font-weight:600}
  .planline b{color:var(--ink)}
  .wk{margin-top:12px;border-top:1px dashed var(--line);padding-top:10px}
  .wk .u{font-size:12px;font-weight:700;color:var(--label)}
  .wk ul{margin:6px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}
  .wk li{display:flex;gap:10px;justify-content:space-between;font-size:13px}
  .wk li span{color:var(--label);white-space:nowrap;font-size:12px}
  .ctrl{display:flex;flex-direction:column;gap:14px}
  .ctrl label{font-size:12.5px;font-weight:700;color:var(--label);display:flex;flex-direction:column;gap:6px}
  select,input[type=range]{font:inherit;color:var(--ink)}
  select{background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:9px 10px;min-height:44px}
  input[type=range]{accent-color:var(--navy);width:100%}
  .note{font-size:12.5px;color:var(--muted);background:var(--sand);border-radius:12px;padding:10px 12px}
  /* التوجيهات */
  .dirs{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
  .dirs div{background:var(--paper);border-radius:12px;padding:10px 13px;border:1px solid var(--line)}
  .dirs b{display:block;font-size:13.5px;color:var(--ink)} .dirs small{color:var(--muted);font-size:12px;line-height:1.7}
  .dirs .miss b{color:var(--bad)}
  /* الجداول */
  .grade h3{margin:0 0 8px;font-size:16px} .grade h3 small{font-weight:500;color:var(--label);font-size:12.5px;margin-inline-start:6px}
  .scroll{overflow-x:auto;border-radius:12px;border:1px solid var(--line);background:var(--paper)}
  table{border-collapse:collapse;width:100%;min-width:820px;font-size:13px}
  th{text-align:start;font-size:11.5px;font-weight:700;color:var(--label);letter-spacing:.2px;padding:9px 12px;border-bottom:1px solid var(--line);white-space:nowrap}
  td{padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:top}
  tr:last-child td{border-bottom:0}
  td small{color:var(--label)} td .sub{display:block;font-size:11.5px}
  td.dir{font-size:12px;color:var(--muted);max-width:190px}
  td.iss span{display:block;font-size:12px;color:var(--rev)} td.iss .none{color:var(--label)}
  td a{color:var(--navy);font-weight:600;white-space:nowrap} :root[data-theme="dark"] td a{color:#A8C6E2}
  @media (prefers-color-scheme: dark){:root:not([data-theme="light"]) td a{color:#A8C6E2}}
  .pill{display:inline-block;font-size:11.5px;font-weight:700;padding:2px 10px;border-radius:999px;white-space:nowrap}
  .pill.ok{background:var(--okbg);color:var(--ok)} .pill.rev{background:var(--revbg);color:var(--rev)} .pill.bad{background:var(--badbg);color:var(--bad)}
  .tag{display:inline-block;margin-inline-start:6px;font-size:10.5px;font-weight:700;color:var(--muted);background:var(--sand);border-radius:6px;padding:0 6px}
  .tag.old{color:var(--bad);background:var(--badbg)}
  .missing{display:flex;flex-wrap:wrap;gap:8px} .missing span{background:var(--paper);border:1px solid var(--line);border-radius:999px;padding:3px 12px;font-size:12.5px}
  ol.next{margin:0;padding-inline-start:20px;max-width:70ch;display:flex;flex-direction:column;gap:6px}
  footer{color:var(--label);font-size:12px;padding-bottom:30px}
  :focus-visible{outline:2px solid var(--amber);outline-offset:2px}
</style>

<header><div class="wrap">
  <div class="eyebrow">شعبة · خطوة قياس قبل بناء شريط الخطة</div>
  <h1>خطط توزيع ${STAGE} — الفصل الاول ٢٠٢٦/٢٠٢٧</h1>
  <p>قرئت خطط توزيع المنهج كما نشرتها وزارة التربية في مكتبة المعلم، جدولا جدولا، ليعرف قبل البناء ما يقرأ سليما وما يحتاج مراجعة. لم يتغير شيء في المنصة.</p>
  <div class="verdict">
    <div class="stat hl"><b>${AR(ok)}</b><span>قرئت سليمة</span></div>
    <div class="stat"><b>${AR(review)}</b><span>تحتاج مراجعة</span></div>
    <div class="stat"><b>${AR(noTable)}</b><span>لم يقرأ جدولها</span></div>
    <div class="stat"><b>${AR(R.length)}</b><span>خطة من ${AR(core.length)} مقرر اساسي و${AR(elect.length)} اختياري</span></div>
    ${old ? `<div class="stat"><b>${AR(old)}</b><span>بلا خطة للعام الجاري فأخذت القديمة</span></div>` : ''}
  </div>
</div></header>

<main class="wrap">
  <section>
    <h2>شريط الخطة ببيانات حقيقية</h2>
    <p class="lead">هكذا يظهر «خطة المنهج» في اللوحة حين تربط بخطة المقرر: شرائح الاسابيع، والاسبوع الجاري، ودروسه. اختر مقررا وحرك الاسبوع. <b>نموذج للمعاينة — ليس في المنصة بعد</b>، والانجاز الفعلي يأتي لاحقا من سجل «ما قطع من المنهج».</p>
    <div class="demo">
      <div class="phone" id="phone" aria-live="polite"></div>
      <div class="ctrl">
        <label>المقرر<select id="pick"></select></label>
        <label>الاسبوع الدراسي <span id="wkLbl"></span><input type="range" id="wk" min="1" max="13" value="4"></label>
        <div class="note">الشرائح الكحلية اسابيع مضت، والعنبرية الاسبوع الجاري. ويحسب الاسبوع في المنصة من اول يوم دراسي تدخله في الاعداد.</div>
      </div>
    </div>
  </section>

  <section>
    <h2>التوجيهات كما في الاختام</h2>
    <p class="lead">اسم التوجيه يقرأ من ختم «مدير ادارة توجيه…» اسفل الخطة — ومنه ترويسة السجلات التي اتفقنا عليها. <b>لكن خطط ٢٠٢٦/٢٠٢٧ صار اسفلها جدول توقيع فارغ بلا اسم التوجيه</b>، فقرئ الاسم من خطط الاعوام السابقة للمادة نفسها. وما بقي بلا ختم مقروء يحتاج ان تعتمد اسمه — فالقائمة الكاملة صغيرة بعدد الاقسام، والاختام شاهد لها لا مصدرها الوحيد.</p>
    <div class="dirs">${dirRows.map(([d, s]) => `<div class="${d.startsWith('—') ? 'miss' : ''}"><b>${esc(d)}</b><small>${[...s].map(esc).join(' · ')}</small></div>`).join('')}</div>
  </section>

  <section>
    <h2>كل خطة</h2>
    <p class="lead">«سليم» = اسابيع متسلسلة بلا فجوة، ومجموع الحصص يطابق المعلن في الوثيقة حيث يعلن. «يراجع» = قرئت لكن فيها ما يستوقف — الملاحظة بجانبها، والملف الاصلي بضغطة.</p>
    <div style="display:flex;flex-direction:column;gap:22px">${tables}${electTable}</div>
  </section>

  ${X.missing.length ? `<section>
    <h2>مواد بلا خطة في مكتبة الوزارة</h2>
    <p class="lead">مواد في شجرة الوزارة لمرحلة ${STAGE} لم تنشر لها خطة توزيع للفصل الاول بعد.</p>
    <div class="missing">${X.missing.map(m => `<span>${esc(m.grade)} · ${esc(m.subject)}</span>`).join('')}</div>
  </section>` : ''}

  <section>
    <h2>ما بعد القياس</h2>
    <ol class="next">
      <li>مراجعة ما وسم «يراجع» — اغلبه تفصيل قراءة لا خلل في الخطة.</li>
      <li>تخزين الخطط السليمة في المنصة مرجعا ثابتا، ويؤكد رئيس الشعبة ان الخطة المعروضة خطة مقرره.</li>
      <li>بناء الشريط في اللوحة على هذا النموذج، وربط الانجاز بسجل «ما قطع من المنهج» في مرحلة السجلات.</li>
      <li>تكرار القياس للمتوسط والابتدائي، وللفصل الثاني حين تنشر خططه.</li>
    </ol>
  </section>
  <footer>قرئت ${esc(X.at.slice(0, 10))} من مكتبة المعلم (elibrary.moe.edu.kw) · اداة القراءة: _lab/plan-parser/batch.mjs</footer>
</main>

<script>
  var D = ${JSON.stringify(stripData)};
  var AR = function(n){ return String(n).replace(/\\d/g, function(d){ return '٠١٢٣٤٥٦٧٨٩'[d]; }); };
  var pick = document.getElementById('pick'), wk = document.getElementById('wk'), phone = document.getElementById('phone'), lbl = document.getElementById('wkLbl');
  D.forEach(function(p, i){ var o = document.createElement('option'); o.value = i; o.textContent = p.k + (p.status === 'ok' ? '' : ' (يراجع)'); pick.appendChild(o); });
  var pref = D.findIndex(function(p){ return /الثاني عشر · الرياضيات/.test(p.k) && p.status === 'ok'; }); if (pref < 0) pref = D.findIndex(function(p){ return p.status === 'ok'; }); pick.value = Math.max(pref, 0);
  function el(tag, cls, txt){ var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function paint(){
    var p = D[+pick.value]; if (!p) return;
    var W = p.w.length; wk.max = W; if (+wk.value > W) wk.value = W;
    var n = +wk.value, week = p.w[n - 1];
    var total = 0, done = 0; p.w.forEach(function(w, i){ w.l.forEach(function(l){ total += l[1]; if (i < n - 1) done += l[1]; }); });
    lbl.textContent = AR(n) + ' من ' + AR(W);
    phone.textContent = '';
    var s = el('div', 'sect'); s.appendChild(el('div', 'h', 'خطة المنهج')); s.appendChild(el('div', 'a', AR(Math.round(done / Math.max(total, 1) * 100)) + '٪ من الخطة'));
    var sl = el('div', 'slices'); for (var i = 1; i <= W; i++) sl.appendChild(el('i', i < n ? 'done' : i === n ? 'now' : ''));
    var line = el('div', 'planline'); line.innerHTML = '';
    line.appendChild(document.createTextNode(p.k + ' · الاسبوع ' + AR(n) + ' من ')); line.appendChild(el('b', null, AR(W)));
    line.appendChild(document.createTextNode(' · ' + AR(done) + ' حصة مضت من ' + AR(total)));
    var box = el('div', 'wk');
    if (week && week.u) box.appendChild(el('div', 'u', week.u));
    var ul = el('ul');
    (week ? week.l : []).forEach(function(l){ var li = el('li'); li.appendChild(el('div', null, l[0] || '—')); li.appendChild(el('span', null, l[1] ? AR(l[1]) + ' حصة' : '')); ul.appendChild(li); });
    if (!ul.children.length) ul.appendChild(el('li', null, 'لا دروس مقروءة لهذا الاسبوع'));
    box.appendChild(ul);
    [s, sl, line, box].forEach(function(x){ phone.appendChild(x); });
  }
  pick.addEventListener('change', function(){ wk.value = 4; paint(); });
  wk.addEventListener('input', paint);
  paint();
</script>
`;
fs.writeFileSync(OUT, html);
console.log('✓ ' + OUT + ' · ' + (html.length / 1024).toFixed(0) + ' ك.ب · خطط في النموذج: ' + stripData.length);
