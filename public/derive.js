/* ===================================================================
   شعبة · طبقة الاشتقاق (2026-09-01)
   ────────────────────────────────────────────────────────────────
   **المكان الواحد الذي تستخرج فيه الحقائق من البيانات.**

   البيانات المخزنة سطر خام: schedules["أحمد الفهد"]["الأحد"][3] = "12/2 · الفلسفة"
   والحقائق تحسب منها: من يدرس الآن · من متفرغ · النصاب · التعارض · المتأخر.

   القاعدة: **كل جواب قد تسأله شاشتان يسكن هنا** — والشاشة تسأل ولا تحسب.
   وما لا يخرج عن شاشة واحدة (ترتيب الأعمدة · الألوان · نص الزر) يبقى فيها.

   ⚠ لا واجهة هنا ولا DOM ولا نصوص عرض — دوال خالصة فقط.
   ⚠ ويوم تنتقل البيانات إلى خادم، **هذا الملف وحده يتغير** ولا تمس الشاشات.
   يعتمد على: refdata.js (المرجعية) — ويوصل بعده وقبل components.js.
   =================================================================== */
(function () {
  var KEY = 'shouba.setup';
  window.Shouba = window.Shouba || {};
  var S = window.Shouba;

  /* ===== ① المصدر: نقطة قراءة وكتابة واحدة =====
     ⚠ **الجهاز أولا، والخادم بعده**: الكتابة تحفظ محليا في الحال فتظهر
       فورا بلا انتظار شبكة، ثم ترسل بعد سكون قصير. فالإدخال لا يتغير
       إحساسه، ويعمل بلا إنترنت، وشبكة المدرسة تنقطع فلا يقف العمل. */
  var cache = null;
  var REV = 'shouba.rev', BASE = 'shouba.base', OWNER = 'shouba.owner';

  S.data = function (fresh) {
    if (fresh || !cache) { try { cache = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { cache = {}; } }
    return cache;
  };
  S.save = function (patch) {
    var d = S.data();
    if (patch) Object.keys(patch).forEach(function (k) { d[k] = patch[k]; });
    localStorage.setItem(KEY, JSON.stringify(d));
    push();                                 /* إلى الخادم بعد سكون */
    return d;
  };

  /* ===== ①ب المزامنة: رقم مراجعة من الخادم لا ساعة جهاز (2026-09-10) =====
     ⚠ كانت تقارن الأوقات «الأحدث يقود»، فانكسرت في ثلاث:
       · جهاز بلا ختم سابق عد كل ما على الخادم أحدث، فمحا نسخته بصمت
         وأعلن «من جهاز آخر» ولا جهاز آخر (رصد بالفحص).
       · ساعة جوال غير مضبوطة تقلب الترتيب فتطمس كتابة صحيحة.
       · وحساب ثان على الجهاز نفسه كان يرث نسخة من قبله.
     الآن: كل حفظ على الخادم يرفع رقم المراجعة، والجهاز يحفظ آخر رقم بنى
     عليه ويرسل «بنيت على كذا». فإن سبقه غيره رفض الخادم وأعاد نسخته،
     **ولا يحسم الخلاف بقاعدة صامتة بل يعرض على صاحبه**.
     ⚠ و«هل عدل هنا ما لم يرسل؟» تعرف **ببصمة آخر نسخة متزامنة** (BASE)
       لا براية يرفعها الكاتب: شاشات الإعداد تكتب في الجهاز مباشرة فلا ترفع
       راية، فكان تعديلها يمحى بصمت إن تقدم الخادم. البصمة تكشف كل تغيير
       أيا كان كاتبه.
     ⚠ لا DOM هنا: الخلاف يسلم عبر S.onConflict، وحال الحفظ عبر S.onSyncState،
       والشاشة تبنيهما في components.js. */
  var online = false, timer = null, sending = false, again = false;
  S.conflict = null;

  function ls(k)       { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k)    { try { localStorage.removeItem(k); } catch (e) {} }
  lsDel('shouba.sync'); lsDel('shouba.dirty');          /* مفاتيح نظام الأوقات البائد */

  function getRev()  { var v = parseInt(ls(REV), 10); return isNaN(v) ? null : v; }
  function setRev(v) { lsSet(REV, String(v)); }

  /* مقارنة لا يغيرها ترتيب المفاتيح */
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object')
      return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  function snap(d) {
    var s = canon(d || {}), h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36) + '.' + s.length;
  }
  function mark(d)   { lsSet(BASE, snap(d)); }
  /* بلا بصمة سابقة يعد معدلا — فالمجهول يسأل عنه ولا يطمس */
  function isDirty() { var b = ls(BASE); return !b || b !== snap(S.data(true)); }
  function same(a, b) { return canon(a || {}) === canon(b || {}); }
  function blank(d)   { return !d || typeof d !== 'object' || Object.keys(d).length === 0; }

  function adopt(d, rev) {                  /* نسخة الخادم تصير نسخة الجهاز */
    /* ما يصل من الخادم ينظف من الحركات كذلك — جهاز على نسخة قديمة قد رفع نصا مشكولا.
       وان غير التنظيف شيئا رفعت النسخة النظيفة، فيلتقي الجهاز والخادم على نص واحد (2026-09-11) */
    var p = plain(d || {});
    cache = p;
    localStorage.setItem(KEY, JSON.stringify(cache));
    setRev(rev); mark(cache);
    if (!same(p, d || {})) push();
  }
  function note(bad) {
    if (typeof S.onSyncState === 'function') { try { S.onSyncState(!!bad); } catch (e) {} }
  }
  function raise(j, quiet) {
    S.conflict = { local: S.data(), server: j.data || {}, serverRev: j.rev || 0, serverAt: j.updatedAt || '' };
    if (!quiet && typeof S.onConflict === 'function') { try { S.onConflict(S.conflict); } catch (e) {} }
  }

  function push() {
    if (!online || S.conflict) return;      /* لا إرسال والخلاف معلق */
    clearTimeout(timer);
    timer = setTimeout(send, 1200);         /* سكون قصير — لا مع كل حرف */
  }

  /* ⚠ ٤٠١ = انتهت الجلسة (أعيد تعيين الرقم، أو مضت مدتها) — **ليست انقطاعا**.
     كانت تعامل «بلا إنترنت» فتعاد المحاولة كل ١٥ ثانية أبدا، وصاحبها يظن
     عمله يحفظ (رصد 2026-09-10). الآن يتوقف الإرسال ويعلن لصاحبه، وتبقى
     تعديلاته على الجهاز: بعد الدخول يراها الإقلاع (connect) معدلة فيرفعها. */
  function authLost() {
    online = false; clearTimeout(timer); S.authLost = true;
    if (typeof S.onAuthLost === 'function') { try { S.onAuthLost(); } catch (e) {} }
  }

  /* يرسل الوثيقة مبنية على مراجعة، ويعيد: 'ok' · 'conflict' · 'auth' · 'offline' */
  function put(baseRev, quiet) {
    var sent = S.data();
    return fetch('api/data', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin', body: JSON.stringify({ data: sent, baseRev: baseRev })
    }).then(function (r) {
      if (r.status === 401) { authLost(); return 'auth'; }
      return r.json().then(function (j) {
        if (r.ok) { setRev(j.rev); mark(sent); note(false); return 'ok'; }
        if (r.status === 409) { raise(j, quiet); return 'conflict'; }
        throw new Error('http ' + r.status);
      });
    }).catch(function () { note(true); return 'offline'; });
  }

  function send() {
    if (!online || S.conflict) return;
    if (sending) { again = true; return; }
    sending = true;
    put(getRev() || 0).then(function (res) {
      sending = false;
      if (res === 'offline') setTimeout(function () { if (online) send(); }, 15000);
      else if (again && res === 'ok') { again = false; send(); }
    });
  }

  /* الإقلاع: ينادى من components.js بعد تحميل الصفحة.
     يعيد 'ok' · 'conflict' · 'none' (بلا خادم أو بلا جلسة). */
  S.connect = function () {
    if (!window.fetch) return Promise.resolve('none');
    return fetch('api/data', { credentials: 'same-origin' }).then(function (r) {
      /* ⚠ ٤٠٤ = نسخة ساكنة بلا خادم (العنوان القديم على GitHub Pages)،
         وتفترق عن ٤٠١ = خادم بلا جلسة. الأولى وحدها تستدعي تنبيه الانتقال. */
      if (r.status === 404) { S.serverless = true; return 'none'; }
      if (!r.ok) return 'none';
      return r.json().then(function (res) {
        online = true;
        /* نسخة محلية لصاحب آخر لا تقارن ولا ترفع — تطوى */
        /* ⚠ الربط بمعرف الحساب «#رقم» لا باسمه (2026-09-11): الاسم يعاد تسجيله بعد حذف
           حسابه، والمعرف لا يعاد. والقيمة القديمة (اسم المستخدم) ترقى بصمت إن طابقت
           صاحبها — فلا تمحى نسخة أحد يوم النشر. (المنطق نفسه في الموجه index.html.) */
        var key = res.owner || res.user, owner = ls(OWNER);
        var legacy = owner && owner.charAt(0) !== '#' && owner === res.user;
        if (owner && key && owner !== key && !legacy) {
          lsDel(KEY); lsDel(REV); lsDel(BASE); cache = null;
        }
        if (key) lsSet(OWNER, key);

        var mine = S.data(true), srv = res.data, rev = res.rev || 0, base = getRev();
        if (blank(srv)) {                   /* الخادم لا يملك شيئا */
          if (!blank(mine)) send();         /* ترحيل: يرتفع ما على الجهاز */
          return 'ok';
        }
        if (blank(mine))     { adopt(srv, rev); return 'ok'; }
        if (same(mine, srv)) { setRev(rev); mark(srv); return 'ok'; }
        /* مختلفان */
        if (base === rev) { send(); return 'ok'; }          /* الخادم لم يتغير منذ بنينا ⟵ تعديلاتنا ترتفع */
        if (base !== null && base < rev && !isDirty()) {     /* تقدم الخادم ولا عمل هنا لم يرسل */
          adopt(srv, rev); S.updatedElsewhere = true; return 'ok';
        }
        /* خلاف حقيقي، أو أصل مجهول (نسخة لم ترقم قط) ⟵ يسأل صاحبه */
        raise({ data: srv, rev: rev, updatedAt: res.updatedAt });
        return 'conflict';
      });
    }).catch(function () { return 'none'; });
  };
  S.online = function () { return online; };

  /* حسم الخلاف باختيار صاحبه — والنسخة المتروكة تحفظ على الجهاز احتياطا */
  S.resolve = function (keep) {
    var c = S.conflict;
    if (!c) return Promise.resolve('ok');
    lsSet(KEY + '.discarded', JSON.stringify({ at: new Date().toISOString(), kept: keep,
      data: keep === 'mine' ? c.server : c.local }));
    S.conflict = null;
    if (keep === 'server') { adopt(c.server, c.serverRev); return Promise.resolve('ok'); }
    cache = c.local;
    localStorage.setItem(KEY, JSON.stringify(cache));
    return put(c.serverRev);                /* «بنيت على نسختك» ⟵ تقبل ما لم يسبقها ثالث */
  };

  /* ===== ①ج قابلية النقل: تصدير الشعبة واستيرادها (2026-09-10) =====
     ميزة دائمة لا جسر مؤقت — قرار المستخدم: «حلول جذرية لا ترقيعية».
     أول استعمالها نقل ما على العنوان القديم، ثم تبقى للنسخ الاحتياطي،
     ولتسليم الشعبة لمن يخلف رئيسها، وللانتقال بين المدارس.
     ⚠ الصيغة **مرقمة** (version): فيقرأ إصدار قادم ملفات اليوم،
       ويرفض الإصدار القديم ملفا أحدث منه بدل أن يسيء قراءته.
     ⚠ لا DOM ولا نص عرض هنا — رموز أخطاء فقط، والنص في components.js. */
  var FORMAT = 'shouba.export', FORMAT_V = 1;

  S.exportPayload = function () {
    var owner = '';
    try { owner = (JSON.parse(localStorage.getItem('shouba.user')) || {}).name || ''; } catch (e) {}
    return {
      format: FORMAT, version: FORMAT_V, exportedAt: new Date().toISOString(),
      source: { app: window.SHOUBA_VERSION || '', build: window.SHOUBA_BUILD || 0 },
      owner: { name: owner },
      data: S.data()
    };
  };

  /* خلاصة وثيقة — تعرضها معاينة الاستيراد ولوحة الخلاف */
  S.summarize = function (d) {
    d = d || {};
    var sch = (d.schedules && typeof d.schedules === 'object') ? d.schedules : {};
    var withSchedule = Object.keys(sch).filter(function (t) {
      var day = sch[t] || {};
      return Object.keys(day).some(function (k) { return (day[k] || []).some(function (v) { return !!v; }); });
    }).length;
    return {
      department: d.department || '', stage: d.stage || '', school: d.schoolName || '',
      teachers: Array.isArray(d.teachers) ? d.teachers.length : 0,
      schedules: withSchedule,
      events: Array.isArray(d.events) ? d.events.length : 0,
      recs: Array.isArray(d.recs) ? d.recs.length : 0
    };
  };

  /* يتحقق ولا يكتب شيئا — يعيد { ok, data, summary } أو { ok:false, error } */
  S.parseImport = function (obj) {
    if (!obj || typeof obj !== 'object') return { ok: false, error: 'bad' };
    if (obj.format !== FORMAT || !(obj.version >= 1)) return { ok: false, error: 'format' };
    if (obj.version > FORMAT_V) return { ok: false, error: 'newer' };
    var d = obj.data;
    if (!d || typeof d !== 'object' || Array.isArray(d)) return { ok: false, error: 'bad' };
    var s = S.summarize(d);
    s.owner = (obj.owner && obj.owner.name) || '';
    s.exportedAt = obj.exportedAt || '';
    return { ok: true, data: d, summary: s };
  };

  /* يستبدل الوثيقة كاملة لا يدمجها — والسابقة تحفظ على الجهاز قبل الاستبدال،
     فالاستيراد بالخطأ يسترد ولا يفقد به عمل. */
  S.replace = function (d) {
    var prev = ls(KEY);
    if (prev && prev !== '{}') lsSet(KEY + '.before-import', prev);
    cache = d;
    localStorage.setItem(KEY, JSON.stringify(d));
    push();
    return d;
  };

  /* إرسال فوري ينتظره المنادي — لازم قبل مغادرة الصفحة بعد الاستيراد:
     الإرسال المؤجل يموت بموت الصفحة.
     overwrite: الاستيراد استبدال صريح بعد تحذير، فإن سبقه حفظ على الخادم
     بني على رقمه الحالي، ولا يعرض خلاف على من اختار الاستبدال للتو. */
  S.flush = function (overwrite) {
    clearTimeout(timer);
    if (!online) return Promise.resolve('offline');
    return put(getRev() || 0, overwrite).then(function (res) {
      if (res !== 'conflict' || !overwrite) return res;
      var c = S.conflict; S.conflict = null;
      return put(c.serverRev, true);
    });
  };


  /* ===== ①ب الترحيل — خطوات مرقمة، كل منها مرة واحدة (refDataVersion) =====
     ⚠ خطوات لا شرط واحد (2026-09-11): كان الشرط «≠ النسخة الحالية» فيعاد ما قبلها
       كله مع كل رفع للرقم (ومنه محو مخزون المواد). الآن تنفذ كل خطوة لمن لم يبلغها.
     ٢ (2026-09-07) أسماء الأقسام تبدلت مع بيانات الوزارة — من أعد شعبته على القديمة
       يجدها باسمها الجديد. ويمحى **مخزون المواد** المحفوظ لحظة الإعداد: أسماء المقررات
       تبدلت كلها، فالمخزون القديم يحجب الجديد لو بقي.
     ٣ (2026-09-11) **لا تشكيل** — قرار المستخدم (نصيحة زميل: راحة للعين). حذفت الحركات من
       نصوص الواجهة والبيانات المرجعية، فتحذف من الوثيقة المحفوظة كذلك وإلا لم يتطابقا
       («سجل…» المحفوظ ⟵ «سجل…» في refdata). والمفاتيح كالقيم: الجداول مفاتيحها أسماء المعلمين.
     ⚠ المزامنة: إن كانت النسخة نظيفة قبل الترحيل ختمت بصمتها بعده — فجهاز ثان يرحل
       نسخته المطابقة فيجدها مطابقة لما رفعه الأول، ولا يعرض عليه «خلاف» كاذب.
     ⚠ نمط الحركات بمهارب يونيكود لا بالحروف نفسها: أداة تنظيف المصدر تحذف الحروف. */
  var REF_VERSION = 3;
  var HARAKAT = new RegExp('[' + String.fromCharCode(0x064B) + '-' + String.fromCharCode(0x0652) + String.fromCharCode(0x0670) + ']', 'g');
  function plain(v) {
    if (typeof v === 'string') return v.replace(HARAKAT, '');
    if (Array.isArray(v)) return v.map(plain);
    if (v && typeof v === 'object') {
      var o = {};
      Object.keys(v).forEach(function (k) { var nk = plain(k); if (!(nk in o)) o[nk] = plain(v[k]); });
      return o;
    }
    return v;
  }
  /* نص واحد بلا حركات — للشاشات التي يصلها نص من خارج البيانات (اسم معلم في الرابط) */
  S.plain = function (s) { return String(s == null ? '' : s).replace(HARAKAT, ''); };
  var HAS_HARAKAT = new RegExp(HARAKAT.source);   /* بلا g — للفحص وحده */

  (function migrate () {
    var d = S.data();
    if (!d.stage) return;
    var v = d.refDataVersion || 1;
    /* ⚠ شفاء ذاتي لا ترحيل مرة واحدة (2026-09-11): جهاز ما زال على نسخة قديمة من المنصة
       (في مخزن عامل الخدمة) قد يكتب نصا مشكولا بعد ان رحلت الوثيقة الى ٣ — فلا يكتفى
       برقم النسخة: اي حركة في الوثيقة تنظف متى وجدت، من اي مصدر جاءت. */
    var marked = HAS_HARAKAT.test(JSON.stringify(d));
    if (v === REF_VERSION && !marked) return;
    var clean = !isDirty();
    if (v < 2) {
      var now = SHOUBA_REF.departmentOf(d.stage, d.department || '');
      if (now !== d.department) d.department = now;
      delete d.subjects;                     // تشتق من جديد
    }
    if (v < 3 || marked) d = plain(d);
    d.refDataVersion = REF_VERSION;
    localStorage.setItem(KEY, JSON.stringify(d));
    cache = d;
    if (clean) mark(d);
  })();

  /* ===== ② بنية الشعبة ===== */
  S.stage      = function () { return S.data().stage || 'ثانوي'; };
  S.days       = function () { return SHOUBA_REF.days; };
  S.periods    = function () { return SHOUBA_REF.periodTimes[S.stage()] || SHOUBA_REF.periodTimes['ثانوي']; };
  S.periodCount= function () { return SHOUBA_REF.periodsOf(S.stage()) || 7; };
  S.subjects   = function () {
    var d = S.data();
    return (d.subjects && d.subjects.length) ? d.subjects : SHOUBA_REF.subjectsOf(S.stage(), d.department);
  };
  /* كل معلمي الشعبة (المسجلون في ش⑤) */
  S.teachers   = function () { return (S.data().teachers || []).slice(); };
  /* التوجيه لترويسة السجلات: ما عدله رئيس الشعبة، والا المرجع — يشتق ولا يرحل (2026-09-12) */
  S.directorate = function () {
    var d = S.data();
    return (d.directorate && d.directorate.trim()) || SHOUBA_REF.directorateOf(d.stage || '', d.department || '');
  };
  /* من أدخل جدوله فقط — وعليه تحسب أعداد «يدرسون / متفرغون»،
     لأن من لا جدول له لا يعرف موضعه فلا يعد متفرغا. */
  /* ⚠ «له جدول» = فيه خانة واحدة مملوءة على الأقل — لا مجرد وجود المفتاح.
     فتح شاشة الجداول ينشئ مصفوفات فارغة لكل اسم، فكان مجرد المرور بها يسقط
     تذكير «لم يدخل جدوله بعد» ويعد المعلم «متفرغا» ونحن لا نعرف جدوله
     أصلا — وهو اختلاق من جنس بند الاتهام المحذوف (رصد 2026-09-05). */
  S.hasSchedule = function (t) {
    var day = (S.data().schedules || {})[t];
    if (!day) return false;
    return Object.keys(day).some(function (k) {
      return (day[k] || []).some(function (v) { return !!v; });
    });
  };
  S.scheduled  = function () { return Object.keys(S.data().schedules || {}).filter(S.hasSchedule); };
  S.withoutSchedule = function () { return S.teachers().filter(function (t) { return !S.hasSchedule(t); }); };
  /* رئيس الشعبة نفسه — يدرس أيضا، فله جدول ونصاب ويدخل في حساب التعارض.
     ⚠ ولا يدرج في teachers(): ليس من معلميه بل رئيسهم، فلا يعد في «معلموك»
       ولا يذكر بنفسه في «بحاجة إلى إجراء» (قرار المستخدم 2026-09-05). */
  S.self = function () {
    try { return (JSON.parse(localStorage.getItem('shouba.user')) || {}).name || ''; }
    catch (e) { return ''; }
  };
  /* كل من يظهر في الجدول: رئيس الشعبة أولا · ثم معلموه · ثم كل من له جدول
     (احتياطا لاسم لم يعد في القائمة). بلا تكرار. */
  S.roster = function () {
    var all = [], add = function (n) { if (n && all.indexOf(n) === -1) all.push(n); };
    add(S.self());
    S.teachers().forEach(add);
    S.scheduled().forEach(add);
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
  /* يعيد مصفوفة يوم المعلم بطولها الصحيح، وينشئها إن لم توجد */
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

  /* ===== ④ الحقائق المشتقة ===== */
  /* من يدرس في هذه الحصة من هذا اليوم */
  S.busyAt = function (day, pIdx) {
    return S.scheduled().filter(function (t) { return S.slot(t, day, pIdx); });
  };
  /* ومن هو متفرغ فيها — ممن أدخل جدولهم */
  S.freeAt = function (day, pIdx) {
    return S.scheduled().filter(function (t) { return !S.slot(t, day, pIdx); });
  };
  /* المواد التي يدرسها معلم فعلا — تشتق من جدوله لا تدخل:
     [{ name:'الفلسفة', classes:['12/2','12/3'], periods:6 }] مرتبة بالأكثر حصصا. */
  S.subjectsOfTeacher = function (teacher) {
    var map = {};
    S.days().forEach(function (day) {
      S.daySlots(teacher, day).forEach(function (v) {
        if (!v) return;
        var s = S.splitSlot(v);
        var e = map[s.subject] || (map[s.subject] = { name: s.subject, classes: [], periods: 0 });
        e.periods++;
        if (s.cls && e.classes.indexOf(s.cls) === -1) e.classes.push(s.cls);
      });
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.periods - a.periods; });
  };

  /* فصول المعلم من جدوله — لعمود «الفصل» في السجلات (kind:'class'). بالصف ثم رقم الشعبة: 10/2 قبل 10/4 قبل 11/1.
     ⚠ يقرأ الجدول ولا يمسه: daySlots ينشئ أياما فارغة لمن لا جدول له */
  S.classesOf = function (teacher) {
    var t = (S.data().schedules || {})[teacher] || {}, out = [];
    Object.keys(t).forEach(function (day) {
      (Array.isArray(t[day]) ? t[day] : []).forEach(function (v) {
        var c = S.splitSlot(v).cls;
        if (c && out.indexOf(c) < 0) out.push(c);
      });
    });
    function key(c) {
      return String(c).replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 0x660; })
        .split('/').map(function (n) { return parseInt(n, 10) || 0; });
    }
    return out.sort(function (a, b) { var x = key(a), y = key(b); return (x[0] - y[0]) || ((x[1] || 0) - (y[1] || 0)); });
  };

  /* نصاب المعلم: مجموع حصصه في الأسبوع (الفراغ تفرغ لا نقص) */
  S.loadOf = function (teacher) {
    var n = 0;
    S.days().forEach(function (day) {
      S.daySlots(teacher, day).forEach(function (v) { if (v) n++; });
    });
    return n;
  };
  /* تعارض الإسناد: الصف نفسه في اليوم والحصة نفسيهما لمعلمين.
     scope اختياري: اقصر النتيجة على تعارضات معلم بعينه. */
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
  /* ── الأسبوع الدراسي (2026-09-05) ────────────────────────────────
     يحتسب من **أول يوم دراسي للطلاب** الذي أدخله رئيس الشعبة في ش③،
     لا من يوم مباشرة المعلمين (يسبقه بأسبوع، ومن خلط بينهما اختل عده كله).
     الإرجاع: null = لا تاريخ · 0 = الأسبوع التمهيدي (ما قبل بدء الطلاب) · n ≥ 1.
     ⚠ الأسبوع يبدأ الأحد: نرد التاريخ إلى أحد أسبوعه كي تقع الحدود على الآحاد
       مهما كان اليوم الذي أدخله. */
  S.termStart = function () {
    var d = S.data(), t = d.term, m = d.termStart;
    return (m && t && m[t]) ? m[t] : '';
  };
  S.weekNo = function (today) {
    var iso = S.termStart();
    if (!iso) return null;
    var p = iso.split('-');
    if (p.length !== 3) return null;
    var start = new Date(+p[0], +p[1] - 1, +p[2]);
    if (isNaN(start.getTime())) return null;
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay());        // أحد أسبوع البداية
    var now = today ? new Date(today) : new Date();
    now.setHours(0, 0, 0, 0);
    now.setDate(now.getDate() - now.getDay());              // أحد الأسبوع الجاري
    var weeks = Math.round((now - start) / 604800000);
    return weeks < 0 ? 0 : weeks + 1;
  };
  /* نص الأسبوع للعرض — مصدر واحد فلا تختلف الشاشات في صياغته */
  S.weekLabel = function () {
    var n = S.weekNo();
    return n === null ? '' : n === 0 ? 'الأسبوع التمهيدي' : 'الأسبوع ' + n;
  };

  /* ── مواعيد الأسبوع (2026-09-06) ──────────────────────────────────
     { id, week, day, type, title } — **والأسبوع جزء من الموعد**، وإلا ظهر
     اجتماع هذا الأسبوع في كل أسبوع من العام. والموعد القديم بلا أسبوع
     (من بذرة المعاينة) يعرض في كل أسبوع ولا يسقط. */
  /* ⚠ الموعد يخزن **بتاريخه** (`date` بصيغة YYYY-MM-DD) لا برقم أسبوعه:
     التاريخ أصل يشتق منه اليوم والأسبوع معا، **وبه وحده يمكن إدخال موعد
     مستقبلي** — اختبار بعد ثلاثة أسابيع مثلا (رصده المستخدم 2026-09-06).
     ومواعيد قديمة بصيغة {week, day} تقرأ كما هي ولا تسقط. */
  S.events = function () { return (S.data().events || []).slice(); };
  S.eventsOnDate = function (iso) {
    return S.events().filter(function (e) { return e.date === iso; });
  };
  /* المواعيد التي لا تاريخ لها (صيغة قديمة) تنسب إلى يومها في الأسبوع المعروض */
  S.legacyEventsOfDay = function (day) {
    return S.events().filter(function (e) { return !e.date && e.day === day; });
  };
  S.eventsAfter = function (iso) {
    return S.events().filter(function (e) { return e.date && e.date > iso; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  };
  S.addEvent = function (ev) {
    var d = S.data();
    d.events = d.events || [];
    ev.id = 'e' + Date.now() + '-' + d.events.length;
    d.events.push(ev);
    S.save();
    return ev;
  };
  S.removeEvent = function (id) {
    var d = S.data();
    d.events = (d.events || []).filter(function (e) { return e.id !== id; });
    S.save();
  };

  /* (حذفت 2026-09-13 planSubjects وplanProgress وbehindPlan: كانت على نموذج قديم لم يملأ قط — d.plan وd.progress
     — فبقي قسم اللوحة «قيد الاعداد». البديل: خطط التوزيع المعتمدة ادناه (planLinks)، وما قطعه المعلم في سجل
     «ما قطع من المنهج» — الخطوة هـ — مصدر الانجاز الحق، فلا حكم بتأخر بلا تأشير) */

  /* ── خطط التوزيع المعتمدة (2026-09-13، الخطوة ج من بناء شريط الخطة) ────────
     ما تدرسه الشعبة من جداول معلميها («10/2 · الرياضيات» ⟵ الرياضيات · العاشر)، ولكل مادة وصف خطتها المعتمدة
     (ShoubaPlans في plan-data.js — من الخادم) او لا خطة، فيظهر مكانها «يجب رفع الخطة». والاسبوع الجاري من تقويم
     الخطط نفسها (تواريخ الوثائق بالاغلبية) لا بالعد — وتاريخ بدء الفصل الذي ادخله رئيس الشعبة بديل حين لا تقويم.
     ⚠ الخطط لا تدخل وثيقة الشعبة: بيانات مرجعية تمرر الى هذه الدوال. */
  var STAGE_BASE = { 'ابتدائي': 1, 'متوسط': 6, 'ثانوي': 10 };
  function latinNum(s) { return String(s == null ? '' : s).replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 0x660; }); }
  /* الاسم بلا فروق الهمزة والتاء والياء ولا ما ليس حرفا («التربية البدنية- بنين» ⟵ التربيهالبدنيهبنين) */
  function nameKey(s) { return String(s || '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[^ء-ي]/g, ''); }
  /* صف الفصل من رقمه: «10/2» ⟵ العاشر — بقاعدة المرحلة (الابتدائي من ١ · المتوسط من ٦ · الثانوي من ١٠) */
  S.gradeOfClass = function (cls) {
    var st = S.data().stage, n = parseInt(latinNum(String(cls || '').split('/')[0]), 10);
    var gs = (SHOUBA_REF.gradesByStage || {})[st] || [], g = gs[n - (STAGE_BASE[st] || 1)];
    return g ? g.grade : '';
  };
  /* ما تدرسه الشعبة: [{ subject, grade, classes, teachers }] بترتيب الصفوف ثم المواد.
     ⚠ يقرأ الجداول ولا يمسها (daySlots ينشئ اياما فارغة لمن لا جدول له) */
  S.planPairs = function () {
    var d = S.data(), sch = d.schedules || {}, map = {}, gs = ((SHOUBA_REF.gradesByStage || {})[d.stage] || []).map(function (g) { return g.grade; });
    Object.keys(sch).forEach(function (t) {
      Object.keys(sch[t] || {}).forEach(function (day) {
        (Array.isArray(sch[t][day]) ? sch[t][day] : []).forEach(function (v) {
          if (!v) return;
          var s = S.splitSlot(v), g = S.gradeOfClass(s.cls);
          if (!s.subject || !g) return;
          var k = g + '|' + s.subject, e = map[k] || (map[k] = { subject: s.subject, grade: g, classes: [], teachers: [] });
          if (s.cls && e.classes.indexOf(s.cls) < 0) e.classes.push(s.cls);
          if (e.teachers.indexOf(t) < 0) e.teachers.push(t);
        });
      });
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return (gs.indexOf(a.grade) - gs.indexOf(b.grade)) || (a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : 0); });
  };
  /* خطة الزوج من المعتمد: الصف بالاسم، والمادة تامة قبل البادئة («التربية البدنية» ⟵ «التربية البدنية- بنين»)،
     وبين خطتين للزوج الواحد (بنين · بنات) نوع المدرسة من الاعداد */
  S.planFor = function (pair, plans) {
    var g = nameKey(pair.grade), s = nameKey(pair.subject);
    var hits = (plans || []).filter(function (p) { return nameKey(p.grade) === g && nameKey(p.subject).indexOf(s) === 0; });
    var exact = hits.filter(function (p) { return nameKey(p.subject) === s; }), pool = exact.length ? exact : hits;
    if (pool.length > 1) {
      var ty = nameKey(S.data().schoolType || '');
      var byType = ty ? pool.filter(function (p) { return nameKey(p.subject + ' ' + ((p.source || {}).desc || '')).indexOf(ty) > -1; }) : [];
      if (byType.length) pool = byType;
    }
    return pool[0] || null;
  };
  /* الاسبوع من تقويم الخطط: { n, from, to } — n=0 قبل بدء الفصل، وبعد آخره آخره. والجمعة والسبت للاسبوع الذي مضى */
  S.planWeek = function (calendar, today) {
    var cal = (calendar || []).filter(function (w) { return w && w.from; });
    if (!cal.length) return null;
    var now = today ? new Date(today) : new Date();
    var iso = now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());
    if (iso < cal[0].from) return { n: 0, from: cal[0].from, to: cal[0].to };
    for (var i = cal.length - 1; i >= 0; i--) if (iso >= cal[i].from) return { n: cal[i].n, from: cal[i].from, to: cal[i].to };
    return null;
  };
  /* الربط كله في جواب واحد تسأله اللوحة وشاشة الخطة: { ready, week, pairs:[{…زوج, plan}], missing }.
     data من ShoubaPlans.get() ان لم تمرر؛ وready=false: لم تجلب الخطط بعد (فلا يقال «يجب رفع الخطة» ظلما) */
  S.planLinks = function (data, today) {
    if (data === undefined) data = (window.ShoubaPlans && ShoubaPlans.get(S.data().stage)) || null;
    var plans = data ? data.plans || [] : [];
    var pairs = S.planPairs().map(function (p) {
      return { subject: p.subject, grade: p.grade, classes: p.classes, teachers: p.teachers, plan: data ? S.planFor(p, plans) : null };
    });
    return { ready: !!data, week: data ? S.planWeek(data.calendar, today) : null, pairs: pairs,
             missing: data ? pairs.filter(function (p) { return !p.plan; }) : [] };
  };
  /* دروس الخطة في اسبوع: الصف الممتد اسابيع (الخطط الموزعة بالوحدة — span) يشمل اسابيعه كلها، والدرس المتكرر في
     حصص متتالية مرة بمجموع حصصه (خطط «لكل حصة درس»: الفهم والثروة اللغوية ثلاث حصص صفوفا ثلاثة) */
  S.planLessons = function (plan, n) {
    var out = [];
    ((plan && plan.weeks) || []).forEach(function (w) {
      if (!(n >= w.n && n <= w.n + (w.span || 1) - 1)) return;
      (w.lessons || []).forEach(function (l) {
        var last = out[out.length - 1];
        if (last && last.t === l.t) last.p += (l.p || 0); else out.push({ t: l.t, p: l.p || 0 });
      });
    });
    return out;
  };
  /* عدد اسابيع الخطة — آخر ما تغطيه صفوفها */
  S.planWeeksOf = function (plan) {
    return ((plan && plan.weeks) || []).reduce(function (m, w) { return Math.max(m, w.n + (w.span || 1) - 1); }, 0);
  };
  /* دروس الخطة مسطحة بترتيبها لتأشير ما قطع (سجل «ما قطع من المنهج» — الخطوة هـ): [{ n, end, t, p }] — n اسبوع
     الصف وend آخر اسابيعه، فالصف الممتد بالوحدة (span) درس واحد لا درس في كل اسبوع، والمكرر المتتالي في
     الاسبوع الواحد مدموج بمجموع حصصه كالشريط */
  S.planFlat = function (plan) {
    var out = [];
    ((plan && plan.weeks) || []).slice().sort(function (a, b) { return a.n - b.n; }).forEach(function (w) {
      var end = w.n + (w.span || 1) - 1, first = out.length;
      (w.lessons || []).forEach(function (l) {
        var last = out.length > first ? out[out.length - 1] : null;
        if (last && last.t === l.t) last.p += (l.p || 0); else out.push({ n: w.n, end: end, t: l.t, p: l.p || 0 });
      });
    });
    return out;
  };
  /* حكم ما قطع مقترحا (والقرار لرئيس الشعبة): الدرس الذي وصل اليه { n, end } والاسبوع الجاري في الخطة —
     'ahead' ان سبق اسبوعه الجاري · 'match' ان كان فيه او في الذي قبله (بداية الاسبوع ليست تأخرا) · 'behind' قبل ذلك.
     وقبل بدء الفصل (٠) يقاس بالاسبوع الاول */
  S.paceOf = function (lesson, week) {
    if (!lesson || !(week >= 0)) return '';
    var W = Math.max(1, week);
    return lesson.n > W ? 'ahead' : (lesson.end || lesson.n) >= W - 1 ? 'match' : 'behind';
  };
  /* مواد معلم وصفوفه بخططها — من الربط نفسه (planLinks) مقصورا على من يدرسها: { ready, week, pairs } */
  S.planPairsOf = function (teacher, data, today) {
    var L = S.planLinks(data, today);
    return { ready: L.ready, week: L.week, pairs: L.pairs.filter(function (p) { return p.teachers.indexOf(teacher) > -1; }) };
  };

  /* ===== ⑥ السجلات — محرك السجلات، المرحلة الاولى (2026-09-12) =====
     السجلات في الوثيقة نفسها تحت `recs` — فتزامن وتصدر وتستورد كبقية الشعبة.
     ⚠ لا `records`: ذاك مفتاح اسماء السجلات التي اختارها رئيس الشعبة في ش⑥.
     ⚠ القالب لا يخزن في الوثيقة: السجل يحمل رقمه واصداره، والقالب من rec-templates.js.
     ⚠ المرفقات (النسخة الموقعة · الشواهد) لا تدخل الوثيقة — في الخادم بمعرفها (الخطوة و).
     يعتمد على rec-engine.js حين ينادى (لا عند التحميل) — فلا يلزم ترتيب الوصل للشاشات بلا سجلات. */
  function E() { return window.ShoubaRec; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  /* تاريخ اليوم بتوقيت الجهاز (لا UTC — كان سيجعل ليل الكويت يوم امس) */
  S.today = function () { var t = new Date(); return t.getFullYear() + '-' + pad2(t.getMonth() + 1) + '-' + pad2(t.getDate()); };
  S.recs = function (tplId) {
    var a = (S.data().recs || []).slice();
    return tplId ? a.filter(function (r) { return r.tpl === tplId; }) : a;
  };
  S.rec = function (id) { return (S.data().recs || []).filter(function (r) { return r.id === id; })[0] || null; };
  /* سجل جديد من احدث اصدار — لا يحفظ حتى يكتب فيه (S.saveRec)، فالفتح والتراجع لا يتركان مسودة فارغة */
  /* سياق انشاء السجل من الاعداد — مصدر واحد للجديد والمنسوخ */
  function recCtx(who, tplId) {
    var d = S.data();
    return { today: S.today(), year: d.year || '', term: d.term || '', teachers: S.teachers(),
      records: S.recs(), school: d.schoolName || '', directorate: S.directorate(), who: who || '',
      pick: (d.recPick || {})[tplId] || null };   /* عناصر النموذج المختارة — لقطتها في السجل الجديد */
  }
  S.newRec = function (tplId, who) {
    var t = E() && E().latest(tplId);
    if (!t) return null;
    return E().create(t, recCtx(who, tplId));
  };
  /* النسخ الى الفصل الحالي (المرحلة الثانية هـ): ShoubaRec.copyOf بسياق الاعداد، واشهر الفصلين من المرجعية
     (فيقابل كل شهر موضعه)، ثم يحفظ — ويعيد السجل الجديد */
  S.copyRec = function (src) {
    var d = S.data(), tm = (window.SHOUBA_REF || {}).termMonths || {}, ctx = recCtx(src && src.who, src && src.tpl);
    ctx.monthMap = { from: tm[src && src.term] || [], to: tm[d.term] || [] };
    var r = E() && E().copyOf(src, ctx);
    if (r) S.saveRec(r);
    return r;
  };
  /* آخر سجل للقالب من فصل غير الحالي — مصدر «انسخ خطة الفصل السابق» في الارشيف */
  S.prevTermRec = function (tplId) {
    var d = S.data(), g = E() ? E().archive(S.recs(tplId)).filter(function (x) {
      return !(x.year === (d.year || '') && x.term === (d.term || ''));
    })[0] : null;
    return g ? g.items[0] : null;
  };
  S.saveRec = function (rec) {
    var d = S.data();
    d.recs = d.recs || [];
    rec.updated = new Date().toISOString();
    var i = -1;
    d.recs.forEach(function (r, k) { if (r.id === rec.id) i = k; });
    if (i > -1) d.recs[i] = rec; else d.recs.push(rec);
    S.save();
    return rec;
  };
  S.removeRec = function (id) {
    var d = S.data();
    d.recs = (d.recs || []).filter(function (r) { return r.id !== id; });
    S.save();
  };
  /* حذف السجل وملفاته (النسخة الموقعة والمرفقات) — مصدر واحد لكل شاشة تحذف (2026-09-11).
     الملفات يطلب حذفها من الخادم ان حملت الشاشة rec-files.js، وما فات تلتقطه المصالحة في الخادم */
  S.deleteRec = function (rec) {
    var F = window.ShoubaFiles;
    if (F && E()) E().files(rec).forEach(function (f) { F.remove(f); });
    S.removeRec(rec.id);
  };
  /* عناصر النموذج التي اختارها رئيس الشعبة لشبكة (قرار المستخدم 2026-09-12) — للشعبة كلها:
     d.recPick[قالب] = { معرف الجدول: [معرفات اعمدة ✓] }. والسجل يحفظ لقطته يوم انشائه (ShoubaRec.create) */
  S.pickOf = function (tplId) { return (S.data().recPick || {})[tplId] || null; };
  S.setPick = function (tplId, map) { var p = S.data().recPick || {}; p[tplId] = map; S.save({ recPick: p }); };
  S.colsOf = function (rec, b, tplId) { return E() ? E().colsOf(rec, b, S.pickOf((rec && rec.tpl) || tplId)) : ((b && b.columns) || []); };   /* tplId: للنموذج الفارغ بلا سجل */
  S.archive = function (tplId, opt) { return E().archive(S.recs(tplId), opt); };
  /* ما ينتظر اجراء في خطط الفصل الحالي (المرحلة الثانية ج) — لقسم «بحاجة الى اجراء» في اللوحة:
     سجلات العام والفصل الحاليين، والشهر الحالي، واشهر الفصل من المرجعية ⟵ ShoubaRec.due.
     عام لكل قالب فيه جدول باشهر ومتابعة (لا اسم قالب بعينه). now اختياري (للفحص) */
  S.opDue = function (now) {
    var d = S.data(), R = E(), ref = window.SHOUBA_REF || {};
    if (!R) return [];
    var cur = (now || new Date()).getMonth() + 1, order = (ref.termMonths || {})[d.term] || [], out = [];
    S.recs().filter(function (r) { return (r.year || '') === (d.year || '') && (r.term || '') === (d.term || ''); })
      .forEach(function (r) { R.due(r, cur, order).forEach(function (x) { x.rec = r.id; out.push(x); }); });
    return out.sort(function (a, b) { return (b.late ? 1 : 0) - (a.late ? 1 : 0); });
  };
  S.openDecisions = function (rec) { return E().openDecisions(S.recs(rec.tpl), rec); };
  S.stillOpen     = function (rec) { return E().stillOpen(S.recs(rec.tpl), rec); };

  /* ===== ⑤ صيغ الأسماء (تستعمل في كل الشاشات) ===== */
  S.lastName = function (n) {
    var p = String(n || '').trim().split(' ').filter(Boolean);
    return p[p.length - 1] || n;
  };
  S.firstNameOf = function (n) { return String(n || '').trim().split(' ')[0] || n; };
})();
