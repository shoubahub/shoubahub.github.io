/* ===================================================================
   شعبة · المرفقات في الجهاز (2026-09-12) — الخطوة (و) من محرك السجلات
   ────────────────────────────────────────────────────────────────
   يختار الملف ويجهزه ويرفعه ويحذفه. والخادم في files.js (لصاحب الحساب وحده).
   ⚠ الصورة تصغر هنا قبل الرفع: اطول ضلع ١٨٠٠ بكسل وJPEG بجودة ٠٫٨٢ — تبقى واضحة
     مطبوعة بربع A4، ونحو نصف ميغابايت بدل ٣–٥ من الكاميرا.
   ⚠ PDF يرفع كما هو حتى ٤ ميغابايت — لا يضغط (ضغطه يفسد النص والتواقيع).
   ⚠ الرفع يحتاج الخادم وجلستك: بلا اتصال يعتذر ولا يحفظ نصف عملية.
   الاخطاء لصاحبها تحمل e.user = true ورسالة بلغته.
   =================================================================== */
(function () {
  var F = window.ShoubaFiles = {};
  F.MAX = 4 * 1024 * 1024;
  F.SIDE = 1800;
  F.Q = 0.82;
  F.ACCEPT = 'image/*,application/pdf';
  F.url = function (id) { return 'api/files/' + encodeURIComponent(id); };

  function err(msg) { var e = new Error(msg); e.user = true; return e; }

  /* الاختيار: يفتح منتقي الجهاز (يلزم ان ينادى من لمسة) */
  F.pick = function (cb) {
    var i = document.createElement('input');
    i.type = 'file'; i.accept = F.ACCEPT;
    i.addEventListener('change', function () { if (i.files && i.files[0]) cb(i.files[0]); });
    i.click();
  };

  /* التجهيز: يعيد Promise بـ { blob, mime } */
  F.prepare = function (file) {
    if (!file) return Promise.reject(err('لم يختر ملف'));
    var pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    if (pdf) {
      return file.size > F.MAX
        ? Promise.reject(err('ملف PDF أكبر من 4 ميغابايت — أرفق صورة للنسخة بدلا منه'))
        : Promise.resolve({ blob: file, mime: 'application/pdf' });
    }
    if (!/^image\//.test(file.type || '') && !/\.(jpe?g|png|heic|heif|webp)$/i.test(file.name || ''))
      return Promise.reject(err('صورة أو PDF فقط'));
    return new Promise(function (ok, no) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, F.SIDE / Math.max(w, h));
        var c = document.createElement('canvas'), x;
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        x = c.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);   /* الشفاف ابيض لا اسود في JPEG */
        x.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) {
          if (!b) return no(err('تعذر تجهيز الصورة — جرب صورة أخرى'));
          if (b.size > F.MAX) return no(err('الصورة أكبر من 4 ميغابايت بعد تصغيرها'));
          ok({ blob: b, mime: 'image/jpeg' });
        }, 'image/jpeg', F.Q);
      };
      img.onerror = function () { URL.revokeObjectURL(url); no(err('تعذرت قراءة الصورة — جرب صورة أخرى')); };
      img.src = url;
    });
  };

  /* الرفع: يعيد Promise بـ { id, mime, size } */
  F.upload = function (recId, prep) {
    return fetch('api/files?rec=' + encodeURIComponent(recId), {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': prep.mime }, body: prep.blob
    }).then(function (r) {
      if (r.status === 401) throw err('انتهت جلستك — ادخل حسابك ثم أرفقها');
      if (r.status === 404) throw err('الإرفاق يحتاج خادم المنصة — وهذه نسخة بلا خادم');
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw err(j.error || 'تعذر الرفع — أعد المحاولة');
        return j;
      });
    }, function () { throw err('لا اتصال — الإرفاق يحتاج الإنترنت'); });
  };

  /* الحذف: بلا انتظار ولا خطأ لصاحبه — وما فات تلتقطه المصالحة في الخادم */
  F.remove = function (id) {
    if (!id) return Promise.resolve();
    return fetch(F.url(id), { method: 'DELETE', credentials: 'same-origin' }).then(function () {}, function () {});
  };

  /* اسم الملف على الشاشة والورق: عنوانه ان كتب، والا نوعه */
  F.label = function (ref) {
    return String(ref && ref.name || '').trim() || (ref && ref.mime === 'application/pdf' ? 'ملف PDF' : 'صورة');
  };
  F.kb = function (n) {
    n = +n || 0;
    return n >= 1048576 ? (n / 1048576).toFixed(1) + ' ميغابايت' : Math.max(1, Math.round(n / 1024)) + ' كيلوبايت';
  };

  /* العرض في لوحة سفلية — للنسخة الموقعة والمرفقات معا (مكون واحد، components.css .fview).
     يطلب بجلستك (لا رابط عام) ويفحص بلوغه قبل عرضه، فلا تظهر صفحة خطأ مكان الصورة.
     ⚠ من لوحة مفتوحة: اغلقها ثم نادها بعد حركة الاغلاق */
  F.view = function (title, ref) {
    var n = document.createElement('div'), wait = document.createElement('p');
    var url = F.url(ref.file), pdf = ref.mime === 'application/pdf';
    n.className = 'fview'; wait.className = 'wait'; wait.textContent = 'يحمل الملف…';
    n.appendChild(wait);
    F.reachable(ref.file).then(function (ok) {
      if (!ok) { wait.className = 'miss'; wait.textContent = 'تعذر عرضه — يحتاج اتصالا بحسابك.'; return; }
      var m = document.createElement(pdf ? 'iframe' : 'img'), o = document.createElement('button');
      if (pdf) m.title = title; else m.alt = title;
      m.src = url;
      n.replaceChild(m, wait);
      o.type = 'button'; o.className = 'btn-ghost'; o.textContent = 'افتحه في نافذة';
      o.addEventListener('click', function () { window.open(url, '_blank'); });
      n.appendChild(o);
    });
    window.Shouba.sheet.open(title, n);
  };

  /* هل يبلغ الملف الآن؟ (العرض: لا تعرض صفحة خطأ مكان الصورة) */
  F.reachable = function (id) {
    return fetch(F.url(id), { method: 'HEAD', credentials: 'same-origin' })
      .then(function (r) { return r.ok; }, function () { return false; });
  };
})();
