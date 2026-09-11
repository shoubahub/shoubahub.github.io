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
  /* ② مساحة النص: العبارة الافتتاحية ثم الاقسام، وما بقي من المساحة اسطر منقطة (fill) */
  PB.text = function (b, v, ctx) {
    var box = el('div', 'pp-text');
    if (b.lead) box.appendChild(el('div', 'pp-lead', b.lead));
    b.sections.forEach(function (s) { var n = PS[s.kind] && PS[s.kind](s, v, ctx); if (n) box.appendChild(n); });
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
  PB.signatures = function (b, v) {
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

  /* الورقة كاملة: الترويسة المشتركة ثم اللبنات بترتيب القالب. ctx: { open } */
  P.body = function (sheet, tpl, rec, ctx) {
    ctx = ctx || {};
    tpl.blocks.forEach(function (b) {
      var f = PB[b.type], n = f && f(b, (rec.values || {})[b.id] || {}, ctx);
      if (n) sheet.appendChild(n);
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

  /* الطباعة: نسخة من الورقة بمقاسها في .pp-print (ابن body) — وrec-print.css يخفي سواها عند الطباعة.
     والمتسع في صفحة يوسم «one» فيثبت بطولها */
  P.print = function (sheet, fit) {
    var old = document.querySelector('body > .pp-print');
    if (old) old.parentNode.removeChild(old);
    var box = el('div', 'pp-print'), c = sheet.cloneNode(true);
    c.style.transform = '';
    if (fit && !fit.over) c.classList.add('one');
    box.appendChild(c);
    document.body.appendChild(box);
    window.print();
  };
})();
