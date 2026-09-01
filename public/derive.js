/* ===================================================================
   شعبة · طبقة الاشتقاق (2026-09-01)
   ────────────────────────────────────────────────────────────────
   **المكان الواحد الذي تُستخرج فيه الحقائق من البيانات.**

   البيانات المخزّنة سطرٌ خام: schedules["أحمد الفهد"]["الأحد"][3] = "12/2 · الفلسفة"
   والحقائق تُحسب منها: مَن يدرّس الآن · مَن متفرّغ · النصاب · التعارض · المتأخّر.

   القاعدة: **كل جواب قد تسأله شاشتان يسكن هنا** — والشاشة تسأل ولا تحسب.
   وما لا يخرج عن شاشة واحدة (ترتيب الأعمدة · الألوان · نصّ الزرّ) يبقى فيها.

   ⚠ لا واجهة هنا ولا DOM ولا نصوص عرض — دوالّ خالصة فقط.
   ⚠ ويوم تنتقل البيانات إلى خادم، **هذا الملفّ وحده يتغيّر** ولا تُمسّ الشاشات.
   يعتمد على: refdata.js (المرجعية) — ويُوصل بعده وقبل components.js.
   =================================================================== */
(function () {
  var KEY = 'shouba.setup';
  window.Shouba = window.Shouba || {};
  var S = window.Shouba;

  /* ===== ① المصدر: نقطة قراءة وكتابة واحدة ===== */
  var cache = null;
  S.data = function (fresh) {
    if (fresh || !cache) { try { cache = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { cache = {}; } }
    return cache;
  };
  S.save = function (patch) {
    var d = S.data();
    if (patch) Object.keys(patch).forEach(function (k) { d[k] = patch[k]; });
    localStorage.setItem(KEY, JSON.stringify(d));
    return d;
  };

  /* ===== ② بنية الشعبة ===== */
  S.stage      = function () { return S.data().stage || 'ثانوي'; };
  S.days       = function () { return SHOUBA_REF.days; };
  S.periods    = function () { return SHOUBA_REF.periodTimes[S.stage()] || SHOUBA_REF.periodTimes['ثانوي']; };
  S.periodCount= function () { return SHOUBA_REF.periodsOf(S.stage()) || 7; };
  S.subjects   = function () {
    var d = S.data();
    return (d.subjects && d.subjects.length) ? d.subjects : SHOUBA_REF.subjectsOf(S.stage(), d.department);
  };
  /* كل معلّمي الشعبة (المسجَّلون في ش⑤) */
  S.teachers   = function () { return (S.data().teachers || []).slice(); };
  /* مَن أُدخل جدوله فقط — وعليه تُحسب أعداد «يدرّسون / متفرّغون»،
     لأن مَن لا جدول له لا يُعرف موضعه فلا يُعدّ متفرّغاً. */
  S.scheduled  = function () { return Object.keys(S.data().schedules || {}); };
  S.withoutSchedule = function () {
    var sc = S.data().schedules || {};
    return S.teachers().filter(function (t) { return !sc[t]; });
  };
  /* كل مَن له وجود في الشعبة: المسجَّلون + مَن له جدول (احتياطاً لاسم لم يعد في القائمة) */
  S.roster = function () {
    var all = S.teachers();
    S.scheduled().forEach(function (t) { if (all.indexOf(t) === -1) all.push(t); });
    return all;
  };

  /* ===== ③ الخانة: القراءة والكتابة والتفكيك ===== */
  /* «١٢/٢ · الفلسفة» ← { cls:'12/2', subject:'الفلسفة' } */
  S.splitSlot = function (s) {
    var p = String(s || '').split('·').map(function (x) { return x.trim(); });
    return { cls: p[0] || '', subject: p[1] || '' };
  };
  S.joinSlot = function (cls, subject) { return cls + ' · ' + subject; };

  S.slot = function (teacher, day, pIdx) {
    var sc = S.data().schedules || {}, t = sc[teacher];
    return (t && t[day] && t[day][pIdx]) || '';
  };
  /* يعيد مصفوفة يوم المعلّم بطولها الصحيح، ويُنشئها إن لم توجد */
  S.daySlots = function (teacher, day) {
    var d = S.data();
    d.schedules = d.schedules || {};
    var t = d.schedules[teacher] || (d.schedules[teacher] = {});
    if (!t[day]) t[day] = [];
    while (t[day].length < S.periodCount()) t[day].push('');
    return t[day];
  };
  S.setSlot = function (teacher, day, pIdx, value) {
    S.daySlots(teacher, day)[pIdx] = value;
    S.save();
    return value;
  };

  /* ===== ④ الحقائق المشتقّة ===== */
  /* مَن يدرّس في هذه الحصة من هذا اليوم */
  S.busyAt = function (day, pIdx) {
    return S.scheduled().filter(function (t) { return S.slot(t, day, pIdx); });
  };
  /* ومَن هو متفرّغ فيها — ممّن أُدخل جدولهم */
  S.freeAt = function (day, pIdx) {
    return S.scheduled().filter(function (t) { return !S.slot(t, day, pIdx); });
  };
  /* نصاب المعلّم: مجموع حصصه في الأسبوع (الفراغ تفرّغٌ لا نقص) */
  S.loadOf = function (teacher) {
    var n = 0;
    S.days().forEach(function (day) {
      S.daySlots(teacher, day).forEach(function (v) { if (v) n++; });
    });
    return n;
  };
  /* تعارض الإسناد: الصفّ نفسه في اليوم والحصة نفسيهما لمعلّمَين.
     scope اختياري: اقصر النتيجة على تعارضات معلّم بعينه. */
  S.clashes = function (scope) {
    var out = [], list = S.roster();
    S.days().forEach(function (day) {
      S.periods().forEach(function (t) {
        if (t.brk) return;
        var pIdx = t.n - 1, seen = {};
        list.forEach(function (who) {
          var cls = S.splitSlot(S.slot(who, day, pIdx)).cls;
          if (!cls) return;
          if (seen[cls]) out.push({ day: day, n: t.n, pIdx: pIdx, cls: cls, teachers: [seen[cls], who] });
          else seen[cls] = who;
        });
      });
    });
    return scope ? out.filter(function (c) { return c.teachers.indexOf(scope) > -1; }) : out;
  };
  /* المواد التي لها خطة منهج */
  S.planSubjects = function () { return Object.keys(S.data().plan || {}); };
  /* تقدّم المنهج: { total, done, pct, cells:[{done,now}] } */
  S.planProgress = function () {
    var d = S.data(), plan = d.plan || {}, progress = d.progress || {}, week = d.weekNo || 1;
    var total = 0, done = 0, cells = [];
    S.planSubjects().forEach(function (s) {
      plan[s].forEach(function (L) {
        total++;
        var isDone = Object.keys(progress).some(function (k) {
          return k.indexOf('|' + s + '|' + L.week) > -1 && progress[k];
        });
        if (isDone) done++;
        cells.push({ done: isDone, now: L.week === week });
      });
    });
    return { total: total, done: done, pct: total ? Math.round(done / total * 100) : 0, cells: cells };
  };
  /* مَن تأخّر عن الخطة: له درس في أسبوع مضى لم يُؤشَّر */
  S.behindPlan = function (limit) {
    var d = S.data(), plan = d.plan || {}, progress = d.progress || {}, week = d.weekNo || 1;
    var names = S.planSubjects();
    if (!names.length) return [];
    var pool = S.teachers();
    if (limit) pool = pool.slice(0, limit);
    return pool.filter(function (t) {
      return names.some(function (s) {
        return plan[s].some(function (L) { return L.week < week && !progress[t + '|' + s + '|' + L.week]; });
      });
    });
  };

  /* ===== ⑤ صيغ الأسماء (تُستعمل في كل الشاشات) ===== */
  S.lastName = function (n) {
    var p = String(n || '').trim().split(' ').filter(Boolean);
    return p[p.length - 1] || n;
  };
  S.firstNameOf = function (n) { return String(n || '').trim().split(' ')[0] || n; };
})();
