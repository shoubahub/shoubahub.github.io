/* ===================================================================
   شعبة · خطط التوزيع (2026-09-13) — الخطوة (ب) من بناء شريط الخطة
   ────────────────────────────────────────────────────────────────
   خطط توزيع المنهج كما قرأها المختبر (_lab/plan-parser/export.mjs) في plans/plans-<العام>-t<الفصل>.json
   — مع الكود لا في القاعدة: بيانات مرجعية واحدة للمنصة كلها، تتجدد بقراءة جديدة ونشرة.

   ⚠ لا تصل رئيس شعبة قبل اعتماد المالك (قرار المستخدم 2026-09-12): قراره في جدول plan_reviews
     في القاعدة (على القرص الدائم DB_PATH، فيبقى مع كل نشرة). والمفتاح يحمل رقم الملف في مكتبة
     المعلم (مرحلة|صف|مادة|ملف) — فخطة رفعتها الوزارة من جديد تراجع من جديد.
   ⚠ الخطة التي لا تعتمد يظهر مكانها عند رئيس الشعبة «يجب رفع الخطة» (الخطوة ج) — لا بيانات ناقصة
     ولا مخمنة. ورفع رئيس الشعبة خطته مؤجل للتطوير القادم (قرار المستخدم 2026-09-13).
   ⚠ مسارات الادارة وحدها هنا (خلف رقم الادارة). ومسار رئيس الشعبة للخطط المعتمدة في الخطوة (ج).
   =================================================================== */
const fs = require('fs');
const path = require('path');
const { db } = require('./db');

const DIR = path.join(__dirname, 'plans');

db.exec(`
  CREATE TABLE IF NOT EXISTS plan_reviews (
    key        TEXT PRIMARY KEY,
    decision   TEXT NOT NULL CHECK (decision IN ('approved','rejected')),
    note       TEXT,
    decided_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

/* مجموعات الخطط: ملف لكل عام وفصل — والاحدث آخرها */
let SETS = [];
function load(dir = DIR) {
  SETS = [];
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter(f => /^plans-.+\.json$/.test(f)).sort()) {
      try {
        const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        SETS.push({ id: f.replace(/^plans-|\.json$/g, ''), year: j.year, term: j.term, calendar: j.calendar || [], plans: j.plans || [] });
      } catch (e) { console.error('تعذرت قراءة خطط', f, e.message); }
    }
  }
  console.log('خطط التوزيع:', SETS.map(s => s.id + ' (' + s.plans.length + ')').join(' · ') || 'لا شيء');
  return SETS;
}
load();

function setOf(id) { return SETS.find(s => s.id === id) || SETS[SETS.length - 1] || null; }
function decisions() {
  const m = new Map();
  for (const r of db.prepare('SELECT key, decision, note, decided_at FROM plan_reviews').all()) m.set(r.key, r);
  return m;
}
/* ملخص الخطة للقائمة — بلا الاسابيع (القائمة ١٧٢ خطة) */
function summary(p, d) {
  return { key: p.key, stageId: p.stageId, stage: p.stage, grade: p.grade, subject: p.subject, elective: !!p.elective,
    status: p.status, issues: p.issues || [], stated: p.stated, periods: p.periods, weeks: (p.weeks || []).length, source: p.source,
    decision: d ? d.decision : null, note: d ? d.note : null, decided_at: d ? d.decided_at : null };
}

/* مرحلة الشعبة كما في وثيقتها ⟵ رقمها في مكتبة المعلم (اصل مفتاح الخطة) */
const STAGE_ID = { 'ابتدائي': '24', 'متوسط': '15', 'ثانوي': '17' };

function routes(app, requireAdmin, requireUser) {
  /* رئيس الشعبة (الخطوة ج): الخطط المعتمدة لمرحلته وحدها — لا الملف كله (٥٧٣ ك.ب) — بتقويم الفصل.
     وبصمة v (المجموعة · عدد المعتمد · آخر قرار): ان كانت عنده «لا جديد» فلا يعاد تنزيلها */
  if (requireUser) app.get('/api/plans', requireUser, (req, res) => {
    const s = setOf(req.query.set), sid = STAGE_ID[req.query.stage] || String(req.query.stage || '');
    if (!s || !/^\d+$/.test(sid)) return res.json({ set: null, v: '', calendar: [], plans: [] });
    const d = decisions();
    const mine = s.plans.filter(p => p.stageId === sid && d.has(p.key) && d.get(p.key).decision === 'approved');
    const last = mine.reduce((m, p) => { const t = d.get(p.key).decided_at || ''; return t > m ? t : m; }, '');
    const v = s.id + ':' + mine.length + ':' + last;
    if (req.query.v && req.query.v === v) return res.json({ same: true, v });
    res.json({ set: { id: s.id, year: s.year, term: s.term }, v, calendar: s.calendar,
      plans: mine.map(p => ({ key: p.key, grade: p.grade, subject: p.subject, elective: !!p.elective, source: p.source,
        stated: p.stated, periods: p.periods, weeks: p.weeks })) });
  });
  /* القائمة وقرار كل خطة */
  app.get('/api/admin/plans', requireAdmin, (req, res) => {
    const s = setOf(req.query.set);
    if (!s) return res.json({ set: null, sets: [], plans: [] });
    const d = decisions();
    res.json({ set: { id: s.id, year: s.year, term: s.term }, sets: SETS.map(x => x.id), plans: s.plans.map(p => summary(p, d.get(p.key))) });
  });
  /* خطة واحدة باسابيعها ودروسها — للنظر قبل الاعتماد */
  app.get('/api/admin/plans/one', requireAdmin, (req, res) => {
    const s = setOf(req.query.set), p = s && s.plans.find(x => x.key === req.query.key);
    if (!p) return res.status(404).json({ error: 'الخطة غير موجودة' });
    const d = decisions().get(p.key);
    res.json({ plan: Object.assign({}, p, { decision: d ? d.decision : null, note: d ? d.note : null }), calendar: s.calendar });
  });
  /* القرار: اعتمدت · لا تعتمد (يجب رفع الخطة) · او null يلغيه */
  app.post('/api/admin/plans/decision', requireAdmin, (req, res) => {
    const b = req.body || {}, s = setOf(b.set), p = s && s.plans.find(x => x.key === b.key);
    if (!p) return res.status(404).json({ error: 'الخطة غير موجودة' });
    if (b.decision == null) { db.prepare('DELETE FROM plan_reviews WHERE key = ?').run(p.key); return res.json({ ok: true, decision: null }); }
    if (!['approved', 'rejected'].includes(b.decision)) return res.status(400).json({ error: 'قرار غير معروف' });
    db.prepare(`INSERT INTO plan_reviews (key, decision, note, decided_at) VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET decision = excluded.decision, note = excluded.note, decided_at = excluded.decided_at`)
      .run(p.key, b.decision, b.note ? String(b.note).slice(0, 300) : null);
    res.json({ ok: true, decision: b.decision });
  });
  /* اعتماد السليمة كلها دفعة — ما لم يقرر فيه بعد وحده، فلا يمس قرارا سابقا (ومنه «لا تعتمد») */
  app.post('/api/admin/plans/approve-sound', requireAdmin, (req, res) => {
    const s = setOf((req.body || {}).set);
    if (!s) return res.json({ ok: true, approved: 0 });
    const d = decisions(), ins = db.prepare(`INSERT INTO plan_reviews (key, decision) VALUES (?, 'approved') ON CONFLICT(key) DO NOTHING`);
    let n = 0;
    db.transaction(() => { for (const p of s.plans) if (p.status === 'ok' && !d.has(p.key)) { ins.run(p.key); n++; } })();
    res.json({ ok: true, approved: n });
  });
}

module.exports = { routes, load, sets: () => SETS, decisions };
