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
   الصيغ: { one:'معلّم', two:'معلّمان', few:'معلّمين', many:'معلّماً', zero:'لا أحد' }
   ⚠ «zero» اختيارية: بها يُقال «لا شيء» بدل «٠ جدولاً». كان كلّ نداءٍ يعالج الصفر
     بنفسه، فنُسخت المعالجة في دالّةٍ محلّية وقعت خارج نطاق مَن يناديها فانكسر
     الاستيراد (رُصد 2026-09-10) — فصار الصفر من شأن العدّاد نفسه. */
Shouba.unit = function (n, f) {
  return n === 1 ? f.one : n === 2 ? f.two : (n >= 3 && n <= 10) ? f.few : f.many;
};
Shouba.count = function (n, f) {
  if (!n && f.zero) return f.zero;
  /* ⚠ «واحد» تُؤنَّث تبعاً للمعدود: «معلّم واحد» و«حصة واحدة».
     كانت مذكّرةً دائماً فأنتجت «حصة واحد» (رُصد 2026-09-05). */
  if (n === 1) return f.one + (/ة$/.test(f.one) ? ' واحدة' : ' واحد');
  if (n === 2) return f.two;
  return n + ' ' + Shouba.unit(n, f);
};
/* صيغ ملخّص الشعبة — في مساحة الاسم لا في دالّة، فتبلغها كل لوحة:
   معاينة الاستيراد ولوحة الخلاف تعرضان الملخّص نفسه فيجب أن تتكلّما بلسانٍ واحد. */
Shouba.FORMS = {
  teachers:  { one:'معلّم', two:'معلّمان', few:'معلّمين', many:'معلّماً', zero:'لا أحد' },
  schedules: { one:'جدول', two:'جدولان', few:'جداول',  many:'جدولاً', zero:'لا شيء' },
  events:    { one:'موعد', two:'موعدان', few:'مواعيد', many:'موعداً', zero:'لا شيء' }
};

/* الأرقام العربية (٠١٢٣) والفارسية (۰۱۲۳) ⟵ إنجليزية (0123).
   ⚠ لوحة الأرقام على جهازٍ لغته العربية تكتب ٠١٢٣، فكان رقم الإدارة الصحيح
     يُرفض، وحقل الرقم السرّي يمحو ما يُكتب فيه (رصده المستخدم 2026-09-10).
     الرقم رقمٌ بأيّ لوحةٍ كُتب — والخادم يطبّق التحويل نفسه، فلا يعتمد على الصفحة. */
Shouba.latinDigits = function (s) {
  return String(s == null ? '' : s)
    .replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 0x0660; })
    .replace(/[۰-۹]/g, function (d) { return d.charCodeAt(0) - 0x06F0; });
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
    /* قابلية النقل (2026-09-10) — ميزةٌ دائمة: نسخٌ احتياطي · تسليم الشعبة · انتقال.
       ⚠ الاستدعاء متزامنٌ داخل النقرة: المشاركة واختيار الملفّ يشترطان فعلاً من المستخدم. */
    item('صدِّر شعبتك', 'ملفٌّ فيه بياناتك كلّها — تحتفظ به أو تنقله', function () {
      Shouba.sheet.close(); Shouba.exportData();
    });
    item('استورد شعبة من ملفّ', 'تحلّ محلّ بياناتك الحالية بعد أن تؤكّد', function () {
      Shouba.importData();
    });

    /* ⚠ النصّ يتبع الحقيقة: كان «بياناتك على جهازك — لا تُرسَل إلى خادم»،
       فصار كذباً منذ الخادم حيث تعمل الجلسة. فيُشتقّ من حال الوصل. */
    var note = document.createElement('div');
    note.className = 'setnote';
    note.innerHTML = (Shouba.online && Shouba.online())
      ? '<b>بياناتك على خادم المنصّة</b> — تصلك من أيّ جهاز تدخل منه، ورقمك السرّي لا يراه أحد.'
      : '<b>بياناتك على هذا الجهاز وحده</b> — إن مسحتَ متصفّحك أو بدّلت جهازك ضاعت.'
        + ' فصدِّر شعبتك ملفّاً تحتفظ به.';
    n.appendChild(note);

    var ver = document.createElement('div');
    ver.className = 'setver';
    /* الدلالي للمستخدم والبناء لنا — في سطر واحد */
    ver.textContent = 'نسخة تجريبية ' + (window.SHOUBA_VERSION || '؟')
                    + ' · بناء ' + (window.SHOUBA_BUILD || '؟');
    n.appendChild(ver);

    Shouba.sheet.open('الإعدادات', n);
  };

  /* ═══ التصدير والاستيراد — الواجهة (2026-09-10) ═══════════════════════
     المنطق في derive.js (الصيغة والتحقّق والاستبدال)، والملفّ واللوحة هنا.
     ⚠ محتوى الملفّ **غير موثوق**: يُعرض بـtextContent لا innerHTML،
       فملفٌّ مصنوع لا يحقن في الصفحة شيئاً. */
  var IMPORT_ERR = {
    bad:    'الملفّ ليس ملفّ شعبةٍ سليماً — ربما تلف أو عُدِّل.',
    format: 'هذا ليس ملفّاً صدّرته منصّة شعبة.',
    newer:  'الملفّ من نسخةٍ أحدث من المنصّة — حدِّثها ثم أعِد المحاولة.',
    read:   'تعذّرت قراءة الملفّ.'
  };
  var touch = window.matchMedia && matchMedia('(pointer:coarse)').matches;

  Shouba.exportData = function () {
    if (!Shouba.exportPayload) return;
    var p = Shouba.exportPayload();
    var dept = String(p.data.department || 'شعبة').replace(/[\\/:*?"<>|]/g, '').trim() || 'شعبة';
    var name = 'شعبة-' + dept + '-' + p.exportedAt.slice(0, 10) + '.json';
    var blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
    /* على الجوّال: لوحة المشاركة (احفظ في الملفّات · أرسله لنفسك) أنفع من تنزيلٍ يضيع.
       وعلى الحاسوب: تنزيلٌ عاديّ. */
    var file = null;
    try { file = new File([blob], name, { type: 'application/json' }); } catch (e) {}
    if (touch && file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: name }).catch(function () {});
      return;
    }
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  };

  function importFail(code) {
    var n = document.createElement('div'); n.className = 'impv';
    var m = document.createElement('div'); m.className = 'warn';
    m.textContent = IMPORT_ERR[code] || IMPORT_ERR.bad;
    var b = document.createElement('button'); b.className = 'btn-ghost'; b.textContent = 'حسناً';
    b.addEventListener('click', function () { Shouba.sheet.close(); });
    n.appendChild(m); n.appendChild(b);
    Shouba.sheet.open('تعذّر الاستيراد', n);
  }

  function importPreview(res, after) {
    var s = res.summary, cur = Shouba.data(), has = cur && Object.keys(cur).length > 0;
    var n = document.createElement('div'); n.className = 'impv';
    var rows = document.createElement('div'); rows.className = 'rows';
    var when = s.exportedAt ? new Date(s.exportedAt) : null;
    var whenTx = when && !isNaN(when) ? when.toLocaleDateString('ar-KW', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
    [
      ['الشعبة',   (s.department || '—') + (s.stage ? ' · ' + s.stage : '')],
      ['المدرسة',  s.school || '—'],
      ['المعلّمون', Shouba.count(s.teachers,  Shouba.FORMS.teachers)],
      ['الجداول',  Shouba.count(s.schedules, Shouba.FORMS.schedules)],
      ['المواعيد', Shouba.count(s.events,    Shouba.FORMS.events)],
      ['صُدِّر',    whenTx + (s.owner ? ' · ' + s.owner : '')]
    ].forEach(function (r) {
      var el = document.createElement('div'); el.className = 'r';
      var k = document.createElement('span'); k.textContent = r[0];
      var v = document.createElement('b');    v.textContent = r[1];
      el.appendChild(k); el.appendChild(v); rows.appendChild(el);
    });
    n.appendChild(rows);

    if (has) {
      var w = document.createElement('div'); w.className = 'warn';
      w.textContent = 'سيحلّ هذا محلّ بيانات شعبتك الحالية'
        + ((Shouba.online && Shouba.online()) ? ' على هذا الجهاز وعلى الخادم.' : ' على هذا الجهاز.')
        + ' وتُحفظ الحالية نسخةً احتياطية على هذا الجهاز.';
      n.appendChild(w);
    }

    var go = document.createElement('button'); go.className = 'cta'; go.textContent = 'استورد';
    var no = document.createElement('button'); no.className = 'btn-ghost'; no.textContent = 'ألغِ';
    no.addEventListener('click', function () { Shouba.sheet.close(); });
    go.addEventListener('click', function () {
      go.disabled = true; go.textContent = 'يُستورد…';
      Shouba.replace(res.data);
      /* الاسم للعرض: من لم يُعرَف اسمه على هذا الجهاز أخذه من الملفّ */
      try {
        var u = JSON.parse(localStorage.getItem('shouba.user')) || {};
        if (!u.name && s.owner) { u.name = s.owner; localStorage.setItem('shouba.user', JSON.stringify(u)); }
      } catch (e) {}
      Shouba.flush(true).then(function () {   /* استبدالٌ صريحٌ بعد تحذير */
        Shouba.sheet.close();
        if (after) after(); else location.href = 'index.html';
      });
    });
    n.appendChild(go); n.appendChild(no);
    Shouba.sheet.open('استيراد شعبة', n);
  }

  Shouba.importData = function (after) {
    if (!Shouba.parseImport) return;
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0];
      inp.remove();
      if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        var obj;
        try { obj = JSON.parse(r.result); } catch (e) { return importFail('bad'); }
        var res = Shouba.parseImport(obj);
        if (!res.ok) return importFail(res.error);
        importPreview(res, after);
      };
      r.onerror = function () { importFail('read'); };
      r.readAsText(f);
    });
    inp.click();
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

  /* ═══ الوصل بالخادم وعرضُ حاله (2026-09-10) ═══════════════════════════
     طبقة الاشتقاق تقرّر (رقم المراجعة · الخلاف · الانتقال)، وهنا تُعرض.
     ⚠ ولا تُمسّ شاشةٌ من الخمس عشرة — كما وُعد في ترويسة derive.js. */

  /* شريطٌ عائم تحت الرأس، وتتراصّ الأشرطة إن تعدّدت فلا يغطّي أحدها الآخر */
  function pill(text, action, onClick) {
    var b = document.createElement('div'); b.className = 'newver';
    var bar = document.querySelector('.topbar');
    var top = bar ? Math.round(bar.getBoundingClientRect().height) + 8 : 12;
    b.style.top = (top + document.querySelectorAll('.newver').length * 50) + 'px';
    var s = document.createElement('span'); s.textContent = text;
    var go = document.createElement('b'); go.setAttribute('role', 'button'); go.tabIndex = 0; go.textContent = action;
    var x = document.createElement('i'); x.className = 'x'; x.setAttribute('role', 'button');
    x.tabIndex = 0; x.setAttribute('aria-label', 'أغلق'); x.textContent = '×';
    x.addEventListener('click', function (e) { e.stopPropagation(); b.remove(); });
    go.addEventListener('click', onClick);
    b.appendChild(s); b.appendChild(go); b.appendChild(x);
    document.body.appendChild(b);
    return b;
  }

  /* شريط فشل الحفظ — صامتٌ حين ينجح، صريحٌ حين يفشل.
     (كان يُبنى داخل derive.js فخالف قاعدة «لا DOM في طبقة الاشتقاق».) */
  var sbar = null;
  function syncBar(bad) {
    if (!bad) { if (sbar) { sbar.remove(); sbar = null; } return; }
    if (sbar) return;
    sbar = document.createElement('div'); sbar.className = 'syncbar';
    sbar.textContent = 'لم يصل الحفظ إلى الخادم — عملُك محفوظ في جهازك وسيُرسَل تلقائياً.';
    document.body.appendChild(sbar);
  }

  /* لوحة الخلاف: النسختان جنباً إلى جنب، والفرق مُبرَز، والاختيار لصاحبها.
     ⚠ محتوى النسختين يُعرض بـtextContent. */
  var cfPill = null;
  function conflictSheet(c) {
    c = c || (Shouba.conflict);
    if (!c) return;
    /* isConnected: إن أغلقه صاحبه ثم وقع خلافٌ ثانٍ في الجلسة، عاد الشريط */
    if (!cfPill || !cfPill.isConnected) cfPill = pill('نسختان مختلفتان من شعبتك', 'احسم', function () { conflictSheet(); });
    var a = Shouba.summarize(c.local), b = Shouba.summarize(c.server);
    var n = document.createElement('div'); n.className = 'impv';
    var lead = document.createElement('div'); lead.className = 'lead';
    lead.textContent = 'على الخادم نسخةٌ غير التي على هذا الجهاز — ربما عدّلتَ من جهازٍ آخر.'
      + ' اختر أيّهما تُبقي، والأخرى تُحفظ على هذا الجهاز احتياطاً.';
    n.appendChild(lead);
    var grid = document.createElement('div'); grid.className = 'cfx';
    var anyDiff = false;
    var F = Shouba.FORMS;
    function side(title, s, o, at) {
      var box = document.createElement('div'); box.className = 'rows';
      var h = document.createElement('div'); h.className = 'h'; h.textContent = title; box.appendChild(h);
      /* ⚠ الطرفان بالعدّاد نفسه والصيغ نفسها — فالمقارنة نصّيةٌ صادقة:
         كان الأيمن بلا صيغة صفر والأيسر بها، فعُلِّم صفرٌ مقابل صفرٍ «مختلفاً» */
      [['الشعبة', s.department || '—', o.department || '—'],
       ['المعلّمون', Shouba.count(s.teachers,  F.teachers),  Shouba.count(o.teachers,  F.teachers)],
       ['الجداول',  Shouba.count(s.schedules, F.schedules), Shouba.count(o.schedules, F.schedules)],
       ['المواعيد', Shouba.count(s.events,    F.events),    Shouba.count(o.events,    F.events)]
      ].forEach(function (r) {
        var el = document.createElement('div'); el.className = 'r' + (r[1] !== r[2] ? ' diff' : '');
        if (r[1] !== r[2]) anyDiff = true;
        var k = document.createElement('span'); k.textContent = r[0];
        var v = document.createElement('b');    v.textContent = r[1];
        el.appendChild(k); el.appendChild(v); box.appendChild(el);
      });
      if (at) {
        var d = new Date(at.replace(' ', 'T') + 'Z');
        var el = document.createElement('div'); el.className = 'r';
        var k = document.createElement('span'); k.textContent = 'آخر حفظ';
        var v = document.createElement('b');
        v.textContent = isNaN(d) ? at : d.toLocaleString('ar-KW', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
        el.appendChild(k); el.appendChild(v); box.appendChild(el);
      }
      return box;
    }
    grid.appendChild(side('على هذا الجهاز', a, b, ''));
    grid.appendChild(side('على الخادم', b, a, c.serverAt));
    n.appendChild(grid);
    if (!anyDiff) {
      var same = document.createElement('div'); same.className = 'lead';
      same.textContent = 'الأعداد متطابقة — والفرق في التفاصيل: خانةٌ في جدول، أو اسم، أو موعد.';
      n.appendChild(same);
    }
    var mine = document.createElement('button'); mine.className = 'btn-ghost'; mine.textContent = 'أبقِ نسخة هذا الجهاز';
    var theirs = document.createElement('button'); theirs.className = 'btn-ghost'; theirs.textContent = 'خذ نسخة الخادم';
    function pick(keep, el) {
      mine.disabled = theirs.disabled = true; el.textContent = 'يُحفظ…';
      Shouba.resolve(keep).then(function () { Shouba.sheet.close(); location.reload(); });
    }
    mine.addEventListener('click', function () { pick('mine', mine); });
    theirs.addEventListener('click', function () { pick('server', theirs); });
    n.appendChild(mine); n.appendChild(theirs);
    Shouba.sheet.open('نسختان مختلفتان من شعبتك', n);
  }

  /* ═══ العنوان الدائم للمنصّة وتنبيه الانتقال ═══════════════════════
     SHOUBA_HOME في build.js — **سطرٌ واحد يتبدّل يوم يُشترى النطاق**.
     التحويل التلقائيّ للوافد الجديد يُستثنى منه التطوير المحلّي؛
     أمّا التنبيه فيظهر في كل نسخةٍ ساكنة بلا خادم (العنوان القديم). */
  Shouba.movedTarget = function () {
    var home = window.SHOUBA_HOME || '';
    if (!home || location.origin === home) return '';
    var h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || /^(192\.168|10)\./.test(h)) return '';
    return home;
  };
  function movedSheet() {
    var home = window.SHOUBA_HOME;
    var n = document.createElement('div'); n.className = 'impv moved';
    var lead = document.createElement('div'); lead.className = 'lead';
    lead.textContent = 'هذا العنوان القديم يعمل على جهازك وحده، ولن يصله جديد. وبيانات شعبتك هنا'
      + ' لم تصل إلى المنصّة الجديدة — انقلها في ثلاث خطوات:';
    n.appendChild(lead);
    var ol = document.createElement('ol');
    ol.innerHTML = '<li><b>صدِّر شعبتك</b> ملفّاً — الزرّ أدناه.</li>'
      + '<li><b>افتح المنصّة الجديدة</b> وأنشئ حسابك برمز الدعوة من رئيس الشعبة.</li>'
      + '<li>في أوّل شاشة بعد التسجيل اضغط <b>«استورده»</b> واختر الملفّ.</li>';
    n.appendChild(ol);
    var ex = document.createElement('button'); ex.className = 'cta'; ex.textContent = 'صدِّر شعبتك';
    ex.addEventListener('click', function () { Shouba.exportData(); });
    var go = document.createElement('button'); go.className = 'btn-ghost'; go.textContent = 'افتح المنصّة الجديدة';
    go.addEventListener('click', function () { location.href = home + '/login.html'; });
    n.appendChild(ex); n.appendChild(go);
    Shouba.sheet.open('انتقلت المنصّة', n);
  }
  function movedNotice() {
    var home = window.SHOUBA_HOME;
    if (!home || location.origin === home) return;
    pill('انتقلت المنصّة إلى عنوانٍ جديد', 'اعرض', movedSheet);
    /* تُفتح وحدها مرّةً في الجلسة على اللوحة — شاشة كل يوم */
    try {
      if (/board\.html/.test(location.pathname) && !sessionStorage.getItem('shouba.movedSeen')) {
        sessionStorage.setItem('shouba.movedSeen', '1'); movedSheet();
      }
    } catch (e) {}
  }

  /* ═══ حارس الجلسة — كل شاشةٍ محميّة ما لم تُعلَن عامّة (2026-09-10) ═══
     ⚠ كان الموجِّه وحده يسأل «مَن أنت؟»، فمن فتح رابط اللوحة مباشرةً من جهازٍ
       لم يدخل منه رأى لوحةً فارغة باسم «شعبتك» ولم يُطلب منه الدخول — ففتحه
       المستخدم من هاتفه فظنّ بياناته ضاعت، «وبأوّل اختبارٍ يفشل».
       الآن **الحماية هي الأصل والاستثناء صريح**: `<html data-public>` (الدخول والإدارة).
       فأيّ شاشةٍ تُبنى بعد اليوم محميّةٌ دون أن يتذكّر أحدٌ حمايتها.
     • ٤٠١ ⟵ الدخول، ومعه الوجهة فيعود إليها بعده.
     • ٤٠٤ ⟵ نسخةٌ ساكنة بلا خادم (العنوان القديم) — تعمل كما كانت.
     • لا شبكة ⟵ مَن دخل من هذا الجهاز قبلاً يعمل بما عليه؛ ومَن لم يدخل منه قطّ
       يُرسَل للدخول — فلا تُرسَم لجهازٍ جديد لوحةٌ فارغة توهمه أن بياناته ضاعت.
     • والجهاز الذي لم يدخل منه قطّ تُحجب صفحته حتى يُعرف الجواب — فلا تومض الفارغة. */
  Shouba.signIn = function () {
    var here = location.pathname.replace(/^.*\//, '') + location.search;
    location.replace('login.html' + (here ? '?next=' + encodeURIComponent(here) : ''));
  };
  function sessionGuard() {
    var root = document.documentElement;
    if (!window.fetch || root.hasAttribute('data-public')) return;
    /* «معروف» = دخل منه صاحبُ حسابٍ قبلاً، أو أتمّ عليه إعداد شعبته (مستخدمو العنوان القديم).
       ⚠ لا مجرّد وجود `shouba.setup`: بعض شاشات المعالج تكتبه لحظة تحميلها — قبل أن
         يُحوِّل الحارس — فصار الجهاز الجديد «معروفاً» بمجرّد فتح رابطٍ (رُصد في الفحص). */
    var known = false;
    try {
      var setup = JSON.parse(localStorage.getItem('shouba.setup') || '{}') || {};
      known = !!(localStorage.getItem('shouba.owner') || setup.setupDone);
    } catch (e) {}
    if (!known) root.style.visibility = 'hidden';
    var settled = false;
    function settle(fn) { if (!settled) { settled = true; fn(); } }
    function show() { root.style.visibility = ''; }
    /* خادمٌ لا يجيب: لا تبقى الشاشة محجوبة — مَن عُرف يعمل، ومَن لم يُعرف فإلى الدخول */
    setTimeout(function () { settle(known ? show : Shouba.signIn); }, 6000);
    fetch('api/me', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { settle(r.status === 401 ? Shouba.signIn : show); },
            function ()  { settle(known ? show : Shouba.signIn); });
  }
  sessionGuard();

  /* انتهت الجلسة أثناء العمل — تُعلَن ولا يُسكَت عنها.
     كانت تُعرض «لم يصل الحفظ… وسيُرسَل تلقائياً» — وعدٌ لا يتحقّق بلا دخول. */
  var authPill = null;
  function authSheet() {
    syncBar(false);
    if (!authPill || !authPill.isConnected) authPill = pill('انتهت جلستك — الحفظ متوقّف', 'ادخل', function () { authSheet(); });
    var n = document.createElement('div'); n.className = 'impv';
    var lead = document.createElement('div'); lead.className = 'lead';
    lead.textContent = 'انتهت جلسة دخولك على هذا الجهاز، فتوقّف الحفظ على الخادم.'
      + ' ما عدّلتَه باقٍ على هذا الجهاز، ويُرسَل حين تدخل من جديد.';
    n.appendChild(lead);
    var go = document.createElement('button'); go.className = 'cta'; go.textContent = 'ادخل';
    go.addEventListener('click', function () { Shouba.signIn(); });
    n.appendChild(go);
    Shouba.sheet.open('انتهت جلستك', n);
  }

  function connectServer() {
    if (!window.Shouba || !Shouba.connect) return;
    Shouba.onConflict = conflictSheet;
    Shouba.onSyncState = syncBar;
    Shouba.onAuthLost = authSheet;
    Shouba.connect().then(function () {
      if (Shouba.serverless) { movedNotice(); return; }
      /* تُخبَر ولا تُفاجأ — ويُقال هذا حين يكون جهازٌ آخر قد كتب فعلاً */
      if (Shouba.updatedElsewhere) pill('حُدّثت من جهازٍ آخر', 'اعرض', function () { location.reload(); });
    });
  }

  if (document.readyState !== 'loading') { init(); bindSoon(); serviceWorker(); standaloneNote(); versionTag(); keyboardInset(); bindHome(); updateBanner(); connectServer(); }
  else document.addEventListener('DOMContentLoaded', function () { init(); bindSoon(); serviceWorker(); standaloneNote(); versionTag(); keyboardInset(); bindHome(); updateBanner(); connectServer(); });
})();
