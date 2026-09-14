/* ===================================================================
   شعبة · رسم الورق الرسمي — الترويسة المشتركة (2026-09-12)
   ────────────────────────────────────────────────────────────────
   طبقة مستقلة تطبق على كل مطبوع ولا يغيرها قالب (مبدأ ٥ في امر المرحلة الاولى).
   اسطرها الثلاثة: وزارة التربية · اسم التوجيه (Shouba.directorate) · اسم المدرسة —
   من الاعداد نفسه، لا حقل جديد. وشعار المطبوعات مستقل عن شعار الواجهة
   (قرار المستخدم: رمز الواجهة للواجهة وحدها)، ويمكن ان يستعار منه بضغطة.
   يعتمد على derive.js (Shouba). والانماط في rec-print.css.
   =================================================================== */
(function () {
  var P = window.ShoubaPrint = {};

  /* خطوط الورق — كلها مفتوحة الترخيص (OFL) تسمح بالاستعمال التجاري.
     ⚠ «بلكس» المعتمد (قرار المستخدم 2026-09-12): اقرب الى خط نماذج التوجيه، واوضح عند التصغير
       الى ١٠ نقاط. وهو الاول فهو الافتراضي؛ والآخران للعينة وحدها (_dev/print-sample.html) */
  P.FONTS = [
    { id: 'plex',  name: 'بلكس',     family: '"IBM Plex Sans Arabic", sans-serif' },
    { id: 'naskh', name: 'نوتو نسخ', family: '"Noto Naskh Arabic", serif' },
    { id: 'amiri', name: 'أميري',    family: '"Amiri", serif' }
  ];
  P.font = function (id) { return P.FONTS.filter(function (f) { return f.id === id; })[0] || P.FONTS[0]; };

  /* شعار المطبوعات: printLogoSrc = 'none' (بلا شعار) · 'crest' (شعار الواجهة ان كان صورة)
     · 'upload' (صورة رفعت للمطبوعات في printLogoImg). والمرفوع يبقى محفوظا ان اختير غيره ثم عاد اليه.
     ولم يختر بعد ⟵ الشعار الموجود افتراضا (P.logoSrc — 2026-09-13؛ كان «بلا شعار» افتراضا).
     ورمز الواجهة المرسوم (icon) ليس شعار مدرسة فلا يستعار. */
  P.canCrest = function (d) { return !!(d.crest && d.crest.type === 'image' && d.crest.data); };
  /* المصدر الفعلي (2026-09-13، طلب المستخدم: شعار المدرسة افتراضي): ما اختاره صاحبه في اعدادات المطبوعات، والا —
     لم يختر بعد — المرفوع للمطبوعات ثم شعار الواجهة ان كان صورة، والا بلا شعار. و«بلا شعار» اختيار صريح يبقى */
  P.logoSrc = function (d) { return d.printLogoSrc || (d.printLogoImg ? 'upload' : P.canCrest(d) ? 'crest' : 'none'); };
  P.logoOf = function (d) {
    var src = P.logoSrc(d);
    if (src === 'crest') return P.canCrest(d) ? d.crest.data : '';
    if (src === 'upload') return d.printLogoImg || '';
    return '';
  };
  /* noLogo: صاحب السجل اخفى الشعار لهذا النوع من شاشة المعاينة (رقاقة «شعار المدرسة» — ctx.noLogo) */
  P.headerData = function (title, noLogo) {
    var S = window.Shouba, d = S.data();
    return { title: title || '', ministry: 'وزارة التربية', directorate: S.directorate(), school: d.schoolName || '', logo: noLogo ? '' : P.logoOf(d) };
  };

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  /* الترويسة: الاسطر الفارغة لا ترسم (مدرسة بلا اسم بعد) ولا تترك سطرا فارغا */
  P.header = function (h) {
    var head = el('div', 'pp-head'), id = el('div', 'pp-id');
    if (h.logo) {
      var box = el('div', 'pp-logo'), img = el('img');
      img.src = h.logo; img.alt = '';
      box.appendChild(img); id.appendChild(box);
    }
    var lines = el('div', 'pp-lines');
    [h.ministry, h.directorate, h.school].forEach(function (t) { if (t) lines.appendChild(el('div', null, t)); });
    id.appendChild(lines);
    head.appendChild(id);
    head.appendChild(el('div', 'pp-title', h.title));
    head.appendChild(el('div'));
    return head;
  };
  P.sheet = function (orient, fontId) {
    var s = el('div', 'pp-sheet' + (orient === 'landscape' ? ' landscape' : ''));
    s.style.setProperty('--paper-font', P.font(fontId).family);
    return s;
  };

  /* ── اللبنات على الورق (2026-09-12) — مولد واحد لكل لبنة، ومن التعريف نفسه ─────
     الورق بالارقام الهندية كنماذج التوجيه، والتاريخ «١٧ / ٩ / ٢٠٢٦م» (اليوم يمينا).
     ما لم يكتب لا يطبع عنوانه (قسم فارغ لا يترك سطرا يتيما). */
  var AR = '٠١٢٣٤٥٦٧٨٩';
  P.ar = function (s) { return String(s == null ? '' : s).replace(/\d/g, function (d) { return AR[d]; }); };
  P.date = function (iso) { var p = String(iso || '').split('-'); return p.length === 3 ? P.ar((+p[2]) + ' / ' + (+p[1]) + ' / ' + p[0]) + 'م' : ''; };
  P.day = function (iso) { var p = String(iso || '').split('-'); return p.length === 3 ? P.ar((+p[2]) + ' / ' + (+p[1])) : ''; };
  var HEAD = 'رئيس الشعبة', ALL = 'جميع المعلمين';
  function who(n) { return !n ? '' : (n === HEAD || n === ALL) ? n : 'أ. ' + n; }
  function ol(items, fill) {
    var o = el('ol');
    items.forEach(function (it) { var li = el('li'); fill(li, it); o.appendChild(li); });
    return o;
  }
  function sec(title) { var d = el('div', 'pp-sec'); d.appendChild(el('div', 't', title + ':')); return d; }

  var PB = {}, PS = {};
  /* ① خانات البيانات: العناوين يمينا والقيم يسارا، باطار — كاعلى نموذج الاجتماعات */
  PB.fields = function (b, v) {
    /* سطر واحد تحت الترويسة (inline — شبكتا المتابعة): «اسم المعلم: … · الفصل الدراسي: … · العام الدراسي: …» —
       الجدول العريض يحتاج الصفحة كلها، والخانات الثلاث لا تستحق جدولا */
    if (b.inline) {
      var line = el('div', 'pp-inline');
      b.fields.forEach(function (f) {
        var x = v[f.id];
        if (x === '' || x == null) return;
        var s = el('span');
        s.appendChild(el('b', null, f.label + ': '));
        s.appendChild(document.createTextNode(f.kind === 'teacher' ? P.whoLabel(x) : f.kind === 'date' ? P.date(x) : P.ar(x)));
        line.appendChild(s);
      });
      return line.children.length ? line : null;
    }
    /* pairs:2 — حقلان في كل سطر كنموذجه (بطاقة متابعة معلم ص٥: عشر خانات في عمودين) فتتسع الورقة صفحة واحدة */
    var two = b.pairs === 2, t = el('table', 'pp-fields' + (two ? ' two' : '')), tr = null;
    b.fields.forEach(function (f, i) {
      var td = el('td'), x = v[f.id];
      if (!two || i % 2 === 0) { tr = el('tr'); t.appendChild(tr); }
      tr.appendChild(el('th', null, f.label));
      if (f.kind === 'date' && x) {
        if (f.show === 'weekday+date') { td.appendChild(el('span', null, window.ShoubaRec.weekday(x))); td.appendChild(el('span', 'gap')); }
        td.appendChild(el('span', null, P.date(x)));
      } else td.textContent = P.ar(x == null ? '' : x);
      tr.appendChild(td);
    });
    if (two && b.fields.length % 2) { tr.appendChild(el('th')); tr.appendChild(el('td')); }   /* السطر الاخير بخانتيه */
    return t;
  };
  /* ② مساحة النص: العبارة الافتتاحية ثم الاقسام. وبلا عبارة ولا قسم مكتوب لا شيء يطبع (غايات محور فارغة).
     ⚠ لا اسطر منقطة (قرار المستخدم 2026-09-13: «احذف الاسطر تماما») — كانت تملأ ما بقي من الصفحة (fill:'dotted' في
     قالب الاجتماعات يبقى في تعريفه المنشور ولا يرسم) */
  PB.text = function (b, v, ctx) {
    var box = el('div', 'pp-text');
    if (b.lead) box.appendChild(el('div', 'pp-lead', b.lead));
    b.sections.forEach(function (s) { var n = PS[s.kind] && PS[s.kind](s, v, ctx); if (n) box.appendChild(n); });
    return box.children.length ? box : null;
  };
  PS.paragraph = function (s, v) {
    var t = String(v[s.id] || '').trim();
    if (!t) return null;
    var d = s.title ? sec(s.title) : el('div', 'pp-sec');
    d.appendChild(el('div', 'pp-para', t));
    return d;
  };
  PS.list = function (s, v) {
    var arr = (v[s.id] || []).filter(function (it) { return it && (String(it.title || '').trim() || String(it.details || '').trim()); });
    if (!arr.length) return null;
    var d = sec(s.title);
    d.appendChild(ol(arr, function (li, it) {
      var ti = String(it.title || '').trim(), de = String(it.details || '').trim();
      if (ti) li.appendChild(el('b', null, ti + (de ? ': ' : '')));
      if (de) li.appendChild(document.createTextNode(de));
    }));
    return d;
  };
  PS['smart:followup'] = function (s, v, ctx) {
    var open = ctx.open || [], marks = v[s.id] || {};
    if (!open.length) return null;
    var d = sec(s.title);
    d.appendChild(ol(open, function (li, it) {
      li.appendChild(document.createTextNode(it.text));
      if (marks[it.id]) li.appendChild(el('span', 'pp-status', marks[it.id] === 'done' ? 'نفذ' : 'مستمر'));
    }));
    return d;
  };
  PS['smart:decisions'] = function (s, v) {
    var arr = (v[s.id] || []).filter(function (x) { return x && String(x.text || '').trim(); });
    if (!arr.length) return null;
    var d = sec(s.title);
    d.appendChild(ol(arr, function (li, x) {
      li.appendChild(document.createTextNode(String(x.text).trim().replace(/[.،]+$/, '') + '.'));
      var meta = [x.owner && ('المسؤول: ' + who(x.owner)), x.due && ('الموعد: ' + P.day(x.due))].filter(Boolean);
      if (meta.length) li.appendChild(el('span', 'pp-meta', ' (' + meta.join(' — ') + ')'));
    }));
    return d;
  };
  /* ③ الجدول على الورق (المرحلة الثانية أ): جدول بإطار — عمود «م» للترقيم، ومجموعات اعمدة (صف رأس ثان)،
     وعناوين رأسية (vertical)، وصفوف فارغة حتى rows.min لما يكتب باليد. والامتداد لصفحات في P.pages. */
  function REF() { return window.SHOUBA_REF || {}; }
  P.whoLabel = function (x) {
    var g = (REF().whoGroups || []).filter(function (o) { return o.id === x; })[0];
    return g ? g.t : (x ? 'أ. ' + x : '');
  };
  /* المتابعة في تقرير التنفيذ: الحالة ثم الملاحظة، وعدد الشواهد ان وجدت — وما لم يؤشر «لم يؤشر» */
  var STL = { done: 'نفذ', doing: 'جار', later: 'مؤجل', no: 'لم ينفذ' };
  P.followLabel = function (x) {
    x = x || {};
    var n = (x.ev || []).length, S = window.Shouba;
    return (STL[x.st] || 'لم يؤشر') + (x.note ? ' — ' + x.note : '')
      + (n ? ' (' + P.ar(S && S.count ? S.count(n, { one: 'شاهد', two: 'شاهدان', few: 'شواهد', many: 'شاهدا' }) : n) + ')' : '');
  };
  P.monthsLabel = function (v) {
    if (!v || typeof v !== 'object') return '';
    var s = v.all ? 'طوال الفصل' : (v.m || []).map(function (n) { return (REF().months || [])[n - 1]; }).filter(Boolean).join('، ');
    return s + (v.note ? (s ? ' — ' : '') + v.note : '');
  };
  function cellText(c, x, ctx) {
    switch (c.kind) {
      /* في خانة الجدول اليوم والشهر وحدهما (مراجعة الطباعة 2026-09-14): التاريخ الكامل انكسر سطرين في عمود «تاريخ
         المتابعة» الضيق، والعام مكتوب في رأس الكشف. وخانة البيانات (رقم الاجتماع وتاريخه) تبقى بتاريخها الكامل */
      case 'date':
        /* «اليوم والتاريخ» في خانة واحدة (show:'weekday+date' — انجازات المعلم ص١٥) */
        return c.show === 'weekday+date' && x && window.ShoubaRec ? window.ShoubaRec.weekday(x) + ' ' + P.day(x) : P.day(x);
      /* عمود مشتق من عمود آخر في صفه (of) — «اليوم» من «التاريخ» في الملاحظات التربوية (ص٨) */
      case 'auto': return c.show === 'weekday' && x && window.ShoubaRec ? window.ShoubaRec.weekday(x) : '';
      case 'number': case 'class': return P.ar(x == null ? '' : x);
      case 'check': return x ? '✓' : '';
      case 'pick': return x === c.opt ? '✓' : '';   /* خيار من اختيار مقسم (split) */
      case 'teacher': return Array.isArray(x) ? x.map(P.whoLabel).join('، ') : P.whoLabel(x);
      case 'months': return P.monthsLabel(x);
      case 'signature': return '';
      case 'followup': return ctx && ctx.print && ctx.print.follow ? P.followLabel(x) : '';   /* فارغ في «الخطة» */
      default: return String(x == null ? '' : x);
    }
  }
  var COLW = { date: 26, number: 16, 'class': 14, check: 11, signature: 28, teacher: 44, months: 42, choice: 30, followup: 42, pick: 15 };   /* بالمليمتر */
  /* صفوف الجدول في اشهرها (rowGroups.from 'months' — نموذج ما قطع ص١٤): اشهر النموذج التي في فصل السجل
     (refdata.termMonths)، ومعها كل شهر فيه صف وان لم يكن في النموذج (يناير في الاول) — بترتيب العام الدراسي
     من سبتمبر، والصف بلا تاريخ في آخرها بلا شهر. يعيد [{ m, rows }] والصفوف بتاريخها */
  function monthGroups(rg, rows, cols, ctx) {
    var dc = cols.filter(function (c) { return c.kind === 'date'; })[0], term = (ctx && ctx.rec && ctx.rec.term) || '';
    var tm = (REF().termMonths || {})[term] || [], form = rg.months || [], by = {};
    var list = tm.length ? form.filter(function (m) { return tm.indexOf(m) > -1; }) : form.slice();
    rows.forEach(function (r) {
      var m = dc ? +(String(r[dc.id] || '').split('-')[1]) || 0 : 0;
      (by[m] = by[m] || []).push(r);
      if (list.indexOf(m) < 0) list.push(m);
    });
    function aca(m) { return m ? (m + 3) % 12 : 99; }      /* سبتمبر ٠ … أغسطس ١١ */
    return list.sort(function (a, b) { return aca(a) - aca(b); }).map(function (m) {
      return { m: m, rows: (by[m] || []).slice().sort(function (a, b) { return String(a[dc.id] || '').localeCompare(String(b[dc.id] || '')); }) };
    });
  }
  PB.table = function (b, v, ctx) {
    /* الشبكة: الاعمدة المختارة وحدها، والمجموعة التي لم يختر منها شيء تسقط من الرأس تلقائيا. وحين
       يقل المختار تتسع اعمدة ✓ لما بقي من العرض (بلا عرض ثابت)، ويبقى للتاريخ والتوقيع عرضهما */
    var all = b.columns || [], cols = (window.Shouba && Shouba.colsOf) ? Shouba.colsOf(ctx && ctx.rec, b, ctx && ctx.tpl && ctx.tpl.id) : all;
    var fewer = b.choose && cols.length < all.length;
    /* الرأس الرأسي للاعمدة الضيقة وحدها: فاذا قل المختار (١٢ فما دون) اتسعت الاعمدة فكتب الرأس افقيا يقرأ بلا ميل الرأس */
    var upright = fewer && cols.filter(function (c) { return c.kind === 'check'; }).length <= 12;
    var rows = Array.isArray(v) ? v : [], groups = {}, num = b.numbered !== false;
    (b.groups || []).forEach(function (g) { groups[g.id] = g; });
    /* الاختيار المقسم (split — «ما قطع من المقرر»): عمود لكل خيار تحت رأس الاختيار، والعلامة في المختار —
       كنموذج التوجيه (متقدم · مطابق · متأخر). وسائر الاعمدة كما هي */
    var src = cols; cols = [];
    src.forEach(function (c) {
      if (c.kind !== 'choice' || !c.split) return cols.push(c);
      groups['$' + c.id] = { id: '$' + c.id, label: c.label };
      (c.options || []).forEach(function (o) { cols.push({ id: c.id, label: o, kind: 'pick', opt: o, group: '$' + c.id, w: c.w }); });
    });
    var rg = b.rowGroups && b.rowGroups.from === 'months' ? b.rowGroups : null;
    var t = el('table', 'pp-tbl' + (b.dense ? ' dense' : '') + (rg ? ' rg' : '')), cg = el('colgroup'), th = el('thead'), r1 = el('tr');   /* dense: الشبكات العريضة */
    var grouped = cols.some(function (c) { return c.group; }), r2 = grouped ? el('tr') : null;
    if (b.title) t.appendChild(el('caption', null, b.title));
    function col(w) { var c = el('col'); if (w) c.style.width = w + 'mm'; return c; }
    function head(c, span2) {
      var v = c.vertical && !upright, h = el('th', v ? 'v' : null);
      if (v) h.appendChild(el('span', null, c.label)); else h.textContent = c.label;
      if (span2) h.rowSpan = 2;
      return h;
    }
    if (rg) { cg.appendChild(col(18)); var hmo = el('th', 'mo', rg.label || 'الشهر'); if (grouped) hmo.rowSpan = 2; r1.appendChild(hmo); }   /* الشهر يمينا كالنموذج */
    if (num) { cg.appendChild(col(8)); var hm = el('th', 'm', 'م'); if (grouped) hm.rowSpan = 2; r1.appendChild(hm); }
    cols.forEach(function (c) { cg.appendChild(col(fewer && c.kind === 'check' ? 0 : (c.w || COLW[c.kind]))); });
    for (var i = 0; i < cols.length;) {
      var c = cols[i];
      if (!c.group) { r1.appendChild(head(c, grouped)); i++; continue; }
      var gid = c.group, span = 0;
      while (i < cols.length && cols[i].group === gid) { r2.appendChild(head(cols[i])); span++; i++; }
      var gh = el('th', 'g', (groups[gid] || {}).label || '');
      gh.colSpan = span;
      r1.appendChild(gh);
    }
    th.appendChild(r1);
    if (r2) th.appendChild(r2);
    t.appendChild(cg); t.appendChild(th);
    var tb = el('tbody');
    function line(row, k, lead) {
      var tr = el('tr', row ? null : 'blank');
      if (lead) tr.appendChild(lead);
      if (num) tr.appendChild(el('td', 'm', P.ar(k + 1)));
      cols.forEach(function (c) {
        tr.appendChild(el('td', c.kind === 'check' || c.kind === 'pick' ? 'ck' : c.kind === 'signature' ? 'sig' : null,
          row ? cellText(c, c.kind === 'auto' && c.of ? row[c.of] : row[c.id], ctx) : ''));
      });
      tb.appendChild(tr);
    }
    if (rg) {
      /* لكل شهر صفوفه او per صفوف فارغة، وخانة الشهر تمتد عليها */
      var k = 0;
      monthGroups(rg, rows, cols, ctx).forEach(function (g) {
        var n = Math.max(g.rows.length, rg.per || 1);
        for (var j = 0; j < n; j++) {
          var lead = null;
          if (!j) { lead = el('td', 'mo', g.m ? (REF().months || [])[g.m - 1] || '' : ''); lead.rowSpan = n; }
          line(g.rows[j], k++, lead);
        }
      });
    } else {
      for (var i2 = 0, n2 = Math.max(rows.length, (b.rows && b.rows.min) || 0); i2 < n2; i2++) line(rows[i2], i2, null);
      /* سطر المجموع (b.total — بطاقة متابعة معلم ص٥): مجموع كل عمود مذكور، و«المجموع» في اول خانة سواه */
      if ((b.total || []).length && rows.length) {
        var tt = el('tr', 'tot'), labd = false;
        if (num) tt.appendChild(el('td', 'm', ''));
        cols.forEach(function (c) {
          if (b.total.indexOf(c.id) > -1) {
            var s = 0;
            rows.forEach(function (r) { var n = parseFloat(String(r[c.id] == null ? '' : r[c.id]).replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 0x660; })); if (!isNaN(n)) s += n; });
            tt.appendChild(el('td', null, P.ar(s)));
          } else { tt.appendChild(el('td', null, labd ? '' : (b.totalLabel || 'المجموع'))); labd = true; }
        });
        tb.appendChild(tt);
      }
    }
    t.appendChild(tb);
    return t;
  };

  /* ⑥ المرفقات على الورق: قائمة بأسمائها فقط (قرار المستخدم 2026-09-11، خيار أ) — وتطبع هي منفصلة */
  PB.files = function (b, v) {
    var items = (v.items || []).filter(function (it) { return it && it.file; });
    if (!items.length) return null;
    var d = sec(b.title || 'المرفقات');
    d.classList.add('pp-files');
    d.appendChild(ol(items, function (li, it) {
      li.textContent = String(it.name || '').trim() || (it.mime === 'application/pdf' ? 'ملف PDF' : 'صورة');
    }));
    return d;
  };
  /* ⑦ الحضور: مجموعتان متجاورتان (م · اسم الحضور · التوقيع)، اليمنى تملأ اولا، وصفوفهما بعدد الحضور (2026-09-13).
     الحاضرون وحدهم (presentOnly)، وخانات التوقيع فارغة لليد، وبلا اسماء صفوف فارغة (print.rows) تكتب باليد */
  /* الغلاف (mode: 'cover' — الخطة التشغيلية): اسم السجل كبيرا، ثم الشعبة والفصل والعام، وخانات توقيع
     للادوار باسماء من الاعداد (رئيس الشعبة: صاحب الحساب · مدير المدرسة: ش④). وفي الامتداد يأخذ صفحته وحده */
  function autoField(tpl, rec, auto) {
    var out = '';
    ((tpl && tpl.blocks) || []).forEach(function (b) {
      if (b.type !== 'fields' || out) return;
      (b.fields || []).forEach(function (f) { if (!out && f.auto === auto) out = ((rec.values || {})[b.id] || {})[f.id] || ''; });
    });
    return out;
  }
  function cover(b, ctx) {
    var S = window.Shouba, d = S.data(), tpl = ctx.tpl || {}, rec = ctx.rec || {};
    var year = autoField(tpl, rec, 'year') || rec.year || '', term = autoField(tpl, rec, 'term') || rec.term || '';
    var n = el('div', 'pp-cover'), signs = el('div', 'pp-signs');
    n.appendChild(el('div', 'pp-cover-t', (window.ShoubaRec && ShoubaRec.summary(rec).title) || tpl.title || ''));
    if (d.department) n.appendChild(el('div', 'pp-cover-s', 'شعبة ' + d.department));
    var when = [term, year ? 'العام الدراسي ' + year : ''].filter(Boolean).join(' · ');
    if (when) n.appendChild(el('div', 'pp-cover-s', P.ar(when)));
    (b.roles || []).forEach(function (r) {
      var nm = r.from === 'head' ? ((S.user && S.user().name) ? 'أ. ' + S.user().name : '')
             : r.from === 'principal' ? (d.principal || '') : r.from === 'supervisor' ? (d.supervisor || '') : '';
      var s = el('div', 'pp-sign');
      s.appendChild(el('div', 'r', r.label));
      s.appendChild(el('div', 'nm', nm || '.......................................'));
      s.appendChild(el('div', 's', 'التوقيع: ..........................'));
      signs.appendChild(s);
    });
    if (signs.children.length) n.appendChild(signs);
    return n;
  }
  PB.signatures = function (b, v, ctx) {
    if (b.mode === 'cover') return ctx && ctx.print && ctx.print.cover === false ? null : cover(b, ctx || {});   /* التقرير بلا غلاف */
    if (b.mode !== 'smart:attendance') return null;
    var pr = b.print || {}, groups = pr.groups || 2, absent = v.absent || [];
    var names = (v.roster || []).filter(function (n) { return absent.indexOf(n) < 0; }).concat(v.guests || []).map(who);
    /* pp-keep: جدول الحضور يلزم سطر التوقيعات بعده — ان لم يتسعا انتقلا معا، فلا ترويسة اسماء وحدها في ذيل صفحة */
    /* الصفوف بعدد الحضور لا ستة لكل مجموعة (قرار المستخدم 2026-09-13: «يقتصر الجدول على عدد الحضور ليتشكل مع
       المحتوى» — ثلاثة حضور بخط ١٤ دفعوا الجدول الى صفحة ثانية باثني عشر صفا). وبلا اسماء: pr.rows فارغة لليد */
    var per = names.length ? Math.ceil(names.length / groups) : (pr.rows || 6), wrap = el('div', 'pp-att pp-keep');
    for (var g = 0; g < groups; g++) {
      var t = el('table'), hr = el('tr');
      [['m', 'م'], ['nm', 'اسم الحضور'], ['sig', 'التوقيع']].forEach(function (h) { hr.appendChild(el('th', h[0], h[1])); });
      t.appendChild(hr);
      for (var r = 0; r < per; r++) {
        var i = g * per + r, tr = el('tr');
        tr.appendChild(el('td', 'm', P.ar(i + 1)));
        tr.appendChild(el('td', 'nm', names[i] || ''));
        tr.appendChild(el('td', 'sig', ''));
        t.appendChild(tr);
      }
      wrap.appendChild(t);
    }
    return wrap;
  };

  /* ③ب القسم المتكرر على الورق: لكل نسخة رأسها «محور ١: الانشطة والفعاليات» ثم لبناتها بمولداتها
     (اسمها في الرأس فلا تطبع لبنة خاناته). الرأس والغايات «يلزمان ما بعدهما» (.pp-keep) فلا يتركان يتيمين
     في ذيل صفحة. يعيد قائمة عقد تضعها P.pages واحدة واحدة */
  PB.repeat = function (b, v, ctx) {
    var out = [], only = ctx && ctx.print && ctx.print.axes;   /* تقرير بمحاور مختارة — ورقمها رقمها في الخطة */
    (Array.isArray(v) ? v : []).forEach(function (it, i) {
      if (only && only.indexOf(it.id) < 0) return;
      var name = '';
      b.blocks.forEach(function (c) {
        if (c.type !== 'fields' || name) return;
        (c.fields || []).forEach(function (f) { if (!name && f.required && it[c.id] && it[c.id][f.id]) name = String(it[c.id][f.id]).trim(); });
      });
      out.push(el('div', 'pp-axis pp-keep', (b.label || '') + ' ' + P.ar(i + 1) + (name ? ': ' + name : '')));
      b.blocks.forEach(function (c) {
        if (c.type === 'fields') return;
        var f = PB[c.type], n = f && f(c, it[c.id] || (c.type === 'table' ? [] : {}), ctx);
        if (!n) return;
        (Array.isArray(n) ? n : [n]).forEach(function (x) { if (c.type === 'text') x.classList.add('pp-keep'); out.push(x); });
      });
    });
    return out;
  };

  /* سياق الرسم: نسخة من سياق المنادي ومعها القالب والسجل (يطلبهما الغلاف) — لا يمس سياق المنادي */
  function drawCtx(ctx, tpl, rec) {
    var o = {};
    Object.keys(ctx || {}).forEach(function (k) { o[k] = ctx[k]; });
    o.tpl = tpl; o.rec = rec;
    return o;
  }
  function blankOf(b) { return b.type === 'table' || b.type === 'repeat' ? [] : {}; }

  /* ⑧ سطر التوقيعات — اسفل كل مطبوع (طلب المستخدم 2026-09-13): بلا اطار ولا «يعتمد» — لكل موقع منصبه وتحته اسمه:
     رئيس الشعبة يمينا · الموجه الفني وسطا (ان اضيف) · مدير المدرسة يسارا. الاسماء من الاعداد (المدير والموجه من ش④،
     رئيس الشعبة صاحب الحساب) او «أ. …» تكتب باليد. طبقة مشتركة كالترويسة لا يغيرها قالب، فتلحق كل سجل محفوظ او جديد،
     وتنزل الى اسفل الصفحة (margin-top:auto). signs: { principal, supervisor, head } — الافتراض المدير ورئيس الشعبة */
  P.SIGNS = { principal: true, supervisor: false, head: true };
  /* تفضيلات الطباعة لكل قالب ومطبوعه (key: «قالب» او «قالب:مطبوع») — مصدر واحد لشاشة السجل وملف الفصل:
     التوقيعات (printSigns، والافتراض P.SIGNS) · اخفاء الشعار (printLogoOff) */
  P.signsOf = function (d, key) {
    var o = ((d && d.printSigns) || {})[key] || P.SIGNS;
    return { head: !!o.head, supervisor: !!o.supervisor, principal: !!o.principal };
  };
  P.logoOffOf = function (d, key) { return !!((d && d.printLogoOff) || {})[key]; };
  P.approval = function (signs) {
    var S = window.Shouba, d = S && S.data ? S.data() : {}, o = signs || P.SIGNS, n = el('div', 'pp-appr');
    function nm(x) { x = String(x || '').trim().replace(/^أ\.\s*/, ''); return 'أ. ' + (x || '...........................'); }
    var head = S && S.user ? S.user().name : '';
    /* الترتيب من اليمين (قرار المستخدم 2026-09-13): رئيس الشعبة · الموجه الفني · مدير المدرسة */
    [['head', 'رئيس الشعبة', head], ['supervisor', 'الموجه الفني', d.supervisor], ['principal', 'مدير المدرسة', d.principal]].forEach(function (r) {
      if (!o[r[0]]) return;
      var g = el('div', 'sg');
      g.appendChild(el('div', 'r', r[1]));
      g.appendChild(el('div', 'nm', nm(r[2])));
      n.appendChild(g);
    });
    return n.children.length ? n : null;
  };

  /* الورقة كاملة: الترويسة المشتركة ثم اللبنات بترتيب القالب — الا ما وسم print:false — ثم مربع الاعتماد. ctx: { open } */
  P.body = function (sheet, tpl, rec, ctx) {
    ctx = drawCtx(ctx, tpl, rec);
    tpl.blocks.forEach(function (b) {
      if (b.print === false) return;
      var f = PB[b.type], n = f && f(b, (rec.values || {})[b.id] || blankOf(b), ctx);
      if (!n) return;
      (Array.isArray(n) ? n : [n]).forEach(function (x) { sheet.appendChild(x); });
    });
    var sg = P.approval(ctx.signs);
    if (sg) sheet.appendChild(sg);
    return sheet;
  };
  P.render = function (tpl, rec, ctx, fontId) {
    var s = P.sheet(tpl.page && tpl.page.orient, fontId);
    s.appendChild(P.header(P.headerData(tpl.title, ctx && ctx.noLogo)));
    return P.body(s, tpl, rec, ctx);
  };

  /* ── ملاءمة الصفحة الواحدة (page.fit = 'single-page') ─────────────
     الخط الكامل ١٢ نقطة، ويصغر نصف نقطة بعد نصف حتى يتسع السجل في صفحته، ولا ينزل عن page.minPt.
     ⚠ خطوط اللبنات بـem من خط الورقة فتصغر معا، والترويسة بالنقطة فتبقى ثابتة.
     ⚠ تقاس الورقة وهي في الصفحة (لا display:none)؛ والتحجيم بـtransform لا يغير مقاسها.
     يرجع { pt, base, min, ratio (امتلاء الصفحة بطولها الطبيعي), over (اطول من صفحة ولو صغر) } */
  var PX_MM = 96 / 25.4;
  /* ١٤ نقطة بلا تصغير (قرار المستخدم 2026-09-13: «حجم الخط صغير جدا»): كان ١٢ ويصغر حتى page.minPt (١٠ للمحضر)
     ليتسع في صفحة — والطويل الآن يقسم بحسب محتواه (P.pages) فلا حاجة الى تصغير خطه */
  P.BASE_PT = 14;
  P.pageH = function (orient) { return (orient === 'landscape' ? 210 : 297) * PX_MM; };
  /* عنوان عمود لا يقص (مراجعة الطباعة 2026-09-14: «التنويع والشمولية» طبع «التنويع والشمول» — الكلمة اعرض من عمودها
     في الشبكة الكثيفة): العنوان الذي تفيض كلمته يصغر خطه خطوة بعد خطوة حتى يتسع، الى ٧٠٪ — ولا تكسر الكلمة (قرار سابق:
     حرف وحده في سطر اسوأ). ⚠ والورقة في الصفحة (القياس بالمقاس الحقيقي) — ينادى من P.fit ومن P.pages لكل صفحة */
  P.fitHeads = function (root) {
    [].forEach.call(root.querySelectorAll('.pp-tbl thead th:not(.v)'), function (th) {
      if (th.scrollWidth <= th.clientWidth + 0.5) return;
      var base = parseFloat(getComputedStyle(th).fontSize), k = 1;
      while (th.scrollWidth > th.clientWidth + 0.5 && k > 0.71) { k -= 0.05; th.style.fontSize = (base * k).toFixed(2) + 'px'; }
    });
  };
  P.fit = function (sheet, page) {
    page = page || {};
    P.fitHeads(sheet);
    var base = P.BASE_PT, min = base, H = P.pageH(page.orient), pt = base, h;   /* لا تصغير: page.minPt في القوالب المنشورة لا يعمل به */
    function measure() { sheet.classList.add('pp-measure'); var x = sheet.offsetHeight; sheet.classList.remove('pp-measure'); return x; }
    for (;;) {
      sheet.style.fontSize = pt + 'pt';
      h = measure();
      if (h <= H + 1 || page.fit !== 'single-page' || pt - 0.5 < min) break;
      pt -= 0.5;
    }
    return { pt: pt, base: base, min: min, ratio: h / H, over: h > H + 1 };
  };

  /* ── الامتداد لصفحات (page.fit = 'flow') — ترقيم ذاتي لا يعتمد على المتصفح (المرحلة الثانية أ) ──
     الترويسة في الصفحة الاولى، ثم اللبنات بترتيبها. ما لا يتسع ينتقل الى صفحة جديدة، والجدول ينقسم
     صفا صفا ويتكرر رأسه في كل صفحة. وفي ذيل كل صفحة «صفحة ١ من ٣».
     ⚠ host يجب ان يكون في الصفحة (القياس بالمقاس الحقيقي)، والصفحات تلحق به بالترتيب وتعاد.
     ⚠ صف اطول من صفحة كاملة يبقى في صفحته ولا يقطع — نادر في جداول السجلات.
     ⚠ ينادى بعد اكتمال خط الورق (document.fonts.ready) ويعاد عنده: القياس بخط بديل يطيل الصفوف
       فيزيد الصفحات — رصد في المعاينة: ٣ صفحات والطباعة صفحتان للبيانات نفسها (2026-09-11). */
  var FOOT_MM = 4;
  /* صيغ المعدود لصفوف الجداول (table.count) — لملخص التقرير «من ١١ اجراء» */
  function countForms(tpl) {
    var f = null;
    (function walk(bs) { (bs || []).forEach(function (b) { if (f) return; if (b.type === 'table' && b.count) f = b.count; if (b.blocks) walk(b.blocks); }); })(tpl.blocks);
    return f;
  }
  /* شاهد في الملحق: الصورة في اطار ثابت (تصغر ولا تقص)، وتحتها الاجراء، ثم التاريخ والمنفذ */
  function evFig(e) {
    var f = el('figure', 'pp-ev'), box = el('div', 'im'), im = el('img'), cap = el('figcaption');
    im.alt = '';
    im.src = window.ShoubaFiles ? window.ShoubaFiles.url(e.file) : '';
    box.appendChild(im); f.appendChild(box);
    cap.appendChild(el('b', null, e.what || 'إجراء'));
    var who = Array.isArray(e.who) ? e.who.map(P.whoLabel).join('، ') : P.whoLabel(e.who);
    cap.appendChild(el('span', null, [e.at ? P.date(e.at.slice(0, 10)) : '', who].filter(Boolean).join(' · ')));
    f.appendChild(cap);
    return f;
  }
  P.pages = function (tpl, rec, ctx, host, fontId) {
    ctx = drawCtx(ctx, tpl, rec);
    var orient = (tpl.page && tpl.page.orient) || 'portrait', H = P.pageH(orient) - FOOT_MM * PX_MM;
    var pages = [], cur;
    function page(first) {
      cur = P.sheet(orient, fontId);
      cur.classList.add('pp-page');
      if (first) cur.appendChild(P.header(P.headerData((ctx.print && ctx.print.title) || tpl.title, ctx.noLogo)));
      host.appendChild(cur);
      pages.push(cur);
    }
    function over() { cur.classList.add('pp-measure'); var h = cur.offsetHeight; cur.classList.remove('pp-measure'); return h > H; }
    function shell(t) {                    /* جدول الصفحة التالية: الاعمدة والرأس نفسهما، بلا عنوان ولا صفوف */
      var s = t.cloneNode(false);
      [].forEach.call(t.children, function (ch) { if (ch.tagName === 'COLGROUP' || ch.tagName === 'THEAD') s.appendChild(ch.cloneNode(true)); });
      s.appendChild(el('tbody'));
      return s;
    }
    /* ينقل n الى صفحة جديدة ومعه ما قبله مما «يلزم ما بعده» (.pp-keep: رأس المحور وغاياته) —
       الا ان خلت صفحته بالنقل (سوى الترويسة) فلا ينقل شيء */
    function breakBefore(n) {
      var keeps = [], p = n.previousElementSibling, base = cur.querySelector('.pp-head') ? 1 : 0;
      while (p && p.classList.contains('pp-keep')) { keeps.unshift(p); p = p.previousElementSibling; }
      if (cur.children.length - keeps.length - 1 <= base) return false;
      var go = keeps.concat([n]);
      go.forEach(function (x) { cur.removeChild(x); });
      page(false);
      go.forEach(function (x) { cur.appendChild(x); });
      return true;
    }
    function place(n) {
      cur.appendChild(n);
      if (!over()) return;
      if (n.tagName === 'TABLE') {
        var t = n, tb = t.tBodies[0], trs = [].slice.call(tb.rows);
        tb.textContent = '';
        trs.forEach(function (tr) {
          tb.appendChild(tr);
          if (!over()) return;
          tb.removeChild(tr);
          if (!tb.rows.length) { breakBefore(t); tb.appendChild(tr); return; }   /* رأس بلا صف لا يترك وحده، ولا رأس محوره */
          t = shell(t); tb = t.tBodies[0];
          page(false); cur.appendChild(t); tb.appendChild(tr);
        });
      } else if (n.classList.contains('pp-text') && n.children.length) splitText(n);
      else breakBefore(n);
    }
    /* ⚠ قيد يقسم الصفحة بحسب المحتوى (2026-09-13، طلب المستخدم بعد طباعة محضر طويل): مساحة النص (محضر بمحاور
       وقرارات كثيرة) تنقسم بين الصفحات قسما قسما، والقسم ذو القائمة بندا بندا والترقيم متصل (٤، ٥… لا من ١) —
       والباقي في تكملة بالصنف نفسه في الصفحة التالية. كانت كتلة لا تنقسم: يقص ما جاوز الصفحة او يقسمها المتصفح
       حيث اتفق. وعنوان قسم لا يترك وحده في ذيل صفحة */
    function splitText(box) {
      var kids = [].slice.call(box.children), bx = box;
      box.textContent = '';
      function fresh() { bx = box.cloneNode(false); bx.classList.remove('pp-keep'); page(false); cur.appendChild(bx); }
      function moveBox() { cur.removeChild(bx); page(false); cur.appendChild(bx); }   /* الصندوق فارغ في ذيل الصفحة */
      function splitList(sec, ol) {
        var lis = [].slice.call(ol.children), n = 0, s = sec, o = ol;
        o.textContent = '';
        bx.appendChild(s);
        lis.forEach(function (li) {
          o.appendChild(li);
          if (!over()) { n++; return; }
          o.removeChild(li);
          if (!o.children.length) {
            bx.removeChild(s);
            if (bx.children.length) fresh(); else moveBox();
            bx.appendChild(s);
          } else {
            fresh();
            s = sec.cloneNode(false); o = ol.cloneNode(false);
            o.style.counterReset = 'n ' + n;
            s.appendChild(o); bx.appendChild(s);
          }
          o.appendChild(li); n++;
        });
      }
      kids.forEach(function (k) {
        bx.appendChild(k);
        if (!over()) return;
        bx.removeChild(k);
        var ol = k.querySelector ? k.querySelector(':scope > ol') : null;
        if (ol && ol.children.length > 1) return splitList(k, ol);
        if (bx.children.length) fresh(); else moveBox();
        bx.appendChild(k);
      });
    }
    page(true);
    /* ملخص التقرير (print.summary): «نفذ ٨ من ١١ اجراء» وتفصيل الحالات — للمحاور المختارة */
    if (ctx.print && ctx.print.summary && window.ShoubaRec) {
      var st = window.ShoubaRec.followStats(rec, ctx.print.axes), forms = countForms(tpl), sum = el('div', 'pp-sum');
      if (!st.total) sum.appendChild(document.createTextNode('لا إجراءات مسجلة في الخطة بعد'));   /* لا «نفذ ٠ من ٠» */
      else {
        sum.appendChild(document.createTextNode('نفذ ' + P.ar(st.done) + ' من '
          + P.ar(forms && window.Shouba && Shouba.count ? Shouba.count(st.total, forms) : st.total)));
        sum.appendChild(el('small', null, P.ar(['جار ' + st.doing, 'مؤجل ' + st.later, 'لم ينفذ ' + st.no, 'لم يؤشر ' + st.none].join(' · '))));
      }
      place(sum);
    }
    var fresh = false;                     /* الغلاف يأخذ صفحته وحده */
    tpl.blocks.forEach(function (b) {
      if (b.print === false) return;
      var f = PB[b.type], n = f && f(b, (rec.values || {})[b.id] || blankOf(b), ctx);
      if (!n) return;
      (Array.isArray(n) ? n : [n]).forEach(function (x) {
        if (fresh) { page(false); fresh = false; }
        place(x);
        if (x.classList.contains('pp-cover')) fresh = true;
      });
    });
    /* سطر التوقيعات في آخر النموذج (قبل ملحق الشواهد) — ينزل الى اسفل صفحته. ⚠ ولا صفحة له وحده: الصفوف الفارغة
       (للكتابة باليد — rows.min) في الصفحة تفسح له صفا صفا من آخرها؛ فان لم يبق فارغ ولم يتسع انتقل الى صفحة بعدها.
       (رصد 2026-09-13: شعار المدرسة في الترويسة اطالها فدفع توقيعات شبكة الاعداد الى صفحة ثانية فارغة) */
    var sg = P.approval(ctx.signs);
    if (sg) {
      cur.appendChild(sg);
      var blanks = [].slice.call(cur.querySelectorAll('tr.blank'));
      while (over() && blanks.length) { var bl = blanks.pop(); bl.parentNode.removeChild(bl); }
      if (over()) { cur.removeChild(sg); place(sg); }
    }
    /* ملحق الشواهد (print.appendix): بعد التقرير، اربع صور في الصفحة وتحت كل صورة اجراؤها وتاريخها ومنفذه
       (من البيانات بلا ادخال). وملفات PDF لا تدمج — تذكر اسماؤها. والصور المستبعدة في print.off */
    if (ctx.print && ctx.print.appendix && window.ShoubaRec) {
      var off = ctx.print.off || {}, ev = window.ShoubaRec.evidence(rec, ctx.print.axes).filter(function (e) { return !off[e.file]; });
      var imgs = ev.filter(function (e) { return e.mime !== 'application/pdf'; }), pdfs = ev.filter(function (e) { return e.mime === 'application/pdf'; });
      var chunks = [];
      for (var ci = 0; ci < imgs.length; ci += 4) chunks.push(imgs.slice(ci, ci + 4));
      if (!chunks.length && pdfs.length) chunks.push([]);
      chunks.forEach(function (ch) {
        page(false);
        cur.appendChild(el('div', 'pp-apx-t', 'ملحق الشواهد'));
        if (!ch.length) return;
        var g = el('div', 'pp-apx-g');
        ch.forEach(function (e) { g.appendChild(evFig(e)); });
        cur.appendChild(g);
      });
      if (pdfs.length) {
        var pl = el('div', 'pp-sec');
        pl.appendChild(el('div', 't', 'شواهد بصيغة PDF — تطبع منفصلة'));
        pl.appendChild(ol(pdfs, function (li, e) { li.textContent = (e.what || 'إجراء') + (e.at ? ' · ' + P.date(e.at.slice(0, 10)) : ''); }));
        place(pl);
      }
    }
    pages.forEach(function (p, i) { P.fitHeads(p); p.appendChild(el('div', 'pp-pageno', 'صفحة ' + P.ar(i + 1) + ' من ' + P.ar(pages.length))); });
    return pages;
  };

  /* ── صفحة تقديم السجل (2026-09-14، النموذج أ الذي اعتمده المستخدم: «صفحة تقديم لكل سجل في حال طباعته كاملا… عنوان
     السجل بالمنتصف مع الترويسات») — اطار مزدوج حول الصفحة كشهادات الوزارة، والترويسة بلا اطار عنوانها الصغير، والوسط:
     الشعبة · عنوان السجل · خط مزدوج · المعلم (سجل معلم واحد) · الفصل والعام · مربع (العدد · من · إلى) · سطر التوقيعات.
     العدد: محاضر السجل؛ وفي سجل المعلم متابعاته (صفوف جدوله ذات التاريخ) او عدد المعلمين ان جمع اكثر من معلم.
     tpl · recs: سجلات القالب في الملف · يعيد ورقة عمودية (pp-page) */
  /* opt (2026-09-14، ملف المعلم): { title — عنوان غير عنوان القالب («سجل متابعة معلم» ص٤) · who — سطر المعلم ·
     facts — [[تسمية, قيمة]] بدل الحساب } */
  P.registerCover = function (tpl, recs, fontId, opt) {
    opt = opt || {};
    var S = window.Shouba, R = window.ShoubaRec, d = S.data(), s = P.sheet('portrait', fontId), mid = el('div', 'pp-rcv-mid');
    s.classList.add('pp-page', 'pp-rcv');
    var h = P.header(P.headerData('')), tt = h.querySelector('.pp-title');
    if (tt) h.replaceChild(el('div'), tt);
    s.appendChild(h);
    var who = [], dates = [], n, label;
    (recs || []).forEach(function (r) { if (r.who && who.indexOf(r.who) < 0) who.push(r.who); });
    if (tpl.owner === 'teacher') {
      var tb = tpl.blocks.filter(function (b) { return b.type === 'table'; })[0];
      var dc = tb && tb.columns.filter(function (c) { return c.kind === 'date'; })[0];
      (recs || []).forEach(function (r) { ((r.values || {})[tb && tb.id] || []).forEach(function (x) { if (dc && x[dc.id]) dates.push(String(x[dc.id]).slice(0, 10)); }); });
      if (who.length > 1) { n = who.length; label = 'عدد المعلمين'; } else { n = dates.length; label = 'عدد المتابعات'; }
    } else {
      (recs || []).forEach(function (r) { var x = R && R.dateOf(r); if (x) dates.push(String(x).slice(0, 10)); });
      n = (recs || []).length; label = 'عدد ال' + ((tpl.noun && tpl.noun.few) || 'سجلات');
    }
    dates.sort();
    if (d.department) mid.appendChild(el('div', 'pp-rcv-kick', 'شعبة ' + d.department));
    mid.appendChild(el('div', 'pp-rcv-t', opt.title || tpl.title));
    mid.appendChild(el('div', 'pp-rcv-rule'));
    if (opt.who) mid.appendChild(el('div', 'pp-rcv-who', 'المعلم: ' + P.whoLabel(opt.who)));
    else if (tpl.owner === 'teacher' && who.length === 1) mid.appendChild(el('div', 'pp-rcv-who', 'المعلم: ' + P.whoLabel(who[0])));
    var yr = d.year ? 'العام الدراسي ' + P.ar(d.year) : '';
    var term = tpl.scope === 'year' ? yr : [d.term, yr].filter(Boolean).join(' · ');
    if (term) mid.appendChild(el('div', 'pp-rcv-s', term));
    var f = el('div', 'pp-rcv-facts');
    (opt.facts || [[label, P.ar(n)], ['من', dates.length ? P.date(dates[0]) : ''], ['إلى', dates.length ? P.date(dates[dates.length - 1]) : '']]).forEach(function (x) {
      if (!x[1]) return;
      var c = el('div'); c.appendChild(el('small', null, x[0])); c.appendChild(el('b', null, x[1])); f.appendChild(c);
    });
    mid.appendChild(f);
    s.appendChild(mid);
    var ap = P.approval();
    if (ap) s.appendChild(ap);
    return s;
  };

  /* ── ملف الفصل (2026-09-13، طلب المستخدم): سجلات مختارة في ملف واحد — غلاف وفهرس وترقيم متصل (R.paginate) ──
     entries: [{ tpl, rec, ctx, label }] بترتيبها · opt: { cover (ومعه الفهرس), title, lines: [اسطر الغلاف] }
     · host: عنصر في الصفحة (القياس بالمقاس الحقيقي) تلحق به الاوراق.
     ⚠ الورق عمودي كله: العرضي يدار داخل ورقة عمودية (.pp-rot) — طباعة الآيفون لا تجمع الاتجاهين في ملف (مبدأ R.paginate).
     ⚠ ترقيم كل سجل الذاتي («صفحة ١ من ٢») يزال، وفي ذيل كل ورقة «صفحة n من N» للملف كله — والغلاف بلا رقم.
     يعيد الاوراق بترتيب الملف */
  P.bundle = function (entries, opt, host, fontId) {
    opt = opt || {};
    var docs = [], sets = [];
    /* صفحة تقديم لكل سجل (opt.regCovers — 2026-09-14): قبل اول سجل من قالبه، بسجلات قالبه كلها في الملف،
       ولها سطرها في الفهرس ورقمها في الترقيم المتصل */
    var byTpl = {}, lastTpl = null;
    (entries || []).forEach(function (e) { (byTpl[e.tpl.id] = byTpl[e.tpl.id] || []).push(e.rec); });
    (entries || []).forEach(function (e, i) {
      var t = e.tpl, list;
      if (opt.regCovers && t.id !== lastTpl) {
        var rc = P.registerCover(t, byTpl[t.id], fontId);
        host.appendChild(rc);
        sets.push([rc]);
        docs.push({ key: 'c' + i, title: t.title, orient: 'portrait', pages: 1 });
      }
      lastTpl = t.id;
      var s = null;
      if (!(t.page && t.page.fit === 'flow')) {
        s = P.render(t, e.rec, e.ctx, fontId);
        host.appendChild(s);
        if (P.fit(s, t.page).over) { host.removeChild(s); s = null; }   /* لا يتسع صفحة ولو صغر الخط ⟵ يقسم بحسب محتواه */
        else s.classList.add('pp-page');
      }
      if (s) list = [s];
      else {
        list = P.pages(t, e.rec, e.ctx, host, fontId);
        list.forEach(function (p) { var no = p.querySelector('.pp-pageno'); if (no) no.parentNode.removeChild(no); });
      }
      list = list.map(function (p) {
        if (!p.classList.contains('landscape')) return p;
        var w = P.sheet('portrait', fontId);
        w.classList.add('pp-page', 'pp-rot');
        host.insertBefore(w, p); w.appendChild(p);
        return w;
      });
      sets.push(list);
      docs.push({ key: 'd' + i, title: e.label, orient: 'portrait', pages: list.length });
    });
    var TOC_PER = 22, pg = window.ShoubaRec.paginate(docs, { cover: !!opt.cover, toc: !!opt.cover, tocPer: TOC_PER, bundle: true }), out = [];
    if (opt.cover) {
      /* الغلاف: الترويسة باسم الملف، ووسطه الشعبة والمدرسة والفصل ورئيس الشعبة */
      var cv = P.sheet('portrait', fontId), c = el('div', 'pp-cover');
      cv.classList.add('pp-page');
      cv.appendChild(P.header(P.headerData(opt.title || 'ملف سجلات الشعبة')));
      (opt.lines || []).forEach(function (l, k) { if (l) c.appendChild(el('div', k ? 'pp-cover-s' : 'pp-cover-t', P.ar(l))); });
      cv.appendChild(c); host.appendChild(cv); out.push(cv);
      /* الفهرس: م · السجل · الصفحة — صفحته او صفحاته (TOC_PER سطرا في كل صفحة) */
      var tocNo = 0;
      for (var k = 0; k < pg.toc.length || k === 0; k += TOC_PER) {
        var ts = P.sheet('portrait', fontId), tb = el('table', 'pp-tbl pp-toc'), hr = el('tr'), th = el('thead'), bd = el('tbody');
        ts.classList.add('pp-page');
        ts.appendChild(el('div', 'pp-toc-t', 'الفهرس'));
        [['m', 'م'], [null, 'السجل'], ['m', 'الصفحة']].forEach(function (h) { hr.appendChild(el('th', h[0], h[1])); });
        th.appendChild(hr); tb.appendChild(th);
        pg.toc.slice(k, k + TOC_PER).forEach(function (x) {
          /* صفحة تقديم السجل عنوان قسم في الفهرس (عريض بلا رقم)، والسجلات مرقمة تحته */
          var tr = el('tr'), cov = /^c/.test(x.key);
          if (cov) tr.className = 'sec'; else tocNo++;
          tr.appendChild(el('td', 'm', cov ? '' : P.ar(tocNo)));
          tr.appendChild(el('td', null, P.ar(x.title)));
          tr.appendChild(el('td', 'm', P.ar(x.page)));
          bd.appendChild(tr);
        });
        tb.appendChild(bd); ts.appendChild(tb); host.appendChild(ts); out.push(ts);
      }
    }
    /* صفحة امامية بلا رقم (opt.front — غلاف ملف المعلم «سجل متابعة معلم» ص٤): تبنى في host وتتقدم الملف */
    var front = opt.front ? opt.front(host) : null;
    if (front) out.unshift(front);
    sets.forEach(function (l) { l.forEach(function (p) { out.push(p); }); });
    out.forEach(function (s, i) {
      if ((opt.cover || front) && i === 0) return;
      var at = s.classList.contains('pp-rot') ? s.firstChild : s;   /* المدار: الرقم في ورقته فيقرأ معها */
      at.classList.add('pp-page');
      at.appendChild(el('div', 'pp-pageno', 'صفحة ' + P.ar(i + 1) + ' من ' + P.ar(out.length)));
    });
    return out;
  };

  /* ── ملف PDF جاهز (2026-09-13، طلب المستخدم: «اسفل الصفحة يظهر رابط شعبة والساعة… احذف») ──────────────────
     سفاري الآيفون يكتب في هوامش الطباعة عنوان الصفحة والتاريخ ولا يزال ذلك من داخلها، ويفرض هوامشه فتصغر الورقة.
     فتصنع المنصة الملف بنفسها: كل ورقة صورة عالية الدقة (html2canvas — يحمل من cdnjs عند الحاجة وحدها) في صفحة
     PDF بمقاس ورقتها (A4 عمودية او عرضية)، ثم تطبع او تحفظ او ترسل من قائمة المشاركة بلا ذيل ولا تصغير.
     وصيغة الملف تكتب هنا بلا مكتبة: صور JPEG في صفحات (PDF ١٫٤). sheets: اوراق المعاينة (تنسخ ولا تمس) */
  var H2C = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  function loadH2C() {
    if (window.html2canvas) return Promise.resolve(window.html2canvas);
    return new Promise(function (ok, no) {
      var s = document.createElement('script');
      s.src = H2C; s.async = true;
      s.onload = function () { if (window.html2canvas) ok(window.html2canvas); else no(new Error('h2c')); };
      s.onerror = function () { no(new Error('h2c')); };
      document.head.appendChild(s);
    });
  }
  P.isIOS = function () { var ua = navigator.userAgent; return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1); };
  /* الجهاز يشارك الملفات (الآيفون والاندرويد) — فالملف الجاهز يفتح قائمة المشاركة */
  P.canShareFiles = function () {
    try { return !!(navigator.canShare && window.File && navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] })); }
    catch (e) { return false; }
  };
  /* ⚠ انماط الورق تحقن نصا في نسخة html2canvas (رصد 2026-09-13): نسخته تحل روابط الانماط النسبية على غير مسار
     الصفحة احيانا (داخل اطار) فتخرج الورقة بلا اطر ولا خط. rec-print.css قائم بذاته (لا رموز tokens.css) */
  var cssText = null;
  function printCss() {
    if (cssText !== null) return Promise.resolve(cssText);
    var l = document.querySelector('link[href*="rec-print.css"]');
    if (!l) return Promise.resolve(cssText = '');
    return fetch(l.href).then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) { return (cssText = t); }, function () { return ''; });
  }
  P.pdf = function (sheets, onPage) {
    var list = Array.isArray(sheets) ? sheets : [sheets], css = '';
    return Promise.all([loadH2C(), printCss()]).then(function (r) {
      var h2c = r[0];
      css = r[1];
      var stage = el('div'), pages = [], i = 0;
      stage.style.cssText = 'position:fixed;left:-12000px;top:0;';
      document.body.appendChild(stage);
      function next() {
        if (i >= list.length) { document.body.removeChild(stage); return pages; }
        /* الورقة المدارة في ملف الفصل (.pp-rot): ورقتها العرضية كما هي في صفحة PDF عرضية — html2canvas يبعثر النص المدار
           (رصد 2026-09-13)، وقارئ PDF وطابعته يجمعان الاتجاهين بلا حاجة الى الادارة */
        var src = list[i].classList.contains('pp-rot') && list[i].firstElementChild ? list[i].firstElementChild : list[i];
        var c = src.cloneNode(true), land;
        c.style.transform = '';
        c.classList.add('pp-page');                  /* الورقة بطول صفحتها بالضبط */
        land = c.classList.contains('landscape');
        stage.appendChild(c);
        return h2c(c, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false,
          /* ⚠ الخط قبل الرسم (2026-09-13): سفاري لا يرسم على اللوحة نصا بخط لم يحمل بعد — فخرج المحضر على الآيفون بلا
             بيانات. وانماط الورق تحقن هنا بعد انتظار html2canvas للخطوط، فيطلب خط الورق من جديد في نسخته: ينتظر حمل
             اوزانه (بحد اربع ثوان — بلا شبكة يرسم بما حضر) */
          onclone: function (doc) {
            if (css) { var st = doc.createElement('style'); st.textContent = css; doc.head.appendChild(st); }
            if (!doc.fonts || !doc.fonts.load) return;
            var fam = (getComputedStyle(c).getPropertyValue('--paper-font') || '"IBM Plex Sans Arabic"').split(',')[0].trim();
            var loads = Promise.all(['400', '500', '600', '700'].map(function (w) {
              return doc.fonts.load(w + ' 14pt ' + fam, 'ابجد ١٢٣').catch(function () {});
            })).then(function () { return doc.fonts.ready; });
            return Promise.race([loads, new Promise(function (r) { setTimeout(r, 4000); })]);
          } }).then(function (cv) {
          stage.removeChild(c);
          pages.push({ jpg: cv.toDataURL('image/jpeg', 0.9), w: cv.width, h: cv.height, land: land });
          i++;
          if (onPage) onPage(i, list.length);
          return next();
        });
      }
      return next();
    }).then(function (pages) { return new Blob([pdfBytes(pages)], { type: 'application/pdf' }); });
  };
  function b64bytes(url) { var b = atob(url.split(',')[1]), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function pdfBytes(pages) {
    var chunks = [], len = 0, offs = [], enc = new TextEncoder(), kids = [], n = pages.length;
    function add(x) { var u = typeof x === 'string' ? enc.encode(x) : x; chunks.push(u); len += u.length; }
    function obj(k, body) { offs[k] = len; add(k + ' 0 obj\n'); body(); add('\nendobj\n'); }
    add('%PDF-1.4\n');
    for (var k = 0; k < n; k++) kids.push((3 + 3 * k) + ' 0 R');
    obj(1, function () { add('<< /Type /Catalog /Pages 2 0 R >>'); });
    obj(2, function () { add('<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>'); });
    pages.forEach(function (p, k) {
      var W = p.land ? '841.89' : '595.28', Hh = p.land ? '595.28' : '841.89', img = b64bytes(p.jpg), cs = 'q ' + W + ' 0 0 ' + Hh + ' 0 0 cm /Im0 Do Q';
      obj(3 + 3 * k, function () { add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + Hh + '] /Resources << /XObject << /Im0 ' + (5 + 3 * k) + ' 0 R >> >> /Contents ' + (4 + 3 * k) + ' 0 R >>'); });
      obj(4 + 3 * k, function () { add('<< /Length ' + cs.length + ' >>\nstream\n' + cs + '\nendstream'); });
      obj(5 + 3 * k, function () {
        add('<< /Type /XObject /Subtype /Image /Width ' + p.w + ' /Height ' + p.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + img.length + ' >>\nstream\n');
        add(img); add('\nendstream');
      });
    });
    var xref = len, total = 3 + 3 * n;
    add('xref\n0 ' + total + '\n0000000000 65535 f \n');
    for (var o = 1; o < total; o++) add(('0000000000' + offs[o]).slice(-10) + ' 00000 n \n');
    add('trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF');
    var out = new Uint8Array(len), pos = 0;
    chunks.forEach(function (c) { out.set(c, pos); pos += c.length; });
    return out;
  }

  /* الطباعة: نسخة من الورقة — او صفحات الامتداد — بمقاسها في .pp-print (ابن body)، وrec-print.css يخفي سواها.
     المتسع في صفحة يوسم «one» فيثبت بطولها، وكل صفحة امتداد صفحة ثابتة. واتجاه الورق من الورقة نفسها:
     قاعدة @page تحقن عند الطباعة، فالعرضية تطبع عرضية والعمودية لا تتأثر */
  P.print = function (sheets, fit) {
    var list = Array.isArray(sheets) ? sheets : [sheets], land = false;
    var old = document.querySelector('body > .pp-print'), box = el('div', 'pp-print');
    /* ⚠ سفاري الآيفون (2026-09-13، رصد المستخدم: المحضر خرج صفحتين والحضور مقسوم): لا يأخذ بهامش الصفحة الصفري،
       ويحجز هوامشه ويكتب فيها العنوان والتاريخ — فالورقة بطول A4 كاملا تفيض. فتصغر فيه وحده لتتسع صفحتها */
    var ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) box.classList.add('ios');
    if (old) old.parentNode.removeChild(old);
    list.forEach(function (s) {
      var c = s.cloneNode(true);
      c.style.transform = '';
      if (c.classList.contains('pp-page') || (fit && !fit.over)) c.classList.add('one');
      if (c.classList.contains('landscape')) land = true;
      box.appendChild(c);
    });
    var st = document.getElementById('pp-size');
    if (!st) { st = el('style'); st.id = 'pp-size'; document.head.appendChild(st); }
    st.textContent = '@media print{@page{size:A4 ' + (land ? 'landscape' : 'portrait') + ';margin:0}}';
    document.body.appendChild(box);
    /* صور الشواهد تحمل من الخادم: الطباعة تنتظر حملها (او ٨ ثوان) فلا تخرج فارغة — وبلا صور تطبع في الحال */
    var wait = [].slice.call(box.querySelectorAll('img')).filter(function (im) { return !im.complete; });
    if (!wait.length) { window.print(); return; }
    Promise.all(wait.map(function (im) { return new Promise(function (r) { im.onload = im.onerror = r; setTimeout(r, 8000); }); }))
      .then(function () { window.print(); });
  };
})();
