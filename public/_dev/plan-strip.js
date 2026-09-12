/* عينة «شريط الخطة» (2026-09-13) — اداة تطوير للاعتماد قبل البناء، ولا تمس board.html.
   ترسم في قسم «خطة المنهج» القائم: شرائح الفصل الثلاث عشرة · سطر الاسبوع ومداه · جدول المواد والصفوف بدروس
   الاسبوع وحصصها. وصورتان (طلب المستخدم: «نموذج مطول للسجل ونموذج للوحة مختصر»):
   • compact (اللوحة): سطر واحد لكل مادة، والصف ورابط «الخطة كاملة ›» يفتحان الصورة المطولة (opt.detail)؛
   • والا (القسم وحده): سطران لكل مادة، والصف يفتح لوحة سفلية بدروس الاسبوع والذي بعده.
   المبدأ: الشريط يقول ما تقوله الخطة لهذا الاسبوع، ولا يحكم على معلم بتأخر (لا تأشير انجاز بعد).
   تستعمله plan-strip-sim.html وboard-plan-sim.html، والمطولة plan-record-sim.html تستعمل دواله */
(function () {
  var TOTAL = 13, START = new Date(2026, 8, 13), WEEK = 6048e5;   /* الاسبوع الاول: الاحد ١٣ سبتمبر ٢٠٢٦ */
  var MON = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  var ORD = ['الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر','الثالث عشر'];
  var CSS = ''
    /* صف الخطة: المادة والصف · دروس الاسبوع (سطران، وسطر في المختصرة) · الحصص */
    + '.ptbl{margin-top:4px}'
    + '.ptr{cursor:pointer;-webkit-tap-highlight-color:transparent;align-items:flex-start}'
    + '.ptr:active{background:rgba(22,69,110,.05)}'
    + '.ptr .who{width:74px;flex:none;display:flex;flex-direction:column;gap:1px}'
    + '.ptr .who b{font-size:12.5px;font-weight:700;color:var(--shouba-navy)}'
    + '.ptr .who small{font-size:10.5px;font-weight:600;color:var(--shouba-label)}'
    + '.ptr .ls{flex:1;min-width:0;font-size:12px;font-weight:600;color:var(--shouba-ink);line-height:1.6;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}'
    + '.ptr .pp{flex:none;font-size:11px;font-weight:700;color:var(--shouba-amber-deep);font-family:var(--font-num);padding-top:2px}'
    + '.ptr .ls.none{color:var(--shouba-hint)}'
    /* المختصرة: المادة والصف في سطر، والدروس سطر واحد، وسهم الى المطولة */
    + '.ptr.c{align-items:center;padding-top:8px;padding-bottom:8px}'
    + '.ptr.c .who{width:auto;max-width:96px;flex-direction:row;gap:4px;align-items:baseline;white-space:nowrap}'
    + '.ptr.c .ls{-webkit-line-clamp:1}'
    + '.ptr.c .pp{padding-top:0}'
    + '.ptr.c .chev{flex:none;color:var(--shouba-hint);font-size:14px;font-weight:700}'
    /* دروس الاسبوع في اللوحة السفلية */
    + '.wk{display:flex;flex-direction:column;gap:8px}'
    + '.wk h4{margin:6px 0 0;font-size:12px;font-weight:700;color:var(--shouba-label)}'
    + '.wk .l{display:flex;gap:10px;align-items:flex-start;font-size:13.5px;font-weight:600;color:var(--shouba-ink);line-height:1.7}'
    + '.wk .l span{flex:1}'
    + '.wk .l em{font-style:normal;flex:none;font-size:11.5px;font-weight:700;color:var(--shouba-amber-deep);font-family:var(--font-num)}';

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function css() { if (!document.getElementById('plan-strip-css')) { var st = el('style', null, CSS); st.id = 'plan-strip-css'; document.head.appendChild(st); } }
  function range(n) {
    var a = new Date(START.getTime() + (n - 1) * WEEK), b = new Date(a.getTime() + 4 * 864e5);
    return a.getDate() + (a.getMonth() !== b.getMonth() ? ' ' + MON[a.getMonth()] : '') + ' – ' + b.getDate() + ' ' + MON[b.getMonth()];
  }
  function current() { return Math.min(TOTAL, Math.max(1, Math.floor((Date.now() - START.getTime()) / WEEK) + 1)); }
  function weekOf(p, n) { return (p.weeks || []).filter(function (w) { return w.n === n; })[0] || null; }
  /* الدرس المتكرر في حصص متتالية يعرض مرة بمجموع حصصه: خطط «لكل حصة درس» (لغتي العربية) تكتب «الفهم والثروة
     اللغوية» ثلاث حصص صفوفا ثلاثة — فكان السطر يكرره ثلاثا. ولا يتغير شيء في خطط الدرس الممتد (الرياضيات) */
  function merged(w) {
    var out = [];
    (w ? w.lessons : []).forEach(function (l) {
      var last = out[out.length - 1];
      if (last && last.t === l.t) last.p += (l.p || 0); else out.push({ t: l.t, p: l.p || 0 });
    });
    return out;
  }
  function periods(w) { return merged(w).reduce(function (a, l) { return a + l.p; }, 0); }

  function mount(sec, opt) {
    opt = opt || {}; css();
    var plans = opt.plans || window.PLAN_SAMPLE || [], missing = opt.missing || [], W = opt.week || current(), C = !!opt.compact;
    var lbl = sec.querySelector('.sect .a'), sl = sec.querySelector('.slices'), line = sec.querySelector('.planline');
    var tbl = sec.querySelector('.ptbl'); if (!tbl) { tbl = el('div', 'tbl ptbl'); sec.appendChild(tbl); }
    if (C && lbl && opt.detail) lbl.onclick = function () { location.href = opt.detail(null, W); };

    function sheetFor(p) {
      var n = el('div', 'wk');
      function list(w, head) {
        n.appendChild(el('h4', null, head));
        if (!w || !w.lessons.length) { n.appendChild(el('div', 'l', 'لا دروس في الخطة لهذا الأسبوع')); return; }
        merged(w).forEach(function (l) { var r = el('div', 'l'); r.appendChild(el('span', null, l.t)); r.appendChild(el('em', null, l.p + ' ح')); n.appendChild(r); });
      }
      list(weekOf(p, W), 'هذا الأسبوع · ' + range(W));
      if (W < TOTAL) list(weekOf(p, W + 1), 'الأسبوع القادم · ' + range(W + 1));
      Shouba.sheet.open(p.subject + ' · ' + p.grade, n);
    }
    function row(p) {
      var r = el('div', 'tr ptr' + (C ? ' c' : '')), who = el('div', 'who');
      who.appendChild(el('b', null, p.subject)); who.appendChild(el('small', null, p.grade));
      r.appendChild(who);
      return r;
    }
    function paint() {
      if (lbl) lbl.textContent = C && opt.detail ? 'الخطة كاملة ›' : 'الأسبوع ' + W + ' من ' + TOTAL;
      sl.style.display = ''; sl.innerHTML = '';
      for (var i = 1; i <= TOTAL; i++) { var c = el('i'); if (i < W) c.className = 'done'; else if (i === W) c.className = 'now'; sl.appendChild(c); }
      line.innerHTML = C ? 'الأسبوع <b>' + W + '</b> من ' + TOTAL + ' · ' + range(W) + ' — حسب خطط التوجيه'
                         : 'حسب خطط التوجيه — <b>' + range(W) + '</b>';
      tbl.innerHTML = '';
      plans.forEach(function (p) {
        var w = weekOf(p, W), r = row(p), has = w && w.lessons.length;
        r.appendChild(el('div', 'ls' + (has ? '' : ' none'), has ? merged(w).map(function (l) { return l.t; }).join(' · ') : 'لا دروس في الخطة لهذا الأسبوع'));
        r.appendChild(el('div', 'pp', periods(w) ? periods(w) + ' ح' : ''));
        if (C) r.appendChild(el('span', 'chev', '‹'));
        r.addEventListener('click', function () { if (C && opt.detail) location.href = opt.detail(p, W); else sheetFor(p); });
        tbl.appendChild(r);
      });
      /* صف بلا خطة: «يجب رفع الخطة» (قرار المستخدم 2026-09-12: لا بيانات مخمنة ولا شريط فارغ صامت) */
      missing.forEach(function (p) {
        var r = row(p);
        r.appendChild(el('div', 'ls none', C ? 'لم تقرأ خطته' : 'لم تقرأ خطته — ارفعها ليظهر أسبوعها هنا'));
        r.appendChild(el('span', 'chip', 'يجب رفع الخطة'));
        tbl.appendChild(r);
      });
      if (opt.onWeek) opt.onWeek(W, range(W), ORD[W - 1]);
    }
    paint();
    return { setWeek: function (n) { W = Math.min(TOTAL, Math.max(1, n)); paint(); }, week: function () { return W; } };
  }
  window.PlanStrip = { mount: mount, TOTAL: TOTAL, ORD: ORD, range: range, current: current, weekOf: weekOf, merged: merged, periods: periods };
})();
