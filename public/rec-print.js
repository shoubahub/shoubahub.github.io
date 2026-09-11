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

  /* شعار المطبوعات: printLogoSrc = 'none' (بلا شعار، الافتراض) · 'crest' (شعار الواجهة ان كان صورة)
     · 'upload' (صورة رفعت للمطبوعات في printLogoImg). والمرفوع يبقى محفوظا ان اختير غيره ثم عاد اليه.
     ورمز الواجهة المرسوم (icon) ليس شعار مدرسة فلا يستعار. */
  P.canCrest = function (d) { return !!(d.crest && d.crest.type === 'image' && d.crest.data); };
  P.logoOf = function (d) {
    var src = d.printLogoSrc || 'none';
    if (src === 'crest') return P.canCrest(d) ? d.crest.data : '';
    if (src === 'upload') return d.printLogoImg || '';
    return '';
  };
  P.headerData = function (title) {
    var S = window.Shouba, d = S.data();
    return { title: title || '', ministry: 'وزارة التربية', directorate: S.directorate(), school: d.schoolName || '', logo: P.logoOf(d) };
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
    var t = el('table', 'pp-fields');
    b.fields.forEach(function (f) {
      var tr = el('tr'), td = el('td'), x = v[f.id];
      tr.appendChild(el('th', null, f.label));
      if (f.kind === 'date' && x) {
        if (f.show === 'weekday+date') { td.appendChild(el('span', null, window.ShoubaRec.weekday(x))); td.appendChild(el('span', 'gap')); }
        td.appendChild(el('span', null, P.date(x)));
      } else td.textContent = P.ar(x == null ? '' : x);
      tr.appendChild(td);
      t.appendChild(tr);
    });
    return t;
  };
  /* ② مساحة النص: العبارة الافتتاحية ثم الاقسام، وما بقي من المساحة اسطر منقطة (fill).
     وبلا عبارة ولا قسم مكتوب ولا اسطر منقطة لا شيء يطبع (غايات محور فارغة) */
  PB.text = function (b, v, ctx) {
    var box = el('div', 'pp-text');
    if (b.lead) box.appendChild(el('div', 'pp-lead', b.lead));
    b.sections.forEach(function (s) { var n = PS[s.kind] && PS[s.kind](s, v, ctx); if (n) box.appendChild(n); });
    if (!box.children.length && b.fill !== 'dotted') return null;
    if (b.fill === 'dotted') box.appendChild(el('div', 'pp-fill'));
    return box;
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
      case 'date': return P.date(x);
      case 'number': return P.ar(x == null ? '' : x);
      case 'check': return x ? '✓' : '';
      case 'teacher': return Array.isArray(x) ? x.map(P.whoLabel).join('، ') : P.whoLabel(x);
      case 'months': return P.monthsLabel(x);
      case 'signature': return '';
      case 'followup': return ctx && ctx.print && ctx.print.follow ? P.followLabel(x) : '';   /* فارغ في «الخطة» */
      default: return String(x == null ? '' : x);
    }
  }
  var COLW = { date: 26, number: 16, check: 11, signature: 28, teacher: 44, months: 42, choice: 30, followup: 42 };   /* بالمليمتر */
  PB.table = function (b, v, ctx) {
    var rows = Array.isArray(v) ? v : [], cols = b.columns || [], groups = {}, num = b.numbered !== false;
    var t = el('table', 'pp-tbl'), cg = el('colgroup'), th = el('thead'), r1 = el('tr');
    var grouped = cols.some(function (c) { return c.group; }), r2 = grouped ? el('tr') : null;
    (b.groups || []).forEach(function (g) { groups[g.id] = g; });
    if (b.title) t.appendChild(el('caption', null, b.title));
    function col(w) { var c = el('col'); if (w) c.style.width = w + 'mm'; return c; }
    function head(c, span2) {
      var h = el('th', c.vertical ? 'v' : null);
      if (c.vertical) h.appendChild(el('span', null, c.label)); else h.textContent = c.label;
      if (span2) h.rowSpan = 2;
      return h;
    }
    if (num) { cg.appendChild(col(8)); var hm = el('th', 'm', 'م'); if (grouped) hm.rowSpan = 2; r1.appendChild(hm); }
    cols.forEach(function (c) { cg.appendChild(col(c.w || COLW[c.kind])); });
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
    var tb = el('tbody'), n = Math.max(rows.length, (b.rows && b.rows.min) || 0);
    for (var k = 0; k < n; k++) {
      var row = rows[k], tr = el('tr', row ? null : 'blank');
      if (num) tr.appendChild(el('td', 'm', P.ar(k + 1)));
      cols.forEach(function (c) {
        tr.appendChild(el('td', c.kind === 'check' ? 'ck' : c.kind === 'signature' ? 'sig' : null, row ? cellText(c, row[c.id], ctx) : ''));
      });
      tb.appendChild(tr);
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
  /* ⑦ الحضور: مجموعتان متجاورتان (م · اسم الحضور · التوقيع)، ستة صفوف لكل منهما، اليمنى تملأ اولا.
     الحاضرون وحدهم (presentOnly)، وخانات التوقيع فارغة لليد، وما زاد على ١٢ تضاف له صفوف */
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
    var per = Math.max(pr.rows || 6, Math.ceil(names.length / groups)), wrap = el('div', 'pp-att');
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

  /* الورقة كاملة: الترويسة المشتركة ثم اللبنات بترتيب القالب — الا ما وسم print:false. ctx: { open } */
  P.body = function (sheet, tpl, rec, ctx) {
    ctx = drawCtx(ctx, tpl, rec);
    tpl.blocks.forEach(function (b) {
      if (b.print === false) return;
      var f = PB[b.type], n = f && f(b, (rec.values || {})[b.id] || blankOf(b), ctx);
      if (!n) return;
      (Array.isArray(n) ? n : [n]).forEach(function (x) { sheet.appendChild(x); });
    });
    return sheet;
  };
  P.render = function (tpl, rec, ctx, fontId) {
    var s = P.sheet(tpl.page && tpl.page.orient, fontId);
    s.appendChild(P.header(P.headerData(tpl.title)));
    return P.body(s, tpl, rec, ctx);
  };

  /* ── ملاءمة الصفحة الواحدة (page.fit = 'single-page') ─────────────
     الخط الكامل ١٢ نقطة، ويصغر نصف نقطة بعد نصف حتى يتسع السجل في صفحته، ولا ينزل عن page.minPt.
     ⚠ خطوط اللبنات بـem من خط الورقة فتصغر معا، والترويسة بالنقطة فتبقى ثابتة.
     ⚠ تقاس الورقة وهي في الصفحة (لا display:none)؛ والتحجيم بـtransform لا يغير مقاسها.
     يرجع { pt, base, min, ratio (امتلاء الصفحة بطولها الطبيعي), over (اطول من صفحة ولو صغر) } */
  var PX_MM = 96 / 25.4;
  P.BASE_PT = 12;
  P.pageH = function (orient) { return (orient === 'landscape' ? 210 : 297) * PX_MM; };
  P.fit = function (sheet, page) {
    page = page || {};
    var base = P.BASE_PT, min = page.minPt || base, H = P.pageH(page.orient), pt = base, h;
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
      if (first) cur.appendChild(P.header(P.headerData((ctx.print && ctx.print.title) || tpl.title)));
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
      } else breakBefore(n);
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
    pages.forEach(function (p, i) { p.appendChild(el('div', 'pp-pageno', 'صفحة ' + P.ar(i + 1) + ' من ' + P.ar(pages.length))); });
    return pages;
  };

  /* الطباعة: نسخة من الورقة — او صفحات الامتداد — بمقاسها في .pp-print (ابن body)، وrec-print.css يخفي سواها.
     المتسع في صفحة يوسم «one» فيثبت بطولها، وكل صفحة امتداد صفحة ثابتة. واتجاه الورق من الورقة نفسها:
     قاعدة @page تحقن عند الطباعة، فالعرضية تطبع عرضية والعمودية لا تتأثر */
  P.print = function (sheets, fit) {
    var list = Array.isArray(sheets) ? sheets : [sheets], land = false;
    var old = document.querySelector('body > .pp-print'), box = el('div', 'pp-print');
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
