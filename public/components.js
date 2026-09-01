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
  if (n === 1) return f.one + ' واحد';
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
  return r === 'final' ? '/setup-wizard-7.html' : r === 'review' ? '/setup-review.html' : '';
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
    requestAnimationFrame(function () { sheet.classList.add('open'); });
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

  var sheetPending = false;   /* حارس السباق: فتح ثم إغلاق في الدورة نفسها كان يترك اللوحة مفتوحة بلا خلفية */
  function close() {
    if (!sheet) return;
    sheetPending = false;
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
      sheetPending = true;
      requestAnimationFrame(function () { if (sheetPending) sheet.classList.add('open'); });
    },
    close: function () { close(); }
  };

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
