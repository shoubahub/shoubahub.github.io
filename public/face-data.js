/* ===================================================================
   شعبة · واجهة الشعبة — الحقائق (2026-10-20)
   ────────────────────────────────────────────────────────────────
   دوال خالصة يقرؤها طرفان: شاشة الادارة (face-admin.html) تبني منها النسخة
   المنشورة، وصفحة الزائر (face.html) تعرض بها ما نشر. فلا يختلف الطرفان في
   «متى تختفي خانة الاسبوع» ولا «اين تقع الفعالية».
   ⚠ لا DOM هنا ولا Shouba: كل ما تحتاجه يمرر اليها — فتعمل في صفحة الزائر
     بلا طبقة الاشتقاق، وتفحص في node (public/_dev/face-data-test.mjs).
   ⚠ والتاريخ نص YYYY-MM-DD بتوقيت الجهاز: الزائر يحسب بساعته هو.

   اعدادات الواجهة في وثيقة الشعبة تحت face (تزامن وتصدر كبقيتها):
     week: { kind, text, who, to, photo }   خانة الاسبوع · to آخر يوم تظهر فيه · photo { file, mime } صورة اختيارية
     show: [معرف]                     الفعاليات المنشورة (من السجل والخاصة) — تتغير بـ«انشر» و«اسحب» وحدهما (2026-10-20)،
                                      فهي ما على الرابط. وما ليس فيها غير منشور — بلا ترحيل لما قبلها (قرار مقصود)
     hide: [معرف سجل]                 (قديم) فعالية من السجل اخفيت — تبقى مخفية ولو كانت في show. السجل لا يمس
     done: [معرف سجل]                 فعالية من السجل اكد رئيس الشعبة اقامتها
     own:  [{ id, title, date, note, created, done }]   فعاليات للواجهة وحدها — منشورة ان كانت في show
     theme: 'amber' | 'navy'          لون الترويسة · العنبري افتراضا
     team: { title, name, headPhoto, photos: { اسم: { file, mime } }, hide: [اسم] }
                                      فريق الشعبة · title لقب رئيس الشعبة (أ. افتراضا) · name اسمه ان لم يكن في الحساب
     plan: false                      «هذا الاسبوع في المنهج» مخفي عن الواجهة · ظاهر افتراضا (2026-10-22)
   =================================================================== */
(function (root) {
  var F = root.ShoubaFace = {};

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function str(v) { return v == null ? '' : String(v).trim(); }
  F.iso = function (dt) { return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()); };
  function parse(iso) {
    var p = String(iso || '').split('-');
    if (p.length !== 3) return null;
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return isNaN(d.getTime()) ? null : d;
  }
  F.addDays = function (iso, n) { var d = parse(iso); if (!d) return ''; d.setDate(d.getDate() + n); return F.iso(d); };
  /* يوم انشاء السجل بتوقيت الجهاز (created ختم UTC — ليل الكويت يقع في امس) */
  F.localDay = function (stamp) {
    if (!stamp) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(stamp)) return stamp;
    var d = new Date(stamp);
    return isNaN(d.getTime()) ? '' : F.iso(d);
  };

  /* التاريخ للعرض: «الخميس 22 أكتوبر» — الرقم يلف بعزل LTR في الشاشة */
  F.MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  F.WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  F.dateParts = function (iso) {
    var d = parse(iso);
    return d ? { wd: F.WEEKDAYS[d.getDay()], day: d.getDate(), month: F.MONTHS[d.getMonth()], year: d.getFullYear() } : null;
  };

  /* ── خانة الاسبوع ──────────────────────────────────────────────
     تظهر حتى سبت اسبوعها الدراسي ثم تختفي وحدها ان لم تحدث. ما كتب من الاحد الى الخميس فلاسبوعه،
     وما كتب الجمعة او السبت فللاسبوع القادم — وإلا انطفأ ما كتب للاسبوع الجديد قبل ان يبدأ */
  F.KINDS = [
    { id: 'teacher', label: 'معلم الأسبوع' },
    { id: 'feat',    label: 'إنجاز الأسبوع' },
    { id: 'quote',   label: 'عبارة تحفيزية' }
  ];
  F.kindLabel = function (id) { var k = F.KINDS.filter(function (x) { return x.id === id; })[0]; return k ? k.label : ''; };
  F.weekEnd = function (today) {
    var d = parse(today);
    if (!d) return '';
    var g = d.getDay();
    return F.addDays(today, g <= 4 ? 6 - g : 13 - g);
  };
  /* مكتملة: معلم الاسبوع باسمه، والنوعان الآخران بنصهما */
  F.weekFilled = function (w) {
    if (!w || !F.kindLabel(w.kind)) return false;
    return w.kind === 'teacher' ? !!str(w.who) : !!str(w.text);
  };
  /* صورة الخانة: لمعلم الاسبوع وانجازه وحدهما، وصورة لا PDF — معرفها في النسخة فيلتقطه face.js فيفتح بابها */
  F.weekPhoto = function (w) {
    var p = w && w.photo;
    return w && w.kind !== 'quote' && p && typeof p.file === 'string' && /^image\//.test(p.mime || '') ? p.file : '';
  };
  F.weekLive = function (w, today) { return F.weekFilled(w) && !!w.to && today <= w.to; };

  /* ── لون الترويسة وفريق الشعبة (2026-10-20، قرار المستخدم) ─────────
     الترويسة عنبرية افتراضا او كحلية — اختياران لا ثالث لهما.
     والفريق: رئيس الشعبة اولا ثم معلموه، الا من اخفاه رئيس الشعبة احتراما لمن لا يريد الظهور.
     ⚠ الصورة اختيارية، ومعرفها وحده في النسخة (صورة لا PDF) — فيلتقطه face.js فيفتح بابها في face_files */
  F.THEMES = ['amber', 'navy'];
  F.theme = function (face) { return face && face.theme === 'navy' ? 'navy' : 'amber'; };
  F.TITLES = ['أ.', 'د.'];
  F.photoOf = function (p) { return p && typeof p.file === 'string' && /^image\//.test(p.mime || '') ? p.file : ''; };
  F.team = function (face, staff, self) {
    var t = (face && face.team) || {}, hide = arr(t.hide), ph = t.photos || {};
    var name = str(self) || str(t.name);
    var head = name ? { name: name, title: F.TITLES.indexOf(t.title) > -1 ? t.title : 'أ.', photo: F.photoOf(t.headPhoto) } : null;
    var people = [];
    arr(staff).forEach(function (n) {
      n = str(n);
      if (!n || n === name || hide.indexOf(n) > -1 || people.some(function (p) { return p.name === n; })) return;
      people.push({ name: n, photo: F.photoOf(ph[n]) });
    });
    return { head: head, people: people };
  };
  /* الحرف الاول للدائرة بلا صورة */
  F.initial = function (name) { var s = str(name); return s ? s.charAt(0) : ''; };

  /* ── الفعاليات ─────────────────────────────────────────────────
     القاعدة: «قادمة» ما لم يمض يومها، و«تمت» ما اقيمت. والتي مضى يومها ولم يؤكد رئيس الشعبة اقامتها
     تختفي حتى يؤكدها — فلا تبقى «قادمة» بعد انقضائها، ولا تعلن «تمت» ولعلها الغيت.
     ⚠ متى يلزم التأكيد؟ للمخطط لها وحدها: ما انشئ قبل يومه. اما ما كتب يومها او بعده فتقرير عن فعالية
       اقيمت — والسجل نفسه شاهد اقامتها — فلا يسأل عنها. */
  F.planned = function (ev) { return !!(ev.created && ev.date && ev.created < ev.date); };
  F.isDone = function (ev) { return !!ev.done || !F.planned(ev); };
  /* 'soon' قادمة · 'done' تمت · 'wait' مضى يومها بلا تأكيد · '' بلا تاريخ */
  F.status = function (ev, today) {
    if (!ev || !ev.date) return '';
    if (ev.date <= today && F.isDone(ev)) return 'done';
    return ev.date >= today ? 'soon' : 'wait';
  };

  /* سطر من سجل الفعاليات: عنوانه وتاريخه ومشاركوه ونبذته وصوره (الصور وحدها — لا PDF) */
  F.fromRec = function (rec, groups) {
    var v = (rec && rec.values) || {}, m = v.meta || {}, g = groups || {};
    return {
      id: rec.id, src: 'rec',
      title: str(m.title), date: str(m.date),
      who: arr(m.who).map(function (x) { return g[x] || x; }).filter(Boolean),
      about: str((v.body || {}).about),
      photos: arr((v.shots || {}).items).filter(function (it) { return it && it.file && /^image\//.test(it.mime || ''); })
        .map(function (it) { return it.file; }),
      created: F.localDay(rec.created)
    };
  };
  function fromOwn(o, show) {
    return { id: o.id, src: 'own', title: str(o.title), date: str(o.date), who: [], about: str(o.note), photos: [],
      created: F.localDay(o.created), done: !!o.done, hidden: show.indexOf(o.id) < 0 };
  }

  /* كل فعاليات الواجهة لشاشة الادارة: من السجل ثم الخاصة — بحالها في اليوم.
     ⚠ فعالية السجل لا تظهر الا باختيار: hidden ما لم تكن في show (او كانت في hide القديمة)، والخاصة كذلك ما لم تكن في show.
     ⚠ والناقصة (بلا عنوان او تاريخ) لا تسقط بصمت: تعود ومعها missing ['title'|'date'] لتكمل في السجل،
       وتبقى hidden ابدا — لا تضاف للواجهة حتى تكمل. */
  F.events = function (face, recs, today, groups) {
    face = face || {};
    var show = arr(face.show), hide = arr(face.hide), done = arr(face.done), out = [];
    arr(recs).forEach(function (r) {
      var e = F.fromRec(r, groups), miss = [];
      if (!e.title) miss.push('title');
      if (!e.date) miss.push('date');
      e.done = done.indexOf(r.id) > -1;
      if (miss.length) e.missing = miss;
      e.hidden = !!miss.length || show.indexOf(r.id) < 0 || hide.indexOf(r.id) > -1;
      out.push(e);
    });
    arr(face.own).forEach(function (o) {
      var e = fromOwn(o, show);
      if (e.title && e.date) out.push(e);
    });
    out.forEach(function (e) { e.status = F.status(e, today); });
    return out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  };

  /* ── التحديد والنشر والسحب (2026-10-20، طلب المستخدم: «مربع اختيار لكل فعالية، وزرا انشر واسحب ينفذان») ──
     «منشورة» ما في آخر نسخة نشرت — تطابق بمعرفها ومصدرها (تحملهما النسخة منذ 2026-10-20)، فما عدل عنوانه او تاريخه
     بعد نشره يبقى منشورا. والنسخة الاقدم بلا معرفات: تطابق بالعنوان والتاريخ.
     ⚠ والاساس ما على الرابط فعلا لا show المحفوظة: show القديمة (بناء ٩٧) فيها ما «اضيف» ولم ينشر */
  F.pubOf = function (e, snap) {
    if (!e || !snap) return null;
    return arr(snap.events).filter(function (p) {
      return p && (p.id ? p.id === e.id && (!p.src || p.src === e.src) : p.title === e.title && p.date === e.date);
    })[0] || null;
  };
  F.isPub = function (e, snap) { return !!F.pubOf(e, snap); };
  /* الفعالية كما تدخل النسخة — وبها يعرف ان المنشورة عدلت بعد نشرها */
  F.pubEvent = function (e) {
    return { id: e.id, src: e.src, title: e.title, date: e.date, who: e.who, about: e.about, photos: e.photos, done: F.isDone(e) };
  };
  F.stale = function (e, snap) {
    var p = F.pubOf(e, snap);
    if (!p) return false;
    var q = F.pubEvent(e);
    return ['title', 'date', 'who', 'about', 'photos', 'done'].some(function (k) { return JSON.stringify(p[k]) !== JSON.stringify(q[k]); });
  };
  /* المعرفات المنشورة بعد الفعل: add انشر (المنشور ∪ المحدد) · وإلا اسحب (المنشور − المحدد). الناقصة لا تدخل ابدا */
  F.nextShown = function (list, snap, sel, add) {
    var ok = arr(list).filter(function (e) { return !e.missing; });
    var on = ok.filter(function (e) { return F.isPub(e, snap); }).map(function (e) { return e.id; });
    sel = arr(sel).filter(function (id) { return ok.some(function (e) { return e.id === id; }); });
    if (add) sel.forEach(function (id) { if (on.indexOf(id) < 0) on.push(id); });
    else on = on.filter(function (id) { return sel.indexOf(id) < 0; });
    return on;
  };
  /* اعدادات الواجهة بعد الفعل (نسخة لا تمس الاصل): show المنشورة كلها، وhide القديمة ترفع عما نشر — والا بقي مخفيا */
  F.setShown = function (face, ids) {
    var f = JSON.parse(JSON.stringify(face || {}));
    f.show = arr(ids).slice();
    if (f.hide) f.hide = arr(f.hide).filter(function (id) { return f.show.indexOf(id) < 0; });
    return f;
  };

  /* ── الجدول الحي بساعة الزائر ───────────────────────────────────
     times: اوقات الجرس كما في المرجعية ({ n, from, to } للحصة و{ brk, label } للفرصة).
     يعيد { day, state, n, left, label, next } — state: off عطلة · before قبل الدوام · period حصة · break فرصة
     · gap بين حصتين · after بعد الدوام */
  function mins(hm) { var p = String(hm || '').split(':'); return p.length === 2 ? (+p[0]) * 60 + (+p[1]) : NaN; }
  F.now = function (times, days, at) {
    var g = at.getDay(), m = at.getHours() * 60 + at.getMinutes(), list = arr(times);
    var out = { day: g <= 4 ? (arr(days)[g] || '') : '', state: 'off' };
    if (g > 4 || !out.day || !list.length) return out;
    function nextAfter(i) { for (var k = i; k < list.length; k++) if (!list[k].brk) return list[k].n; return null; }
    if (m < mins(list[0].from)) { out.state = 'before'; out.next = nextAfter(0); out.from = list[0].from; return out; }
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      if (m < mins(t.from)) { out.state = 'gap'; out.next = nextAfter(i); return out; }
      if (m < mins(t.to)) {
        out.left = mins(t.to) - m;
        if (t.brk) { out.state = 'break'; out.label = t.label || ''; out.next = nextAfter(i + 1); }
        else { out.state = 'period'; out.n = t.n; }
        return out;
      }
    }
    out.state = 'after';
    return out;
  };

  /* المادة الغالبة على جدول المعلم — لسطره في «من يعمل الآن» */
  F.mainSubject = function (wk) {
    var c = {}, best = '', n = 0;
    Object.keys(wk || {}).forEach(function (day) {
      arr(wk[day]).forEach(function (v) {
        var s = str(String(v || '').split('·')[1]);
        if (!s) return;
        c[s] = (c[s] || 0) + 1;
        if (c[s] > n) { n = c[s]; best = s; }
      });
    });
    return best;
  };
  F.slot = function (v) {
    var p = String(v || '').split('·');
    return { cls: str(p[0]), subject: str(p[1]) };
  };

  /* ── هذا الاسبوع في المنهج (2026-10-22، قرار المستخدم) ──────────────
     ما في خطط التوجيه المعتمدة لكل مادة وصف تدرسه الشعبة — كشريط الخطة في اللوحة، لكن المجدول وحده:
     ⚠ لا شيء يكشف عملا لم ينجز او تأخر: لا نسبة ولا «يجب رفع الخطة» ولا «اختر خطته» (المادة بلا خطة لا تذكر)،
       ولا مقارنة بما قطع. النسخة ثابتة والاسابيع تتبدل: فتحمل اسابيع الفصل كلها بتواريخها، ويختار الزائر اسبوعه بساعته.
     planPack(calendar, pairs, lessonsOf): pairs من Shouba.planLinks().pairs · lessonsOf = Shouba.planLessons —
     يعيد { weeks:[{ n, from, to }], rows:[{ name, grade, w:{ n:[{ t, p }] } }] } او null ان لم يبق شيء */
  F.planPack = function (calendar, pairs, lessonsOf) {
    var cal = arr(calendar).filter(function (w) { return w && w.n > 0 && w.from && w.to; }), used = {}, seen = {}, rows = [];
    arr(pairs).forEach(function (p) {
      if (!p || !p.plan) return;
      var name = str(p.spec || p.subject), k = name + '|' + str(p.grade), w = {}, any = false;
      if (!name || seen[k]) return;
      cal.forEach(function (c) {
        var ls = arr(lessonsOf(p.plan, c.n)).map(function (l) { return { t: str(l.t), p: +l.p || 0 }; }).filter(function (l) { return l.t; });
        if (ls.length) { w[c.n] = ls; used[c.n] = any = true; }
      });
      if (!any) return;
      seen[k] = true;
      rows.push({ name: name, grade: str(p.grade), w: w });
    });
    var weeks = cal.filter(function (c) { return used[c.n]; }).map(function (c) { return { n: c.n, from: c.from, to: c.to }; });
    return rows.length ? { weeks: weeks, rows: rows } : null;
  };
  /* عنوان الدرس للعرض (2026-10-22، معاينة السلوك): علامات المصدر من نص الخطة — ولا يمس ملف الخطط ولا اللوحة.
     لكل مقطع (المقاطع بـ « · »): تحذف النجمة والنقطة في اوله وآخره، ورقم الترقيم في اوله «4-» «4 -» «4)» «4.» يصير «4. »
     (ورقم يليه رقم كـ«2-1» «6-2)» ترقيم درس فيبقى)، والقوس المقلوب حول رقم وحده «)3-2(» يعدل «(3-2)»، والمسافات تضم.
     والنجمة الوحيدة داخل المقطع بما حولها من شرط ومسافات «محمد -*- المثل» فاصل يصير « — » (والشرطة بين رقمين كـ«2-1» لا تمس).
     وما سوى ذلك من تشوه النسخ يبقى كما هو. والمقطع الفارغ بعدها يسقط */
  var MARK = '*•●▪◦○■□►✓';
  function cleanSeg(s) {
    s = str(s).replace(/\s+/g, ' ');
    s = s.replace(new RegExp('^[' + MARK + '\\s]+|[' + MARK + '\\s]+$', 'g'), '');
    s = s.replace(/[\s\-–]*\*+[\s\-–]*/g, function (m) { return /\*\*/.test(m) ? m : ' — '; });
    s = s.replace(/^([0-9٠-٩]+)\s*[-–).]\s*(?=[^0-9٠-٩\s\-–).])/, '$1. ');
    s = s.replace(/\)\s*([0-9٠-٩]+(?:\s*[-–]\s*[0-9٠-٩]+)*)\s*\(/g, function (m, d, i) { return (i && !/\s/.test(s[i - 1]) ? ' ' : '') + '(' + d + ')'; });
    return s;
  }
  F.planTitle = function (t) { return str(t).split(' · ').map(cleanSeg).filter(Boolean).join(' · '); };
  /* اسبوع الزائر: من احده الى سبته (الجمعة والسبت للاسبوع الذي مضى، كاللوحة). وقبل الفصل وبعده وفي عطلة ليست في
     التقويم: لا اسبوع — فيختفي القسم كله بلا نص. ويعيد { n, from, to, rows:[{ name, grade, lessons, per }] } */
  F.planNow = function (plan, today) {
    if (!plan || !today) return null;
    var wk = arr(plan.weeks).filter(function (w) { return w && w.from <= today && today <= F.addDays(w.to, 2); })[0];
    if (!wk) return null;
    var rows = arr(plan.rows).map(function (r) {
      var ls = arr((r.w || {})[wk.n]).map(function (l) { return { t: F.planTitle(l.t), p: +l.p || 0 }; }).filter(function (l) { return l.t; });
      return { name: r.name, grade: r.grade, lessons: ls, per: ls.reduce(function (a, l) { return a + (+l.p || 0); }, 0) };
    }).filter(function (r) { return r.lessons.length; });
    return rows.length ? { n: wk.n, from: wk.from, to: wk.to, rows: rows } : null;
  };

  /* ── النسخة المنشورة ───────────────────────────────────────────
     تبنى في جهاز رئيس الشعبة من وثيقته وترسل كما هي (face.js لا يعرف شكلها).
     ⚠ ما لا يظهر لا يرسل: فعالية سجل لم تختر للواجهة او ناقصة او بانتظار التأكيد لا تدخل النسخة، والجدول لمن له جدول وحده.
     in: { doc, self, roster, staff (معلمو الشعبة للفريق — roster ان غاب), times, days, today, groups, recs (سجلات الفعاليات), meetings (عدد اجتماعات العام),
           plan (من planPack — يسقط ان اخفاه رئيس الشعبة: face.plan === false) } */
  F.snapshot = function (inp) {
    var d = inp.doc || {}, face = d.face || {}, sch = d.schedules || {}, periods = arr(inp.times).filter(function (t) { return !t.brk; }).length;
    var people = [];
    arr(inp.roster).forEach(function (name) {
      var t = sch[name], wk = {}, any = false;
      if (!t) return;
      arr(inp.days).forEach(function (day) {
        var a = arr(t[day]).slice(0, periods).map(function (v) { return str(v); });
        while (a.length < periods) a.push('');
        if (a.some(Boolean)) any = true;
        wk[day] = a;
      });
      if (any) people.push({ name: name, subj: F.mainSubject(wk), wk: wk });
    });
    var w = F.weekFilled(face.week) ? face.week : null;
    var events = F.events(face, inp.recs, inp.today, inp.groups)
      .filter(function (e) { return !e.hidden && !e.missing && (e.status === 'soon' || e.status === 'done'); })
      .map(F.pubEvent);
    /* الشعار صورة (data:image) او معرف رمز من icons.js — لا SVG نصا يحقن في صفحة عامة */
    var c = d.crest || {}, crest = c.type === 'image' && /^data:image\//.test(c.data || '') ? { img: c.data }
      : c.type === 'icon' && c.id ? { icon: String(c.id) } : null;
    var team = F.team(face, inp.staff || inp.roster, inp.self);
    return {
      v: 1,
      dept: str(d.department), school: str(d.schoolName), head: team.head ? team.head.name : '',
      theme: F.theme(face), team: team,
      year: str(d.year), term: str(d.term), crest: crest,
      days: arr(inp.days), times: arr(inp.times),
      people: people,
      week: w ? { kind: w.kind, text: str(w.text), who: str(w.who), to: w.to, photo: F.weekPhoto(w) } : null,
      events: events,
      plan: face.plan !== false && inp.plan && arr(inp.plan.rows).length ? inp.plan : null,
      stats: { meetings: +inp.meetings || 0 }
    };
  };

  /* ما يراه الزائر اليوم من النسخة: الخانة ان بقي اسبوعها، والفعاليات قسمين — القادمة بالاقرب، وما تم بالاحدث */
  F.visible = function (snap, today) {
    snap = snap || {};
    var soon = [], done = [];
    arr(snap.events).forEach(function (e) {
      if (!e || !e.date) return;
      if (e.done && e.date <= today) done.push(e);
      else if (e.date >= today) soon.push(e);           /* مضى يومها ولم تؤكد: لا تظهر */
    });
    soon.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    done.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    return { week: F.weekLive(snap.week, today) ? snap.week : null, soon: soon, done: done };
  };
})(typeof window !== 'undefined' ? window : this);
