/* ===================================================================
   شعبة · تنبيه يوم مراقبة الشعبة — 2026-11-09، طلب المستخدم:
   «اريد اضافة تنبيه ليوم مراقبة الشعبة بحيث يظهر لي و للمعلمين فقط».
   ────────────────────────────────────────────────────────────────
   النطاق المعتمد: يوم المراقبة من «الجدول» ⟵ «مراقبة شعبتك» (d.duty = {يوم: true}).
     ① صباحه الساعة 7:00: «اليوم مراقبة الشعبة» وفيه فرص المراقبة بأوقاتها.
     ② قبل كل فرصة مراقبة (duty:true في refdata.js) بخمس دقائق.
   يصل رئيس الشعبة (push.js) ومعلميه المقبولة أجهزتهم (tpush.js)، ولا يطفئه المعلم.
   ⚠ دالة خالصة: لا قاعدة ولا إرسال — والمرسل يقرر «يوم دوام» ويضع المفتاح مرة واحدة.
   =================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let REF = null;
function ref() {
  if (REF) return REF;
  const w = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'public', 'refdata.js'), 'utf8'), { window: w });
  return (REF = w.SHOUBA_REF);
}
function mins(at) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(at || ''));
  return m ? (+m[1]) * 60 + (+m[2]) : null;
}
/* فرص المراقبة لمرحلة الشعبة */
function breaksOf(stage) {
  const t = ref().periodTimes;
  return (t[stage] || t['ثانوي']).filter(p => p.brk && p.duty);
}

const MORNING = 7 * 60, LEAD = 5, GRACE = 2;

/* data: وثيقة الشعبة · c: push.clock() · schoolDay: هل اليوم يوم دوام · url: ما يفتحه لمس الإشعار */
function dutyDue(data, c, schoolDay, url) {
  const out = [];
  if (!data || !schoolDay || !((data.duty || {})[c.day])) return out;
  const br = breaksOf(data.stage);
  const first = br.length ? mins(br[0].from) : null;
  /* ① الصباح: من 7:00 حتى أول فرصة مراقبة (ومن فاته لا يلحقه بعدها — يكفيه تنبيه الفرصة) */
  if (c.min >= MORNING && c.min < (first !== null ? first - LEAD : MORNING + 60))
    out.push({ key: 'duty:am:' + c.date, msg: { title: 'اليوم مراقبة الشعبة',
      body: br.length ? br.map(b => b.label + ' من ' + b.from + ' إلى ' + b.to).join('، و') + '.' : 'مراقبة الشعبة في الفرص.',
      tag: 'duty', url, ttl: 4 * 3600, urgency: 'high' } });
  /* ② قبل كل فرصة بخمس دقائق */
  br.forEach((b, i) => {
    const from = mins(b.from);
    if (from === null || c.min < from - LEAD || c.min >= Math.min(from - LEAD + GRACE, from)) return;
    out.push({ key: 'duty:' + i + ':' + c.date, msg: { title: 'مراقبة الشعبة بعد ' + (from - c.min) + ' دقائق',
      body: b.label + '، من ' + b.from + ' إلى ' + b.to + '.', tag: 'duty', url, ttl: 5 * 60, urgency: 'high' } });
  });
  return out;
}

module.exports = { dutyDue, breaksOf };
