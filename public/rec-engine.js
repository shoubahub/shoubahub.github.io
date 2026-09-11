/* ===================================================================
   شعبة · محرك السجلات — النواة (2026-09-12)
   ────────────────────────────────────────────────────────────────
   **تعريف واحد ⟵ مخرجان**: من تعريف القالب (rec-templates.js) تولد شاشة الادخال
   والورقة المطبوعة — لا شاشة ولا ورقة لسجل بعينه. وهذا الملف النواة وحدها:
   الصيغة وقوائمها المغلقة · التحقق · سجل الاصدارات · انشاء السجل · الرقم التسلسلي
   · متابعة القرارات · ترقيم صفحات المخرج المجمع. والرسم (ادخالا وورقا) في خطوتيه.

   ⚠ لا DOM ولا نصوص عرض — دوال خالصة، كـ derive.js. ويوصل بعد rec-templates.js.
   ⚠ القوائم مغلقة: نوع لبنة او حقل خارجها يرفضه التحقق ولا يدخل السجل — فلا رسم حر.
   ⚠ الاصدار المنشور مجمد (Object.freeze): تعديله اصدار جديد بجانبه لا تغيير فيه.

   شكل السجل المحفوظ (في وثيقة الشعبة تحت recs — انظر derive.js ⑥):
     { id, tpl, v, year, term, who?, status:'draft'|'printed'|'signed', created, updated,
       values: { <معرف اللبنة>: قيمتها }, signed?: { file, mime, size } }
   والقيم بمعرفات اللبنات والحقول لا بعناوينها، فتعديل العناوين لا يمسها.
   =================================================================== */
(function () {
  var R = window.ShoubaRec = {};

  /* ── القوائم المغلقة ─────────────────────────────────────────────
     اللبنات السبع المعتمدة (2026-08-14) باسماء الصيغة:
       fields ① بطاقة بيانات · text ② نص حر · table ③ جدول متكرر · rating ④ جدول تقييم
       checklist ⑤ قائمة تحقق · files ⑥ رفع صور وملفات · signatures ⑦ توقيع وغلاف
     و repeat «القسم المتكرر» قدرة لا لبنة: حاوية تضم لبنات ينسخ منها المستخدم ما يشاء
     (الخطة التشغيلية: «محور») — في الصيغة من الان ولو لم يستعملها قالب بعد.
     ⚠ «شبكة المتابعة» (سجلات الاعداد · الاعمال التحريرية) ليست لبنة: جدول متكرر باعمدة ✓
       مجمعة وعناوين رأسية وصفحة عرضية — وتحرر على الهاتف قائمة تحقق لكل صف. */
  R.BLOCKS   = ['fields', 'text', 'table', 'rating', 'checklist', 'files', 'signatures', 'repeat'];
  /* انواع الحقول والاعمدة: نص قصير · نص طويل · تاريخ · رقم · اختيار · علامة ✓ · معلم ·
     اشهر (اختيار شهر او اكثر) · قيمة تلقائية · توقيع (خانة فارغة على الورق) ·
     متابعة (حالة + ملاحظة + شاهد — عمود الخطة التشغيلية الذكي) */
  R.KINDS    = ['text', 'longtext', 'date', 'number', 'choice', 'check', 'teacher', 'months', 'auto', 'signature', 'followup'];
  R.SECTIONS = ['paragraph', 'list', 'smart:followup', 'smart:decisions'];
  R.SIGN     = ['roles', 'smart:attendance', 'cover'];
  R.AUTO     = ['serial:year', 'today', 'year', 'term', 'teacher', 'school', 'directorate'];
  R.OWNERS   = ['shouba', 'teacher', 'student'];
  R.ORIENTS  = ['portrait', 'landscape'];
  R.FITS     = ['single-page', 'flow'];
  R.FILES    = ['image', 'pdf'];

  function isId(s) { return typeof s === 'string' && /^[a-z][a-zA-Z0-9_]*$/.test(s); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  /* الارقام الهندية الى لاتينية — ما يكتبه المستخدم قد يأتي بهما */
  function latin(v) { return String(v == null ? '' : v).replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 0x660; }); }

  /* ── التحقق: يعيد قائمة اخطاء (فارغة = سليم) ─────────────────── */
  R.validate = function (t) {
    var e = [];
    if (!t || typeof t !== 'object') return ['القالب ليس كائنا'];
    var w = t.id || '؟';
    function bad(at, msg) { e.push(at + ': ' + msg); }
    if (!isId(t.id)) bad(w, 'معرف القالب');
    if (!(t.v >= 1) || Math.floor(t.v) !== t.v) bad(w, 'رقم الاصدار');
    if (!t.title) bad(w, 'العنوان');
    if (R.OWNERS.indexOf(t.owner) < 0) bad(w, 'صاحب السجل خارج القائمة: ' + t.owner);
    var p = t.page || {};
    if (R.ORIENTS.indexOf(p.orient) < 0) bad(w, 'اتجاه الصفحة: ' + p.orient);
    if (R.FITS.indexOf(p.fit) < 0) bad(w, 'سلوك الامتلاء: ' + p.fit);
    if (!arr(t.blocks).length) bad(w, 'بلا لبنات');

    var ids = {}, decisions = {}, followups = [];
    function kind(k, at) { if (R.KINDS.indexOf(k) < 0) bad(at, 'نوع خارج القائمة: ' + k); }
    function field(f, at, seen) {
      var fa = at + '.' + (f && f.id || '؟');
      if (!f || !isId(f.id)) return bad(fa, 'معرف الحقل');
      if (seen[f.id]) bad(fa, 'معرف مكرر'); seen[f.id] = 1;
      if (!f.label) bad(fa, 'بلا عنوان');
      kind(f.kind, fa);
      if (f.auto && R.AUTO.indexOf(f.auto) < 0) bad(fa, 'قيمة تلقائية خارج القائمة: ' + f.auto);
      if (f.kind === 'choice' && !arr(f.options).length) bad(fa, 'اختيار بلا خيارات');
    }
    function block(b, at, inRepeat) {
      var ba = at + '/' + (b && b.id || '؟');
      if (!b || R.BLOCKS.indexOf(b.type) < 0) return bad(ba, 'نوع لبنة خارج القائمة: ' + (b && b.type));
      if (!isId(b.id)) bad(ba, 'معرف اللبنة');
      else if (ids[b.id]) bad(ba, 'معرف لبنة مكرر'); else ids[b.id] = 1;
      var seen = {};
      switch (b.type) {
        case 'fields':
          if (!arr(b.fields).length) bad(ba, 'بلا حقول');
          arr(b.fields).forEach(function (f) { field(f, ba, seen); });
          break;
        case 'text':
          if (!arr(b.sections).length) bad(ba, 'بلا اقسام');
          arr(b.sections).forEach(function (s) {
            var sa = ba + '.' + (s && s.id || '؟');
            if (!s || !isId(s.id)) return bad(sa, 'معرف القسم');
            if (seen[s.id]) bad(sa, 'معرف مكرر'); seen[s.id] = 1;
            if (R.SECTIONS.indexOf(s.kind) < 0) bad(sa, 'نوع قسم خارج القائمة: ' + s.kind);
            if (s.kind === 'smart:decisions') decisions[s.id] = 1;
            if (s.kind === 'smart:followup') followups.push({ at: sa, of: s.of });
            if (s.kind === 'list' && (!s.item || !s.item.title)) bad(sa, 'قائمة بلا عنوان عنصر');
          });
          break;
        case 'table':
          var groups = {};
          arr(b.groups).forEach(function (g) { if (!g || !isId(g.id) || !g.label) bad(ba, 'مجموعة اعمدة ناقصة'); else groups[g.id] = 1; });
          if (!arr(b.columns).length) bad(ba, 'بلا اعمدة');
          arr(b.columns).forEach(function (c) {
            field(c, ba, seen);
            if (c && c.group && !groups[c.group]) bad(ba + '.' + c.id, 'مجموعة غير معرفة: ' + c.group);
          });
          if (b.rowGroups && ['months', 'list'].indexOf(b.rowGroups.from) < 0) bad(ba, 'مجموعات صفوف: ' + b.rowGroups.from);
          if (b.rowGroups && b.rowGroups.from === 'list' && !arr(b.rowGroups.items).length) bad(ba, 'مجموعات صفوف بلا بنود');
          arr(b.total).forEach(function (id) { if (!seen[id]) bad(ba, 'مجموع لعمود غير موجود: ' + id); });
          break;
        case 'rating':
        case 'checklist':
          if (!arr(b.items).length) bad(ba, 'بلا بنود');
          arr(b.items).forEach(function (it) {
            if (!it || !isId(it.id) || !it.label) return bad(ba, 'بند ناقص');
            if (seen[it.id]) bad(ba, 'بند مكرر: ' + it.id); seen[it.id] = 1;
          });
          break;
        case 'files':
          arr(b.accept).forEach(function (a) { if (R.FILES.indexOf(a) < 0) bad(ba, 'نوع ملف خارج القائمة: ' + a); });
          break;
        case 'signatures':
          if (R.SIGN.indexOf(b.mode) < 0) bad(ba, 'نمط توقيع خارج القائمة: ' + b.mode);
          if (b.mode === 'roles' && !arr(b.roles).length) bad(ba, 'موقعون بلا ادوار');
          break;
        case 'repeat':
          if (inRepeat) bad(ba, 'قسم متكرر داخل قسم متكرر');
          if (!b.label) bad(ba, 'قسم متكرر بلا اسم');
          if (!arr(b.blocks).length) bad(ba, 'قسم متكرر بلا لبنات');
          arr(b.blocks).forEach(function (c) { block(c, ba, true); });
          break;
      }
    }
    arr(t.blocks).forEach(function (b) { block(b, w, false); });
    followups.forEach(function (f) { if (!decisions[f.of]) bad(f.at, 'متابعة لقرارات غير موجودة: ' + f.of); });
    var pids = {};
    arr(t.prints).forEach(function (p) {
      if (!p || !isId(p.id)) return bad(w, 'مطبوع بلا معرف');
      if (pids[p.id]) bad(w, 'مطبوع مكرر: ' + p.id); pids[p.id] = 1;
    });
    return e;
  };

  /* ── سجل الاصدارات ─────────────────────────────────────────────
     القالب المعيب لا يدخل السجل ويذكر في R.errors — فلا يرسم نصف قالب. */
  function freeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o);
      Object.keys(o).forEach(function (k) { freeze(o[k]); });
    }
    return o;
  }
  var REG = {};
  R.errors = [];
  R.load = function (map) {
    REG = {};
    var errs = [];
    Object.keys(map || {}).forEach(function (id) {
      Object.keys(map[id] || {}).forEach(function (v) {
        var t = map[id][v], e = R.validate(t);
        if (t && (t.id !== id || String(t.v) !== String(v))) e.push(id + '@' + v + ': المعرف او الاصدار لا يطابق موضعه');
        if (e.length) { errs = errs.concat(e); return; }
        (REG[id] = REG[id] || {})[t.v] = freeze(t);
      });
    });
    R.errors = errs;
    return errs;
  };
  R.get      = function (id, v) { var s = REG[id]; return (s && s[v]) || null; };
  R.versions = function (id) { return Object.keys(REG[id] || {}).map(Number).sort(function (a, b) { return a - b; }); };
  R.latest   = function (id) { var vs = R.versions(id); return vs.length ? REG[id][vs[vs.length - 1]] : null; };
  R.list     = function () { return Object.keys(REG).map(R.latest); };
  R.byReady  = function (name) { return R.list().filter(function (t) { return t.ready === name; })[0] || null; };
  /* قالب السجل **باصداره هو** — لا الاحدث */
  R.of       = function (rec) { return rec ? R.get(rec.tpl, rec.v) : null; };

  /* ── ادوات السير في القالب ───────────────────────────────────── */
  function eachBlock(t, fn) {
    arr(t && t.blocks).forEach(function (b) {
      fn(b, null);
      if (b.type === 'repeat') arr(b.blocks).forEach(function (c) { fn(c, b); });
    });
  }
  function findField(t, test) {
    var hit = null;
    eachBlock(t, function (b, rep) {
      if (hit || rep || b.type !== 'fields') return;
      arr(b.fields).forEach(function (f) { if (!hit && test(f)) hit = { block: b.id, field: f.id }; });
    });
    return hit;
  }
  function findSections(t, kind) {
    var out = [];
    eachBlock(t, function (b, rep) {
      if (rep || b.type !== 'text') return;
      arr(b.sections).forEach(function (s) { if (s.kind === kind) out.push({ block: b.id, section: s.id }); });
    });
    return out;
  }
  function valueAt(rec, at) { return at ? ((rec.values || {})[at.block] || {})[at.field] : undefined; }

  var WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  R.weekday = function (iso) {
    var p = String(iso || '').split('-');
    if (p.length !== 3) return '';
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return isNaN(d.getTime()) ? '' : WEEKDAYS[d.getDay()];
  };
  /* ملخص السجل للقوائم والرؤوس — من التعريف لا من اسماء حقول بعينها:
     الرقم = اول حقل auto:'serial:year' · التاريخ = اول حقل date · العنوان = اول حقل نص مطلوب */
  R.summary = function (rec) {
    var t = R.of(rec), s = { no: '', date: '', title: '' };
    if (!t) return s;
    t.blocks.forEach(function (b) {
      if (b.type !== 'fields') return;
      var v = (rec.values || {})[b.id] || {};
      b.fields.forEach(function (f) {
        var x = v[f.id];
        if (x === '' || x == null) return;
        if (f.auto === 'serial:year') { if (s.no === '') s.no = x; }
        else if (f.kind === 'date') { if (!s.date) s.date = x; }
        else if (f.kind === 'text' && f.required && !s.title) s.title = String(x);
      });
    });
    return s;
  };

  /* ── الارشيف (الخطوة هـ) ─────────────────────────────────────────
     الحالات قائمة مغلقة: مسودة ← مطبوع (اول طباعة) ← موقع (ارفاق النسخة الموقعة — الخطوة و) */
  R.STATUS = ['draft', 'printed', 'signed'];
  R.markPrinted = function (rec) {
    if (!rec.status || rec.status === 'draft') { rec.status = 'printed'; rec.printed = new Date().toISOString(); }
    return rec;
  };
  /* النسخة الموقعة (الخطوة و): ارفاقها يجعل السجل «موقعا» وتصير مرجعه الرسمي، والوثيقة تحمل
     الاشارة وحدها والملف في الخادم (files.js). وازالتها تعيده «مطبوعا» وتعيد معرف الملف لحذفه */
  R.markSigned = function (rec, f) {
    rec.signed = { file: f.id, mime: f.mime, size: f.size, at: new Date().toISOString() };
    rec.status = 'signed';
    return rec;
  };
  /* كل ملفات السجل — النسخة الموقعة ومرفقات اللبنة ⑥ وما يأتي: كل مفتاح «file» فيه.
     لحذفها معه، وبالقاعدة نفسها يجمعها الخادم للمصالحة (files.refsOf) */
  R.files = function (rec) {
    var out = [];
    (function walk(x) {
      if (!x || typeof x !== 'object') return;
      if (Array.isArray(x)) return x.forEach(walk);
      Object.keys(x).forEach(function (k) {
        if (k === 'file' && typeof x[k] === 'string') { if (out.indexOf(x[k]) < 0) out.push(x[k]); }
        else walk(x[k]);
      });
    })(rec);
    return out;
  };
  R.unsign = function (rec) {
    var old = rec.signed && rec.signed.file;
    delete rec.signed;
    if (rec.status === 'signed') rec.status = 'printed';
    return old || null;
  };

  /* البحث يوحد الهمزات والتاء المربوطة والالف المقصورة والارقام، وينزع التشكيل والتطويل —
     فـ«اسئلة» تجد «أسئلة» و«2» تجد «٢». (المحارف بترميزها لا بصورتها: لا تشكيل في الملف) */
  R.norm = function (s) {
    return String(s == null ? '' : s)
      .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
      .replace(/[آأإٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
      .replace(/[ؤئ]/g, 'ء')   /* كرسي الهمزة يختلف في الرسم: «مسؤول» و«مسئول» واحد */
      .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x660); })
      .toLowerCase().replace(/\s+/g, ' ').trim();
  };
  function strings(x, out) {
    if (x == null) return out;
    if (typeof x === 'string' || typeof x === 'number') out.push(String(x));
    else if (Array.isArray(x)) x.forEach(function (y) { strings(y, out); });
    else if (typeof x === 'object') Object.keys(x).forEach(function (k) { strings(x[k], out); });
    return out;
  }
  /* نص السجل للبحث: كل قيمه، واسم يوم تاريخه وصيغة «يوم/شهر» */
  R.text = function (rec) {
    var s = R.summary(rec), a = strings(rec.values, []), p = String(s.date || '').split('-');
    if (p.length === 3) { a.push(R.weekday(s.date)); a.push((+p[2]) + '/' + (+p[1])); }
    return R.norm(a.join(' '));
  };
  R.match = function (rec, q) {
    var t = R.text(rec);
    return R.norm(q).split(' ').filter(Boolean).every(function (w) { return t.indexOf(w) > -1; });
  };
  /* مجموعات (العام · الفصل)، الاحدث اولا بآخر تاريخ فيها — فلا حاجة الى ترتيب الفصول من المرجعية؛
     وفي كل مجموعة الاحدث تاريخا ثم رقما. opt: { q (بحث), status (من R.STATUS) } */
  R.archive = function (records, opt) {
    opt = opt || {};
    var groups = {}, order = [];
    function key(r) { var s = R.summary(r); return (s.date || String(r.created || '').slice(0, 10)) + '|' + ('00000' + (+s.no || 0)).slice(-5); }
    arr(records).forEach(function (r) {
      if (opt.status && (r.status || 'draft') !== opt.status) return;
      if (opt.q && !R.match(r, opt.q)) return;
      var k = (r.year || '') + '|' + (r.term || '');
      if (!groups[k]) { groups[k] = { year: r.year || '', term: r.term || '', items: [] }; order.push(k); }
      groups[k].items.push(r);
    });
    return order.map(function (k) {
      var g = groups[k];
      g.items.sort(function (a, b) { return key(b).localeCompare(key(a)); });
      g.latest = key(g.items[0]);
      return g;
    }).sort(function (a, b) { return b.latest.localeCompare(a.latest); });
  };

  R.newId = function (prefix) { return (prefix || 'r') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };

  /* ── انشاء سجل من قالب ─────────────────────────────────────────
     ctx: { today, year, term, teachers, records, school, directorate, who }
     ⚠ الحضور لقطة من المعلمين يوم الانشاء: المحضر وثيقة تاريخية لا تتغير ان
       تغيرت القائمة لاحقا. والمعلمون محفوظون اسماء، فالاسم يحفظ كما كان. */
  function autoValue(a, ctx) {
    switch (a) {
      case 'serial:year': return ctx.serial;
      case 'today':       return ctx.today;
      case 'year':        return ctx.year;
      case 'term':        return ctx.term;
      case 'school':      return ctx.school;
      case 'directorate': return ctx.directorate;
      case 'teacher':     return ctx.who;
    }
  }
  function blank(b, ctx) {
    switch (b.type) {
      case 'fields':
        var o = {};
        arr(b.fields).forEach(function (f) { var a = autoValue(f.auto, ctx); if (a !== undefined && a !== '') o[f.id] = a; });
        return o;
      case 'text':
        var s = {};
        arr(b.sections).forEach(function (x) { s[x.id] = x.kind === 'paragraph' ? '' : x.kind === 'smart:followup' ? {} : []; });
        return s;
      case 'signatures':
        return b.mode === 'smart:attendance' ? { roster: arr(ctx.teachers).slice(), absent: [], guests: [] } : {};
      case 'rating': case 'checklist': return {};
      /* ⚠ كائن لا مصفوفة: items على مصفوفة يسقطه JSON عند الحفظ (2026-09-11) */
      case 'files': return { items: [] };
      default: return [];                     /* table · repeat */
    }
  }
  R.create = function (t, ctx) {
    if (!t) return null;
    ctx = ctx || {};
    var cx = {};
    Object.keys(ctx).forEach(function (k) { cx[k] = ctx[k]; });
    cx.serial = R.nextSerial(ctx.records, t.id, ctx.year);
    var now = new Date().toISOString();
    var rec = { id: R.newId('r'), tpl: t.id, v: t.v, year: ctx.year || '', term: ctx.term || '',
      status: 'draft', created: now, updated: now, values: {} };
    if (ctx.who) rec.who = ctx.who;          /* صاحب السجل ان كان معلما او طالبا */
    arr(t.blocks).forEach(function (b) { rec.values[b.id] = blank(b, cx); });
    return rec;
  };

  /* الرقم التسلسلي: يبدأ من ١ كل عام دراسي، ويليه اكبر رقم مسجل (لا عدد السجلات:
     حذف سجل لا يعيد رقمه لغيره) */
  R.nextSerial = function (records, tplId, year) {
    var max = 0;
    arr(records).forEach(function (r) {
      if (r.tpl !== tplId || (r.year || '') !== (year || '')) return;
      var t = R.of(r) || R.latest(tplId);
      var n = parseInt(latin(valueAt(r, findField(t, function (f) { return f.auto === 'serial:year'; }))), 10);
      if (n > max) max = n;
    });
    return max + 1;
  };

  /* تاريخ السجل: اول حقل تاريخ في قالبه، والا يوم انشائه */
  R.dateOf = function (r) {
    return valueAt(r, findField(R.of(r), function (f) { return f.kind === 'date'; })) || String(r.created || '').slice(0, 10);
  };
  function before(a, b) {
    var da = R.dateOf(a), db = R.dateOf(b);
    return da < db || (da === db && String(a.created) < String(b.created));
  }

  /* ── متابعة القرارات ────────────────────────────────────────────
     القرار مفتوح ما لم يؤشر عليه «نفذ» (done) في سجل لاحق لسجله، و«مستمر» (cont)
     يبقيه مفتوحا فينتقل الى ما بعده. **تستنتج ولا تخزن مرتين**: القرار في سجله،
     والتأشير في سجل المتابعة، والمفتوح يحسب منهما. وتقصر على القالب نفسه. */
  function decisionsOf(r) {
    var out = [];
    findSections(R.of(r), 'smart:decisions').forEach(function (s) {
      arr(((r.values || {})[s.block] || {})[s.section]).forEach(function (d) { if (d && d.id && d.text) out.push(d); });
    });
    return out;
  }
  function marksOf(r) {
    var m = {};
    findSections(R.of(r), 'smart:followup').forEach(function (s) {
      var v = ((r.values || {})[s.block] || {})[s.section] || {};
      Object.keys(v).forEach(function (k) { m[k] = v[k]; });
    });
    return m;
  }
  /* ما يعرض في «متابعة قرارات الاجتماع السابق» لسجل rec */
  R.openDecisions = function (records, rec) {
    var prev = arr(records).filter(function (r) { return r.tpl === rec.tpl && r.id !== rec.id && before(r, rec); })
      .sort(function (a, b) { return before(a, b) ? -1 : 1; });
    var open = [];
    prev.forEach(function (r) {
      var m = marksOf(r);
      open = open.filter(function (d) { return m[d.id] !== 'done'; });
      decisionsOf(r).forEach(function (d) { open.push({ id: d.id, text: d.text, owner: d.owner || '', due: d.due || '', from: r.id }); });
    });
    return open;
  };
  /* قرارات سجل ما زالت مفتوحة بعده — لبطاقة الارشيف */
  R.stillOpen = function (records, rec) {
    var done = {};
    arr(records).forEach(function (r) {
      if (r.tpl !== rec.tpl || r.id === rec.id || !before(rec, r)) return;
      var m = marksOf(r);
      Object.keys(m).forEach(function (k) { if (m[k] === 'done') done[k] = 1; });
    });
    return decisionsOf(rec).filter(function (d) { return !done[d.id]; });
  };

  /* ── المخرج المجمع: «طباعة ملف الفصل» — يصمم من الان (2026-09-12) ──────
     الصفحات ترقم هنا لا في المتصفح: فيجمع اكثر من سجل في ملف واحد بغلاف وفهرس
     وترقيم متصل. docs: [{ key, title, orient, pages }] (عدد الصفحات يقيسه الرسم).
     ⚠ طباعة الهاتف (سفاري آيفون) لا تجمع صفحات عمودية وعرضية في ملف واحد —
       فالعرضية في المخرج المجمع تدار داخل ورقة عمودية (rotate)، والسجل العرضي
       وحده يطبع على ورق عرضي. */
  R.paginate = function (docs, opt) {
    docs = arr(docs); opt = opt || {};
    var bundle = !!opt.bundle || docs.length > 1, sheets = [], toc = [], n = 0;
    function add(kind, key, orient, index) {
      n++;
      sheets.push({ kind: kind, doc: key || null, index: index || 0, number: n,
        paper: bundle ? 'portrait' : orient, rotate: bundle && orient === 'landscape' });
    }
    if (opt.cover) add('cover', null, 'portrait');
    var tocPages = opt.toc ? Math.max(1, Math.ceil(docs.length / (opt.tocPer || 25))) : 0;
    for (var i = 0; i < tocPages; i++) add('toc', null, 'portrait', i);
    docs.forEach(function (d) {
      toc.push({ key: d.key, title: d.title, page: n + 1, pages: Math.max(1, d.pages || 1) });
      for (var k = 0; k < Math.max(1, d.pages || 1); k++) add('page', d.key, d.orient || 'portrait', k);
    });
    return { sheets: sheets, toc: toc, total: n, bundle: bundle };
  };

  R.load(window.SHOUBA_TPL || {});
  if (R.errors.length && window.console) console.error('قوالب السجلات:', R.errors);
})();
