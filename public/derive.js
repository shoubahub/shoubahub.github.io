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

  /* ===== ① المصدر: نقطة قراءة وكتابة واحدة =====
     ⚠ **الجهاز أوّلاً، والخادم بعده**: الكتابة تُحفظ محلّياً في الحال فتظهر
       فوراً بلا انتظار شبكة، ثم تُرسَل بعد سكونٍ قصير. فالإدخال لا يتغيّر
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

  /* ===== ①ب المزامنة: رقمُ مراجعةٍ من الخادم لا ساعةُ جهاز (2026-09-10) =====
     ⚠ كانت تقارن الأوقات «الأحدث يقود»، فانكسرت في ثلاث:
       · جهازٌ بلا ختمٍ سابق عَدّ كلّ ما على الخادم أحدث، فمحا نسخته بصمت
         وأعلن «من جهازٍ آخر» ولا جهاز آخر (رُصد بالفحص).
       · ساعةُ جوّالٍ غير مضبوطة تقلب الترتيب فتُطمَس كتابةٌ صحيحة.
       · وحسابٌ ثانٍ على الجهاز نفسه كان يرث نسخة من قبله.
     الآن: كل حفظٍ على الخادم يرفع رقم المراجعة، والجهاز يحفظ آخر رقمٍ بنى
     عليه ويرسل «بنيتُ على كذا». فإن سبقه غيرُه رفض الخادم وأعاد نسخته،
     **ولا يُحسم الخلاف بقاعدةٍ صامتة بل يُعرض على صاحبه**.
     ⚠ و«هل عُدِّل هنا ما لم يُرسَل؟» تُعرف **ببصمة آخر نسخةٍ متزامنة** (BASE)
       لا براية يرفعها الكاتب: شاشات الإعداد تكتب في الجهاز مباشرةً فلا ترفع
       راية، فكان تعديلها يُمحى بصمت إن تقدّم الخادم. البصمة تكشف كلّ تغيير
       أيّاً كان كاتبه.
     ⚠ لا DOM هنا: الخلاف يُسلَّم عبر S.onConflict، وحال الحفظ عبر S.onSyncState،
       والشاشة تبنيهما في components.js. */
  var online = false, timer = null, sending = false, again = false;
  S.conflict = null;

  function ls(k)       { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k)    { try { localStorage.removeItem(k); } catch (e) {} }
  lsDel('shouba.sync'); lsDel('shouba.dirty');          /* مفاتيح نظام الأوقات البائد */

  function getRev()  { var v = parseInt(ls(REV), 10); return isNaN(v) ? null : v; }
  function setRev(v) { lsSet(REV, String(v)); }

  /* مقارنةٌ لا يغيّرها ترتيب المفاتيح */
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
  /* بلا بصمةٍ سابقة يُعَدّ معدَّلاً — فالمجهول يُسأل عنه ولا يُطمَس */
  function isDirty() { var b = ls(BASE); return !b || b !== snap(S.data(true)); }
  function same(a, b) { return canon(a || {}) === canon(b || {}); }
  function blank(d)   { return !d || typeof d !== 'object' || Object.keys(d).length === 0; }

  function adopt(d, rev) {                  /* نسخة الخادم تصير نسخة الجهاز */
    cache = d || {};
    localStorage.setItem(KEY, JSON.stringify(cache));
    setRev(rev); mark(cache);
  }
  function note(bad) {
    if (typeof S.onSyncState === 'function') { try { S.onSyncState(!!bad); } catch (e) {} }
  }
  function raise(j, quiet) {
    S.conflict = { local: S.data(), server: j.data || {}, serverRev: j.rev || 0, serverAt: j.updatedAt || '' };
    if (!quiet && typeof S.onConflict === 'function') { try { S.onConflict(S.conflict); } catch (e) {} }
  }

  function push() {
    if (!online || S.conflict) return;      /* لا إرسال والخلاف معلّق */
    clearTimeout(timer);
    timer = setTimeout(send, 1200);         /* سكونٌ قصير — لا مع كل حرف */
  }

  /* ⚠ ٤٠١ = انتهت الجلسة (أُعيد تعيين الرقم، أو مضت مدّتها) — **ليست انقطاعاً**.
     كانت تُعامَل «بلا إنترنت» فتُعاد المحاولة كل ١٥ ثانية أبداً، وصاحبها يظنّ
     عمله يُحفظ (رُصد 2026-09-10). الآن يتوقّف الإرسال ويُعلَن لصاحبه، وتبقى
     تعديلاته على الجهاز: بعد الدخول يراها الإقلاع (connect) معدَّلةً فيرفعها. */
  function authLost() {
    online = false; clearTimeout(timer); S.authLost = true;
    if (typeof S.onAuthLost === 'function') { try { S.onAuthLost(); } catch (e) {} }
  }

  /* يرسل الوثيقة مبنيّةً على مراجعة، ويعيد: 'ok' · 'conflict' · 'auth' · 'offline' */
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

  /* الإقلاع: يُنادى من components.js بعد تحميل الصفحة.
     يعيد 'ok' · 'conflict' · 'none' (بلا خادمٍ أو بلا جلسة). */
  S.connect = function () {
    if (!window.fetch) return Promise.resolve('none');
    return fetch('api/data', { credentials: 'same-origin' }).then(function (r) {
      /* ⚠ ٤٠٤ = نسخةٌ ساكنة بلا خادم (العنوان القديم على GitHub Pages)،
         وتفترق عن ٤٠١ = خادمٌ بلا جلسة. الأولى وحدها تستدعي تنبيه الانتقال. */
      if (r.status === 404) { S.serverless = true; return 'none'; }
      if (!r.ok) return 'none';
      return r.json().then(function (res) {
        online = true;
        /* نسخةٌ محلّية لصاحبٍ آخر لا تُقارَن ولا تُرفَع — تُطوى */
        var owner = ls(OWNER);
        if (owner && res.user && owner !== res.user) {
          lsDel(KEY); lsDel(REV); lsDel(BASE); cache = null;
        }
        if (res.user) lsSet(OWNER, res.user);

        var mine = S.data(true), srv = res.data, rev = res.rev || 0, base = getRev();
        if (blank(srv)) {                   /* الخادم لا يملك شيئاً */
          if (!blank(mine)) send();         /* ترحيل: يرتفع ما على الجهاز */
          return 'ok';
        }
        if (blank(mine))     { adopt(srv, rev); return 'ok'; }
        if (same(mine, srv)) { setRev(rev); mark(srv); return 'ok'; }
        /* مختلفان */
        if (base === rev) { send(); return 'ok'; }          /* الخادم لم يتغيّر منذ بنينا ⟵ تعديلاتنا ترتفع */
        if (base !== null && base < rev && !isDirty()) {     /* تقدّم الخادم ولا عمل هنا لم يُرسَل */
          adopt(srv, rev); S.updatedElsewhere = true; return 'ok';
        }
        /* خلافٌ حقيقي، أو أصلٌ مجهول (نسخةٌ لم تُرقَّم قطّ) ⟵ يُسأل صاحبه */
        raise({ data: srv, rev: rev, updatedAt: res.updatedAt });
        return 'conflict';
      });
    }).catch(function () { return 'none'; });
  };
  S.online = function () { return online; };

  /* حسم الخلاف باختيار صاحبه — والنسخة المتروكة تُحفظ على الجهاز احتياطاً */
  S.resolve = function (keep) {
    var c = S.conflict;
    if (!c) return Promise.resolve('ok');
    lsSet(KEY + '.discarded', JSON.stringify({ at: new Date().toISOString(), kept: keep,
      data: keep === 'mine' ? c.server : c.local }));
    S.conflict = null;
    if (keep === 'server') { adopt(c.server, c.serverRev); return Promise.resolve('ok'); }
    cache = c.local;
    localStorage.setItem(KEY, JSON.stringify(cache));
    return put(c.serverRev);                /* «بنيتُ على نسختك» ⟵ تُقبل ما لم يسبقها ثالث */
  };

  /* ===== ①ج قابلية النقل: تصدير الشعبة واستيرادها (2026-09-10) =====
     ميزةٌ دائمة لا جسرٌ مؤقّت — قرار المستخدم: «حلولٌ جذرية لا ترقيعية».
     أوّل استعمالها نقلُ ما على العنوان القديم، ثم تبقى للنسخ الاحتياطي،
     ولتسليم الشعبة لمن يخلف رئيسها، وللانتقال بين المدارس.
     ⚠ الصيغة **مُرقَّمة** (version): فيقرأ إصدارٌ قادم ملفّاتِ اليوم،
       ويرفض الإصدارُ القديم ملفّاً أحدث منه بدل أن يسيء قراءته.
     ⚠ لا DOM ولا نصّ عرض هنا — رموز أخطاء فقط، والنصّ في components.js. */
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
      events: Array.isArray(d.events) ? d.events.length : 0
    };
  };

  /* يتحقّق ولا يكتب شيئاً — يعيد { ok, data, summary } أو { ok:false, error } */
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

  /* يستبدل الوثيقة كاملةً لا يدمجها — والسابقة تُحفظ على الجهاز قبل الاستبدال،
     فالاستيراد بالخطأ يُستردّ ولا يُفقد به عمل. */
  S.replace = function (d) {
    var prev = ls(KEY);
    if (prev && prev !== '{}') lsSet(KEY + '.before-import', prev);
    cache = d;
    localStorage.setItem(KEY, JSON.stringify(d));
    push();
    return d;
  };

  /* إرسالٌ فوريّ ينتظره المُنادي — لازمٌ قبل مغادرة الصفحة بعد الاستيراد:
     الإرسال المؤجَّل يموت بموت الصفحة.
     overwrite: الاستيراد استبدالٌ صريحٌ بعد تحذير، فإن سبقه حفظٌ على الخادم
     بُني على رقمه الحالي، ولا يُعرض خلافٌ على من اختار الاستبدال للتوّ. */
  S.flush = function (overwrite) {
    clearTimeout(timer);
    if (!online) return Promise.resolve('offline');
    return put(getRev() || 0, overwrite).then(function (res) {
      if (res !== 'conflict' || !overwrite) return res;
      var c = S.conflict; S.conflict = null;
      return put(c.serverRev, true);
    });
  };


  /* ===== ①ب الترحيل: أسماء الأقسام تبدّلت مع بيانات الوزارة (2026-09-07) =====
     مَن أعدّ شعبته على الأسماء القديمة يجدها باسمها الجديد بلا أن يفعل شيئاً.
     ⚠ ويُمحى **مخزون المواد** المحفوظ لحظةَ الإعداد: أسماء المقرّرات تبدّلت
       كلّها إلى أسماء الوزارة، فالمخزون القديم يحجب الجديد لو بقي.
     يُنفَّذ مرّة واحدة ويترك أثراً (refDataVersion) فلا يتكرّر. */
  var REF_VERSION = 2;
  (function migrate () {
    var d = S.data();
    if (!d.stage || d.refDataVersion === REF_VERSION) return;
    var now = SHOUBA_REF.departmentOf(d.stage, d.department || '');
    if (now !== d.department) d.department = now;
    delete d.subjects;                       // تُشتقّ من جديد
    d.refDataVersion = REF_VERSION;
    localStorage.setItem(KEY, JSON.stringify(d));
    cache = d;
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
  /* كل معلّمي الشعبة (المسجَّلون في ش⑤) */
  S.teachers   = function () { return (S.data().teachers || []).slice(); };
  /* مَن أُدخل جدوله فقط — وعليه تُحسب أعداد «يدرّسون / متفرّغون»،
     لأن مَن لا جدول له لا يُعرف موضعه فلا يُعدّ متفرّغاً. */
  /* ⚠ «له جدول» = فيه خانة واحدة مملوءة على الأقلّ — لا مجرّد وجود المفتاح.
     فتح شاشة الجداول يُنشئ مصفوفات فارغة لكل اسم، فكان مجرّد المرور بها يُسقط
     تذكير «لم يُدخل جدوله بعد» ويَعُدّ المعلّم «متفرّغاً» ونحن لا نعرف جدوله
     أصلاً — وهو اختلاقٌ من جنس بند الاتّهام المحذوف (رُصد 2026-09-05). */
  S.hasSchedule = function (t) {
    var day = (S.data().schedules || {})[t];
    if (!day) return false;
    return Object.keys(day).some(function (k) {
      return (day[k] || []).some(function (v) { return !!v; });
    });
  };
  S.scheduled  = function () { return Object.keys(S.data().schedules || {}).filter(S.hasSchedule); };
  S.withoutSchedule = function () { return S.teachers().filter(function (t) { return !S.hasSchedule(t); }); };
  /* رئيس الشعبة نفسه — يدرّس أيضاً، فله جدول ونصاب ويدخل في حساب التعارض.
     ⚠ ولا يُدرَج في teachers(): ليس من معلّميه بل رئيسهم، فلا يُعدّ في «معلّموك»
       ولا يُذكَّر بنفسه في «بحاجة إلى إجراء» (قرار المستخدم 2026-09-05). */
  S.self = function () {
    try { return (JSON.parse(localStorage.getItem('shouba.user')) || {}).name || ''; }
    catch (e) { return ''; }
  };
  /* كل مَن يظهر في الجدول: رئيس الشعبة أولاً · ثم معلّموه · ثم كل من له جدول
     (احتياطاً لاسم لم يعد في القائمة). بلا تكرار. */
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
  /* المواد التي يدرّسها معلّم فعلاً — تُشتقّ من جدوله لا تُدخَل:
     [{ name:'الفلسفة', classes:['12/2','12/3'], periods:6 }] مرتّبةً بالأكثر حصصاً. */
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
  /* ── الأسبوع الدراسي (2026-09-05) ────────────────────────────────
     يُحتسب من **أوّل يوم دراسي للطلاب** الذي أدخله رئيس الشعبة في ش③،
     لا من يوم مباشرة المعلّمين (يسبقه بأسبوع، ومن خلط بينهما اختلّ عدّه كلّه).
     الإرجاع: null = لا تاريخ · 0 = الأسبوع التمهيدي (ما قبل بدء الطلاب) · n ≥ 1.
     ⚠ الأسبوع يبدأ الأحد: نردّ التاريخ إلى أحدِ أسبوعه كي تقع الحدود على الآحاد
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
  /* نصّ الأسبوع للعرض — مصدر واحد فلا تختلف الشاشات في صياغته */
  S.weekLabel = function () {
    var n = S.weekNo();
    return n === null ? '' : n === 0 ? 'الأسبوع التمهيدي' : 'الأسبوع ' + n;
  };

  /* ── مواعيد الأسبوع (2026-09-06) ──────────────────────────────────
     { id, week, day, type, title } — **والأسبوع جزءٌ من الموعد**، وإلّا ظهر
     اجتماعُ هذا الأسبوع في كل أسبوع من العام. والموعد القديم بلا أسبوع
     (من بذرة المعاينة) يُعرض في كل أسبوع ولا يُسقَط. */
  /* ⚠ الموعد يُخزَّن **بتاريخه** (`date` بصيغة YYYY-MM-DD) لا برقم أسبوعه:
     التاريخ أصلٌ يُشتقّ منه اليوم والأسبوع معاً، **وبه وحده يمكن إدخال موعد
     مستقبليّ** — اختبارٌ بعد ثلاثة أسابيع مثلاً (رصده المستخدم 2026-09-06).
     ومواعيد قديمة بصيغة {week, day} تُقرأ كما هي ولا تُسقَط. */
  S.events = function () { return (S.data().events || []).slice(); };
  S.eventsOnDate = function (iso) {
    return S.events().filter(function (e) { return e.date === iso; });
  };
  /* المواعيد التي لا تاريخ لها (صيغة قديمة) تُنسب إلى يومها في الأسبوع المعروض */
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

  /* المواد التي لها خطة منهج */
  S.planSubjects = function () { return Object.keys(S.data().plan || {}); };
  /* تقدّم المنهج: { total, done, pct, cells:[{done,now}] } */
  S.planProgress = function () {
    var d = S.data(), plan = d.plan || {}, progress = d.progress || {}, week = S.weekNo() || 1;
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
    var d = S.data(), plan = d.plan || {}, progress = d.progress || {}, week = S.weekNo() || 1;
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
