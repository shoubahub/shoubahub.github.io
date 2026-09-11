// قراءة خطط توزيع المنهج بالجملة — خطوة قياس (2026-09-11)
// node batch.mjs <مجلد العمل> [المرحلة=17] [الفصل=1]
// المدخل: <مجلد العمل>/plans/sec-t1.json (نتيجة librarysearch) و moe-tree.json
// المخرج: <مجلد العمل>/plans/extract-<المرحلة>-t<الفصل>.json — لكل خطة بنيتها وتقرير دقتها
// ⚠ ليست جزءا من المنصة: تقيس هل تقرأ الخطط كلها قراءة موثوقة قبل ان يبنى عليها شريط الخطة.
import fs from 'fs';
import { openDoc } from './lib2.mjs';
import { readTable, norm } from './lib3.mjs';

const W = process.argv[2], STAGE = process.argv[3] || '17', TERM = +(process.argv[4] || 1);
const LIST = JSON.parse(fs.readFileSync(`${W}/plans/sec-t1.json`, 'utf8')).books || [];
const TREE = JSON.parse(fs.readFileSync(`${W}/moe-tree.json`, 'utf8'));
const DOCS = `${W}/moe-docs`; fs.mkdirSync(DOCS, { recursive: true });

const gen = Object.values(TREE).find(x => /العام/.test(x.name));
const st = gen.stages[STAGE];
const gname = {}, sname = {};
for (const [gid, G] of Object.entries(st.grades)) { gname[gid] = G.name.trim(); for (const s of G.subjects) sname[s.value || s.id] = s.text.trim(); }

/* ── الاختيار: خطة العام الجاري اولا، ونسخة «طلاب منازل» بديل لا اصل ── */
const CUR = x => /2026\s*[-–]\s*2027/.test(x.fileDescription || '') || String(x.createdDate || '') >= '2026-08-01';
const HOME = x => /منازل/.test(x.fileDescription || '');
const plans = LIST.filter(x => /توز/.test(x.fileDescription || '') && x.term === TERM);
const groups = {};
for (const x of plans) (groups[x.educationGradeID + '|' + x.educationSubjectID] ||= []).push(x);
const picked = [];
for (const [k, arr] of Object.entries(groups)) {
  const [g, s] = k.split('|');
  const cur = arr.filter(x => CUR(x) && !HOME(x)).sort((a, b) => b.bookFileID - a.bookFileID);
  const home = arr.filter(x => CUR(x) && HOME(x));
  const elective = gname[g] && /اختيار/.test(gname[g]);
  if (elective) cur.forEach(x => picked.push({ x, g, s, why: 'current', elective: true }));
  else if (cur.length) cur.forEach((x, i) => picked.push({ x, g, s, why: i ? 'current-extra' : 'current', homeVariant: home.map(h => h.bookFileID) }));
  else { const old = arr.filter(x => !HOME(x)).sort((a, b) => b.bookFileID - a.bookFileID)[0]; if (old) picked.push({ x: old, g, s, why: 'old' }); }
}

/* ── التسميات الترتيبية للأسابيع — تصل مقطعة من التسمية المدارة، فالمطابقة بلا فراغات ── */
const ORD = ['الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر',
  'الثالث عشر','الرابع عشر','الخامس عشر','السادس عشر','السابع عشر','الثامن عشر','التاسع عشر','العشرون'];
const bare = s => norm(s || '').replace(/\s+/g, '').replace(/[أإآ]/g, 'ا');
const ordIndex = s => { const i = ORD.findIndex(o => bare(o) === bare(s)); return i < 0 ? null : i + 1; };
const fixLig = s => s.replace(/اال/g, 'الا').replace(/لال/g, 'للا').replace(/اإل/g, 'الإ').replace(/اآل/g, 'الآ');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ⚠ التنزيل بـcurl لا بـfetch: جاء رد مبتور من خادم الوزارة (Z_BUF_ERROR) فانفجر خطؤه من
   مجرى البيانات خارج try — فوقف القياس كله عند الملف الثاني. والملف لا يعتمد الا ان بدأ «%PDF». */
import { execFileSync } from 'child_process';
const isPdf = f => { try { const b = Buffer.alloc(5); const fd = fs.openSync(f, 'r'); fs.readSync(fd, b, 0, 5, 0); fs.closeSync(fd); return b.toString() === '%PDF-'; } catch (e) { return false; } };
process.on('unhandledRejection', e => console.log('  (خطأ عابر تجاوزناه: ' + (e && e.code || e) + ')'));
process.on('uncaughtException', e => console.log('  (خطأ عابر تجاوزناه: ' + (e && e.code || e) + ')'));
async function fetchPdf(id) {
  const f = `${DOCS}/b${id}.pdf`;
  if (fs.existsSync(f) && isPdf(f)) return f;
  for (let a = 0; a < 3; a++) {
    try {
      execFileSync('curl', ['-s', '-f', '-L', '--retry', '2', '-m', '90', '-o', f, `https://elibrary.moe.edu.kw/api/File/preview/book/${id}`]);
      if (isPdf(f)) return f;
    } catch (e) {}
    await sleep(2000 * (a + 1));
  }
  try { fs.unlinkSync(f); } catch (e) {}
  return null;
}

async function extract(p) {
  const out = { id: p.x.bookFileID, grade: gname[p.g] || p.g, gradeId: p.g, subject: sname[p.s] || p.s, subjectId: p.s,
    desc: (p.x.fileDescription || '').trim(), uploaded: String(p.x.createdDate || '').slice(0, 10), pick: p.why,
    elective: !!p.elective, homeVariant: p.homeVariant || [] };
  const f = await fetchPdf(out.id);
  if (!f) return { ...out, status: 'download-failed' };
  let doc;
  try { doc = await openDoc(f); } catch (e) { return { ...out, status: 'unreadable', error: String(e.message || e) }; }
  out.pages = doc.numPages;
  let head = '', all = '', noTable = 0, stated = null;
  let weeks = [];
  /* ⚠ الملف الواحد قد يحوي عدة مقررات (الرياضيات والاحصاء للصفين في ملف واحد من ٢٠ صفحة، رفع
     باربعة اسماء): تقسم الصفحات عند كل «المجموع الكلي» — لكل مقرر مجموعه في آخر صفحاته. */
  const segs = [{ pages: [], weeks: [], stated: null, grade: '' }];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const txt = fixLig((await page.getTextContent()).items.map(i => i.str).join(' ').replace(/\s+/g, ' ')).normalize('NFKC');
    if (n <= 2) head += txt + ' ';
    all += txt + ' ';
    const seg = segs[segs.length - 1];
    seg.pages.push(n);
    if (!seg.grade) { const g = txt.match(/الصف\s*:?\s*(ا?\s?ل?\s?(?:عاشر|حادي|ثاني|ثانى)[^\s:]*)/); if (g) seg.grade = g[1].replace(/\s+/g, ''); }
    /* المعلن: عدد من ثلاث خانات على الاكثر — كان يلتقط «2026» من سطر العام الدراسي */
    const m = txt.match(/المجموع\s*الكلي[^\d]{0,60}?(?<!\d)(\d{1,3})(?!\d)/);
    let t = null; try { t = await readTable(page); } catch (e) {}
    if (!t) noTable++;
    else for (const w of t.weeks) seg.weeks.push({ label: (w.أسبوع || '').replace(/\s+/g, ' ').trim(), unit: (w.وحدة || '').replace(/\s+/g, ' ').trim(),
      lessons: (w.دروس || []).map(l => ({ title: (l.دروس || []).join(' · ').replace(/\s+/g, ' ').trim(), periods: parseInt(l.حصص || '0') || 0 })) });
    if (m && +m[1] > 0) { seg.stated = +m[1]; if (n < doc.numPages) segs.push({ pages: [], weeks: [], stated: null, grade: '' }); }
  }
  const real = segs.filter(s => s.weeks.length);
  out.segments = real.length > 1 ? real.map(s => ({ pages: s.pages[0] + '–' + s.pages[s.pages.length - 1], grade: s.grade, weeks: s.weeks.length,
    periods: s.weeks.reduce((a, w) => a + w.lessons.reduce((b, l) => b + l.periods, 0), 0), stated: s.stated })) : null;
  /* للمقرر قسمه: بالصف ان حسمه عنوان القسم، والا يبقى الاول ويوسم للمراجعة */
  let chosen = real[0] || segs[0];
  if (real.length > 1) {
    const want = /حادي/.test(out.grade) ? /حادي/ : /ثاني|ثانى/.test(out.grade) ? /ثاني|ثانى/ : /عاشر/;
    const known = /حادي|ثاني|ثانى|عاشر/;
    const byGrade = real.filter(s => want.test(s.grade));
    const unknown = real.filter(s => !known.test(s.grade));
    const isStats = /إحصاء|احصاء/.test(out.subject);
    /* الاحصاء: قسماه بلا صف مقروء في ترويستهما — ينسبان بالترتيب (الحادي عشر اولا) ويوسمان للمراجعة */
    if (isStats && unknown.length) { chosen = unknown[/حادي/.test(out.grade) ? 0 : unknown.length - 1]; out.segmentPick = 'guess'; }
    else if (byGrade.length === 1) { chosen = byGrade[0]; out.segmentPick = 'grade'; }
    else { chosen = (byGrade[0] || real[0]); out.segmentPick = 'guess'; }
  }
  weeks = chosen.weeks; stated = chosen.stated;
  /* الترويسة: اسم المقرر كما تكتبه الوثيقة، والصف */
  const cm = head.match(/توزيع\s+منهج\s+(?:مادة|مقرر)?:?\s*(.{2,60}?)\s+(?:للعام|العام|الفصل|الصف|لل?صف)/) || head.match(/مادة:?\s*([^:]{2,45}?)\s+(?:العام|الفصل)/);
  out.courseTitle = cm ? cm[1].replace(/[-–:]+$/, '').trim() : null;
  /* اكثر من مقرر = عناوين مقررات مختلفة، لا تكرار «توزيع منهج» في ترويسة كل صفحة */
  const titles = new Set([...all.matchAll(/توزيع\s+منهج\s+(?:مادة|مقرر)?:?\s*(.{2,40}?)\s+(?:للعام|العام|الفصل|الصف|لل?صف)/g)].map(x => bare(x[1])));
  out.multiCourse = titles.size > 1;
  out.titles = titles.size;
  /* الختم: «مدير إدارة توجيه …» — ويستبعد «التوجيه الفني المختص» النمطي */
  const dm = all.match(/(?:مدير\s+)?إدارة\s+(?:ال)?توجيه\s+(?:الفني\s+)?(?:العام\s+)?(?:ل)?([^\s،.:]+(?:\s+(?:و|ال)[^\s،.:]+){0,3})/);
  const dm2 = !dm && all.match(/التوجيه\s+الفني\s+(?:العام\s+)?(?:ل|للغة\s+)?([^\s،.:]+(?:\s+[^\s،.:]+)?)/);
  out.directorate = dm ? 'إدارة توجيه ' + dm[1].trim() : dm2 && !/المختص/.test(dm2[0]) ? 'التوجيه الفني ' + dm2[1].trim() : null;
  out.hasDates = /\d{1,2}\s*[\/\-]\s*\d{1,2}\s*[\/\-]\s*20\d\d/.test(all);
  /* سبب تعذر الجدول: نص لا يقرأ (خط بترميز خاص — التربية الاسلامية والقران) ام جدول لم يتعرف عليه */
  const arCount = (all.match(/[ء-ي]/g) || []).length;
  out.cause = null;
  /* الجودة */
  const seq = weeks.map(w => ordIndex(w.label)).filter(Boolean);
  const uniq = [...new Set(seq)];
  const maxW = uniq.length ? Math.max(...uniq) : 0;
  const gaps = []; for (let i = 1; i <= maxW; i++) if (!uniq.includes(i)) gaps.push(i);
  const dups = [...new Set(seq.filter((v, i) => seq.indexOf(v) !== i))];
  const lessons = weeks.reduce((a, w) => a + w.lessons.length, 0);
  const periods = weeks.reduce((a, w) => a + w.lessons.reduce((b, l) => b + l.periods, 0), 0);
  Object.assign(out, { weeks: weeks.length, lessons, periods, stated, noTable, labeled: seq.length, gaps, dups,
    totalMatch: stated == null ? null : stated === periods, plan: weeks });
  const issues = [];
  if (!weeks.length) issues.push('لم يقرأ جدول');
  if (weeks.length && weeks.length < 8) issues.push('أسابيع قليلة (' + weeks.length + ')');
  if (weeks.length > 22) issues.push('أسابيع كثيرة (' + weeks.length + ') — قد يجمع الملف فصلين أو مقررين');
  if (gaps.length) issues.push('فجوات في ترقيم الأسابيع: ' + gaps.join('،'));
  if (dups.length) issues.push('تكرار أسابيع: ' + dups.join('،'));
  if (stated != null && stated !== periods) issues.push('مجموع الحصص ' + periods + ' والمعلن ' + stated);
  if (out.multiCourse) issues.push('قد يحوي أكثر من مقرر');
  if (weeks.length && !periods) issues.push('لم تقرأ أعداد الحصص');
  if (!weeks.length) out.cause = (arCount < 300 && !/week|unit|lesson|period/i.test(all)) ? 'encoding' : 'layout';
  if (out.segments) issues.push('ملف يجمع ' + out.segments.length + ' مقررات — ' + (out.segmentPick === 'grade' ? 'نسب القسم بالصف' : 'نسب القسم تقديرا ويراجع'));
  if (!out.directorate) issues.push('لم يقرأ الختم');
  out.issues = issues;
  out.status = !weeks.length ? 'no-table' : issues.filter(i => !/الختم/.test(i)).length ? 'review' : 'ok';
  return out;
}

const results = [];
let i = 0;
for (const p of picked) {
  i++;
  const r = await extract(p);
  results.push(r);
  console.log(`[${i}/${picked.length}] ${r.status.padEnd(8)} ${r.grade} · ${r.subject} (#${r.id}) — ${r.weeks ?? '-'} أسبوعا · ${r.periods ?? '-'} حصة${r.stated != null ? ' / ' + r.stated : ''} · ${r.directorate || 'بلا ختم'}${r.issues && r.issues.length ? ' ⟵ ' + r.issues.join(' | ') : ''}`);
  await sleep(300);
}
/* المواد في شجرة الوزارة بلا خطة تختار */
const missing = [];
for (const [gid, G] of Object.entries(st.grades)) for (const s of G.subjects) {
  const id = String(s.value || s.id);
  if (!results.some(r => String(r.gradeId) === String(gid) && String(r.subjectId) === id)) missing.push({ grade: G.name.trim(), subject: s.text.trim() });
}
fs.writeFileSync(`${W}/plans/extract-${STAGE}-t${TERM}.json`, JSON.stringify({ stage: st.name.trim(), term: TERM, at: new Date().toISOString(), results, missing }, null, 1));
const c = s => results.filter(r => r.status === s).length;
console.log(`\nالمجموع ${results.length} · سليم ${c('ok')} · يراجع ${c('review')} · بلا جدول ${c('no-table')} · تعذر تنزيله ${c('download-failed')} · لا يقرأ ${c('unreadable')} · مواد بلا خطة ${missing.length}`);
