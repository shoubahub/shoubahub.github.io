/* ===================================================================
   شعبة · سلوك المكوّنات المشتركة
   القائمة المنسدلة = لوحة سفلية (Bottom Sheet) بهوية المنصّة.
   البنية: <div class="sdrop" data-label="..."> <button class="trigger">…</button>
           <select> ...options... </select> </div>
   الـ<select> المخفيّ هو مصدر البيانات والقيمة (يبقى للنماذج والتحقّق).
   =================================================================== */
/* هوية المستخدم — مصدر واحد للشخصنة (الاسم كترويسة، الاسم الأول للترحيب) */
window.Shouba = window.Shouba || {};
Shouba.user = function () { try { return JSON.parse(localStorage.getItem('shouba.user')) || {}; } catch (e) { return {}; } };
Shouba.firstName = function () { var n = (Shouba.user().name || '').trim(); return n ? n.split(/\s+/)[0] : ''; };
/* يملأ أي عنصر يحمل data-hi بترحيب شخصي بلقب الأستاذية: «أهلًا، أ. محمد» (أو نصّه الاحتياطي إن لم يوجد اسم) */
Shouba.greet = function () {
  var f = Shouba.firstName();
  [].forEach.call(document.querySelectorAll('[data-hi]'), function (el) {
    if (f) el.textContent = 'أهلًا، أ. ' + f;
  });
};
document.addEventListener('DOMContentLoaded', function () { Shouba.greet(); });

/* تصريف المعدود عربياً — مصدر واحد لكل العدّادات:
   ١ مفرد · ٢ مثنّى · ٣–١٠ جمع · ١١+ تمييز مفرد منصوب.
   الصيغ: { one:'معلّم', two:'معلّمان', few:'معلّمين', many:'معلّماً' } */
Shouba.unit = function (n, f) {
  return n === 1 ? f.one : n === 2 ? f.two : (n >= 3 && n <= 10) ? f.few : f.many;
};
Shouba.count = function (n, f) {
  /* ⚠ «واحد» تُؤنَّث تبعاً للمعدود: «معلّم واحد» و«حصة واحدة».
     كانت مذكّرةً دائماً فأنتجت «حصة واحد» (رُصد 2026-09-05). */
  if (n === 1) return f.one + (/ة$/.test(f.one) ? ' واحدة' : ' واحد');
  if (n === 2) return f.two;
  return n + ' ' + Shouba.unit(n, f);
};


/* الاسم المختصر للعرض: الاسم الأول + اسم العائلة (قاعدة المستخدم 2026-08-27)
   «محمد عبدالله سعد البرّاك» ← «محمد البرّاك» · الاسم المفرد يبقى كما هو.
   التخزين يبقى بالاسم الكامل — الاختصار للعرض فقط. */
Shouba.shortName = function (full) {
  var p = String(full || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!p.length) return '';
  return p.length > 1 ? p[0] + ' ' + p[p.length - 1] : p[0];
};

/* وجهة العودة بعد تعديل سطر من شاشة مراجعة — مصدر واحد لكل شاشات المعالج:
   ?ret=review ⟵ مراجعة المنتصف · ?ret=final ⟵ المراجعة النهائية · بلا وسم = المسار الأمامي */
Shouba.returnTo = function () {
  var r = new URLSearchParams(location.search).get('ret');
  /* ret=board يُستعمل بعد الإعداد: شاشة معالج تُفتح من اللوحة لتعديل بيانات، ثم تعود إليها */
  return r === 'final'  ? 'setup-wizard-7.html'
       : r === 'review' ? 'setup-review.html'
       : r === 'board'  ? 'board.html'
       : r === 'records'? 'records.html' : '';
};

(function () {
  var backdrop, sheet, list, titleEl;

  function check() {
    return '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6.4 L4.6 9 L10 3" stroke="#F4F1EA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function ensure() {
    if (sheet) return;
    backdrop = document.createElement('div');
    backdrop.className = 'sheet-backdrop';
    sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.innerHTML = '<div class="grab"></div><div class="sheet-title"></div><div class="sheet-list"></div>';
    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);
    titleEl = sheet.querySelector('.sheet-title');
    list = sheet.querySelector('.sheet-list');
    backdrop.addEventListener('click', close);
  }

  function open(drop) {
    ensure();
    var sel = drop.querySelector('select');
    titleEl.textContent = drop.dataset.label || 'اختر';
    list.innerHTML = '';
    [].forEach.call(sel.options, function (o) {
      if (o.disabled && o.value === '') return;            // تجاهل عنصر الـplaceholder
      var isOn = o.selected && o.value !== '';
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sheet-opt' + (isOn ? ' on' : '');
      b.innerHTML = '<span>' + o.textContent + '</span><span class="mk">' + (isOn ? check() : '') + '</span>';
      b.addEventListener('click', function () { choose(drop, o.value, o.textContent); });
      list.appendChild(b);
    });
    list.scrollTop = 0;
    document.body.style.overflow = 'hidden';
    backdrop.classList.add('open');
    reveal();
  }

  /* إظهار اللوحة — **بلا requestAnimationFrame** (إصلاح 2026-09-08):
     rAF لا يُطلَق في تبويبٍ غير مرئيّ ولا حين يخنقه المتصفّح، فكانت الخلفية
     تسودّ واللوحة لا تظهر — رُصد بالقياس: backdrop.open=true و sheet.open=false.
     وقراءة offsetWidth تُجبر إعادة التخطيط فيبقى الانتقال سلساً بلا مؤقّت. */
  /* الإظهار متزامن: نُجبر إعادة التخطيط ليُحسب الانتقال من الحالة المغلقة،
     ثم نضيف الصنف في النبضة نفسها.
     ⚠ كان هنا حارسُ سباق (sheetPending) بقي من زمن requestAnimationFrame؛
       ولمّا صار الإظهار متزامناً لم يبقَ سباقٌ يُحرس منه، **وصار الحارس هو العلّة**:
       مسار المنسدلات لا يرفع الراية، فترفض اللوحةُ الظهور وتبقى الخلفية سوداء وحدها
       (رصده المستخدم في «اختيار الشعبة» 2026-09-08). فأُزيل من أصله. */
  function reveal() {
    void sheet.offsetWidth;
    sheet.classList.add('open');
  }

  function choose(drop, val, txt) {
    var sel = drop.querySelector('select');
    sel.value = val;
    var v = drop.querySelector('.val');
    v.textContent = txt;
    v.classList.remove('ph');
    sel.dispatchEvent(new Event('change', { bubbles: true }));   // يُبقي التحقّق الحالي يعمل
    close();
  }

  function close() {
    if (!sheet) return;
    sheet.classList.remove('open');
    backdrop.classList.remove('open');
    document.body.style.overflow = '';
  }

  function init() {
    [].forEach.call(document.querySelectorAll('.sdrop'), function (drop) {
      var sel = drop.querySelector('select');
      var trig = drop.querySelector('.trigger');
      var v = drop.querySelector('.val');
      var s = sel.options[sel.selectedIndex];
      if (s && s.value) { v.textContent = s.textContent; v.classList.remove('ph'); }  // استرجاع قيمة محفوظة
      trig.addEventListener('click', function () { open(drop); });
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  /* لوحة سفلية عامّة لأي محتوى (شبكة رموز مثلاً) — تعيد استعمال نفس العنصر */
  Shouba.sheet = {
    open: function (title, node) {
      ensure();
      titleEl.textContent = title || '';
      list.innerHTML = '';
      list.appendChild(node);
      list.scrollTop = 0;
      document.body.style.overflow = 'hidden';
      backdrop.classList.add('open');
      reveal();
    },
    close: function () { close(); }
  };

  /* قائمة الإعدادات — سلوك مشترك لكل الشاشات ذات الرأس الكحلي.
     تحمل ما يحتاجه المجرّب: مراجعة بياناته · حدود النسخة ورقمها. */
  Shouba.settings = function () {
    var n = document.createElement('div');
    n.className = 'setlist';

    function item(title, sub, onClick) {
      var b = document.createElement('button');
      b.className = 'setitem';
      b.innerHTML = '<b>' + title + '</b>' + (sub ? '<small>' + sub + '</small>' : '');
      if (onClick) b.addEventListener('click', onClick);
      else b.disabled = true;
      n.appendChild(b);
      return b;
    }

    item('مراجعة بيانات شعبتك', 'المدرسة · الشعبة · العام · الإشراف', function () {
      location.href = 'setup-wizard-7.html';
    });

    var note = document.createElement('div');
    note.className = 'setnote';
    note.innerHTML = '<b>بياناتك على جهازك</b> — لا تُرسَل إلى خادم، ولا نراها.'
                   + ' وإن مسحتَ متصفّحك أو بدّلت جهازك بدأتَ من جديد.';
    n.appendChild(note);

    var ver = document.createElement('div');
    ver.className = 'setver';
    /* الدلالي للمستخدم والبناء لنا — في سطر واحد */
    ver.textContent = 'نسخة تجريبية ' + (window.SHOUBA_VERSION || '؟')
                    + ' · بناء ' + (window.SHOUBA_BUILD || '؟');
    n.appendChild(ver);

    Shouba.sheet.open('الإعدادات', n);
  };

  /* زرّ «+» الأوسط — باب الإجراءات السريعة (قرار المستخدم 2026-09-06).
     كان يفتح شاشة المعلّمين ولها تبويبها بجانبه، فكان يكرّر موجوداً؛ وصار
     يحمل ما لا موضع له في الشريط — وفيه **الإعدادات** التي كانت مخفيّة خلف
     مربّع رقم النسخة، فلمّا صار الرقمُ ملصقاً فقد الزرُّ دلالته. */
  Shouba.quickAdd = function () {
    var n = document.createElement('div');
    n.className = 'setlist';

    function row(title, sub, go) {
      var b = document.createElement('button');
      b.className = 'setitem';
      b.innerHTML = '<b>' + title + '</b><small>' + sub + '</small>';
      b.addEventListener('click', go);
      n.appendChild(b);
    }

    row('أضِف معلّماً', 'اسمه فقط — وجدوله يُدخل بعده', function () {
      location.href = 'teachers.html?add=1';
    });
    row('أضِف موعداً', 'اختبار · اجتماع · فعالية — في أيّ يوم من عامك', function () {
      location.href = 'board.html?add=event';
    });
    row('الإعدادات', 'مراجعة بيانات شعبتك ونسختها', function () {
      Shouba.settings();
    });

    Shouba.sheet.open('إضافة سريعة', n);
  };

  /* تبويب قيد الإعداد: يبقى ظاهراً ليُعرف شكل المنصّة، والضغطة تصرّح بحاله
     بدل أن تفتح صفحة ناقصة. سلوك مشترك ⟵ موضعه هنا لا في الشاشات. */
  function bindSoon() {
    [].forEach.call(document.querySelectorAll('.tab[data-soon]'), function (b) {
      b.addEventListener('click', function () {
        var n = document.createElement('div');
        n.className = 'soon-note';
        n.textContent = 'قسم «' + b.dataset.soon + '» قيد الإعداد، ويصل في تحديث قادم.'
                      + ' وحتى ذلك الحين، اللوحة وجدولك يعملان كاملَين.';
        Shouba.sheet.open('قيد الإعداد', n);
      });
    });
  }

  /* ── عامل الخدمة (2026-09-06) ────────────────────────────────────
     يجلب **الصفحات من الشبكة أولاً** والأصول المبصومة من المخزن، ويعمل بلا
     إنترنت. فالتحديث يصل بمجرّد الفتح: صفحةٌ جديدة تشير إلى أصولٍ ببصمة جديدة.

     ⚠ كان هنا «تحديثٌ ذاتي» يمسح المخازن ويُعيد التحميل عند كل نسخة أحدث —
       فأنتج **تحميلاً مزدوجاً مرئياً** يظنّه المستخدم بطئاً أو ضياعاً للبيانات
       (رصده المستخدم بعد عشر نسخ في يوم 2026-09-06). وهو زائدٌ ما دام العامل
       يجلب الصفحات من الشبكة. **ولا يمسّ localStorage بحال — البيانات آمنة.** */
  function serviceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  /* ── تنبيه المخزن المستقلّ (2026-09-06) ──────────────────────────
     ⚠ في iOS: التطبيق المثبَّت على الشاشة الرئيسية له **مخزنٌ مستقلّ عن سفاري**
       وإن كان العنوان واحداً. فمن أدخل بياناته في سفاري ثم ثبّت الأيقونة، فتحها
       فوجدها فارغة — **فيظنّ عمله ضاع ويترك المنصّة**، وهو أسوأ انطباع ممكن.
       لا حيلة في الجمع بينهما ما دامت البيانات على الجهاز؛ يحلّه الخادم لاحقاً.
       فنُصرّح بالسبب بدل أن يُترك للظنّ (رصده المستخدم على جهازه). */
  function standaloneNote() {
    var standalone = window.matchMedia('(display-mode: standalone)').matches
                  || window.navigator.standalone === true;
    if (!standalone) return;
    var fresh = !localStorage.getItem('shouba.setup') && !localStorage.getItem('shouba.user');
    if (!fresh) return;
    /* داخل .content لا في body — وإلّا خرج التنبيه عن إطار الشاشة */
    var host = document.querySelector('.screen .content') || document.querySelector('.screen');
    if (!host) return;
    var n = document.createElement('div');
    n.className = 'sepnote';
    n.innerHTML = '<b>بدأتَ في المتصفّح؟ بياناتك هناك.</b>'
                + ' التطبيق المثبَّت على الشاشة الرئيسية له مخزنٌ مستقلّ عن المتصفّح —'
                + ' فأكمِل حيث بدأت، أو ابدأ من هنا وألزَمْه.';
    host.appendChild(n);
  }

  /* رقم النسخة في كل شاشة — طلب المستخدم (2026-09-07): من يعثر على خلل في
     أيّ شاشة يجب أن يقرأ نسخته دون أن يعود إلى البداية.
     ⚠ يُحقن عنصرٌ مستقلّ لا نصٌّ داخل سطرٍ قائم: أسطر الشريط تُكتب بـtextContent
       من كل شاشة، فأيّ عنصر بداخلها يُمحى عند أوّل تحديث لها.
     واللوحة وشاشة الدخول لهما موضعهما الخاصّ (#verNo) فتُترَكان. */
  function versionTag() {
    if (document.getElementById('verNo')) return;
    var host = document.querySelector('.topbar')
            || document.querySelector('.navrow .prog .lbl')
            || document.querySelector('.navrow');
    if (!host || host.querySelector('.vertag')) return;
    var t = document.createElement('span');
    t.className = 'vertag';
    t.textContent = window.SHOUBA_VERSION || '';
    host.appendChild(t);
  }

  /* ═══ لوحة المفاتيح لا تحجب زرّ الإجراء (مراجعة الآيباد 2026-09-08) ═══
     على iOS يبقى العنصر الثابت في مكانه حين تُفتح لوحة المفاتيح فتغطّيه —
     ويقع ذلك في كل شاشةٍ فيها حقلُ كتابةٍ وزرٌّ سفلي، وفي لوحات الإدخال.
     نقيس ما تشغله من المساحة المرئية ونكتبه في --kb، فترتفع بمقداره.
     ⚠ العتبة ٩٠px: انكماشُ شريط العنوان وحده لا يُحسب لوحةَ مفاتيح. */
  function keyboardInset() {
    var vv = window.visualViewport;
    if (!vv) return;                        /* متصفّح قديم: يبقى السلوك كما كان */
    var root = document.documentElement;
    function fit() {
      var gap = Math.round(window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty('--kb', gap > 90 ? gap + 'px' : '0px');
    }
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
    fit();
  }

  /* ═══ زرّ المنزل — سلوكٌ واحد لكل الشاشات (قرار المستخدم 2026-09-08) ═══
     كل شاشةٍ تُفتح من اللوحة تحمل زرّ منزلٍ يعيد إليها، بدل سهمٍ يرجع
     «من حيث جئت» فيختلف مقصده باختلاف الطريق — وقد أربك المستخدم:
     ضغط السهم في شاشة المراجعة فوجد نفسه في اللوحة لا في الخطوة السابقة.
     ⚠ ولا يُستعمل في خطوات الإعداد ①–⑥: السهم فيها يرجع **خطوة** في
       تسلسلٍ متّصل، والمنزل يقطعه.
     الاستعمال: <div class="iconbtn" data-home title="اللوحة"></div>
     والرمز يُحقن من هنا فلا يُكرَّر رسمُه في خمس شاشات. */
  var HOME_SVG = '<svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">'
    + '<path d="M3.4 8.9 L10 3.4 L16.6 8.9" stroke="#5F5648" stroke-width="1.9" '
    + 'stroke-linecap="round" stroke-linejoin="round"/>'
    + '<path d="M5 8.2 V15.4 a1.2 1.2 0 0 0 1.2 1.2 H13.8 a1.2 1.2 0 0 0 1.2 -1.2 V8.2" '
    + 'stroke="#5F5648" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function bindHome() {
    [].forEach.call(document.querySelectorAll('[data-home]'), function (b) {
      if (!b.querySelector('svg')) b.innerHTML = HOME_SVG;
      if (!b.getAttribute('title')) b.setAttribute('title', 'اللوحة');
      b.setAttribute('aria-label', 'العودة إلى اللوحة');
      b.setAttribute('role', 'button');
      b.setAttribute('tabindex', '0');
      function go() { location.href = 'board.html'; }
      b.addEventListener('click', go);
      b.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
      });
    });
  }

  /* ═══ تنبيه النسخة الأحدث (قرار المستخدم 2026-09-08) ═══════════════
     version.json كان يُجلب من الشبكة في عامل الخدمة **ولا يقرؤه أحد** —
     فلا مقارنة ولا تنبيه. ومن أبقى المنصّة مفتوحة أو ثبّتها أيقونةً قد
     يبقى على نسخةٍ قديمة بلا أن يشعر، فيبلّغ عن خللٍ أُصلح أمس.
     ⚠ ولا إعادة تحميلٍ قسرية: أُزيلت سابقاً لأنها أحدثت تحميلاً مزدوجاً
       بدا بطئاً وفقداناً للبيانات. فالشريط ينتظر ضغطةً ولا يقاطع. */
  function updateBanner() {
    var mine = window.SHOUBA_BUILD;
    if (!mine || !window.fetch) return;
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (v) {
        if (!v || !(v.build > mine)) return;                  /* لا شيء أحدث */
        /* ⚠ وزرُّ صرفٍ لازم: الشريط يطفو فوق المحتوى، وبلا مخرجٍ منه
           يغطّي عنوان القسم إلى الأبد عند من لا يريد التحديث الآن. */
        var b = document.createElement('div');
        b.className = 'newver';
        b.innerHTML = '<span>نسخة أحدث جاهزة</span><b role="button" tabindex="0">حدِّث</b>'
                    + '<i class="x" role="button" tabindex="0" aria-label="أغلق">×</i>';
        b.querySelector('.x').addEventListener('click', function (e) {
          e.stopPropagation(); b.remove();
        });
        /* أسفل الرأس إن وُجد، وإلّا أعلى الشاشة */
        var bar = document.querySelector('.topbar');
        b.style.top = (bar ? Math.round(bar.getBoundingClientRect().height) + 8 : 12) + 'px';
        b.querySelector('b').addEventListener('click', function () {
          b.classList.add('busy'); b.querySelector('b').textContent = '…';
          var done = function () { location.reload(); };
          if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
            navigator.serviceWorker.getRegistration()
              .then(function (r) { return r ? r.update() : null; })
              .then(done, done);
          } else done();
        });
        document.body.appendChild(b);
      })
      .catch(function () {});                                 /* بلا إنترنت: لا شيء */
  }

  /* ═══ الوصل بالخادم (2026-09-08) ═══════════════════════════════════
     يُنادى بعد تحميل كل شاشة. وطبقة الاشتقاق هي التي تقرّر:
     بجلسةٍ تعمل على الخادم، وبلا جلسةٍ تبقى على الجهاز كما كانت.
     ⚠ ولا تُمسّ شاشةٌ من الخمس عشرة — كما وُعد في ترويسة derive.js. */
  function connectServer() {
    if (!window.Shouba || !Shouba.connect) return;
    Shouba.connect().then(function (ok) {
      if (!ok || !Shouba.serverWasNewer) return;
      /* بياناتك تبدّلت من جهازٍ آخر — تُخبَر ولا تُفاجأ */
      var b = document.createElement('div');
      b.className = 'newver';
      var bar = document.querySelector('.topbar');
      b.style.top = (bar ? Math.round(bar.getBoundingClientRect().height) + 8 : 12) + 'px';
      b.innerHTML = '<span>حُدّثت شعبتك من جهازٍ آخر</span><b role="button" tabindex="0">اعرض</b>'
                  + '<i class="x" role="button" tabindex="0" aria-label="أغلق">×</i>';
      b.querySelector('.x').addEventListener('click', function (e) { e.stopPropagation(); b.remove(); });
      b.querySelector('b').addEventListener('click', function () { location.reload(); });
      document.body.appendChild(b);
    });
  }

  if (document.readyState !== 'loading') { init(); bindSoon(); serviceWorker(); standaloneNote(); versionTag(); keyboardInset(); bindHome(); updateBanner(); connectServer(); }
  else document.addEventListener('DOMContentLoaded', function () { init(); bindSoon(); serviceWorker(); standaloneNote(); versionTag(); keyboardInset(); bindHome(); updateBanner(); connectServer(); });
})();
