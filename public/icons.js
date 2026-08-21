/* ===================================================================
   شعبة · مكتبة رموز الشعب (بديل شعار المدرسة) — للواجهة فقط
   رسمناها بأنفسنا: لا ترخيص ولا حقوق (قاعدة أصول المشروع).
   الأسلوب: كتلة كحلية مصمتة + قطعة عنبرية واحدة (دليل الهوية).
   ⚠ معيار القبول: أن يُقرأ الرمز عند ٢٦px — لا تفاصيل رفيعة.
   ⚠ لا تُعدَّل هذه الملفّات بأدوات استبدال نصّي (perl/sed): تُفسد ترميز العربية.
   =================================================================== */
(function () {
  var I = {};
  function ic(id, label, body){ I[id] = { label: label, body: body }; }

  /* ---------- عامّة تصلح لأي شعبة ---------- */
  ic('shield','درع المدرسة',
    '<path class="m" d="M12 2.2 20.4 5v6c0 5.1-3.4 8.9-8.4 11-5-2.1-8.4-5.9-8.4-11V5z"/>'
    + '<path class="a" d="M7.6 8.4c1.5-.5 3-.5 4.4.4v6.4c-1.4-.9-2.9-.9-4.4-.4z"/>'
    + '<path class="a" d="M16.4 8.4c-1.5-.5-3-.5-4.4.4v6.4c1.4-.9 2.9-.9 4.4-.4z" opacity=".72"/>');

  ic('book','كتاب مفتوح',
    '<path class="m" d="M2.6 5.2c2.9-1.1 5.8-1.1 8.6.6v12.6c-2.8-1.7-5.7-1.7-8.6-.6z"/>'
    + '<path class="m" d="M21.4 5.2c-2.9-1.1-5.8-1.1-8.6.6v12.6c2.8-1.7 5.7-1.7 8.6-.6z" opacity=".82"/>'
    + '<rect class="a" x="11.1" y="5" width="1.8" height="13.6" rx=".9"/>');

  ic('pen','قلم وريشة',
    '<path class="m" d="M3.4 20.6v-3.3L14.9 5.8l3.3 3.3L6.7 20.6z"/>'
    + '<path class="a" d="M16.2 4.5 18 2.7a2 2 0 0 1 2.8 2.8l-1.8 1.8z"/>'
    + '<path class="a" d="M3.4 20.6h4.2l-4.2 1.2z" opacity=".8"/>');

  ic('idea','مصباح فكرة',
    '<path class="m" d="M12 2.4a6.8 6.8 0 0 1 4.3 12.1c-.7.6-1.1 1.3-1.1 2.1H8.8c0-.8-.4-1.5-1.1-2.1A6.8 6.8 0 0 1 12 2.4z"/>'
    + '<rect class="a" x="9" y="17.6" width="6" height="1.9" rx=".9"/>'
    + '<rect class="a" x="10.2" y="20.4" width="3.6" height="1.7" rx=".85"/>');

  /* ---------- إنسانيات ---------- */
  ic('scale','ميزان',
    '<rect class="m" x="11.1" y="3.2" width="1.8" height="16" rx=".9"/>'
    + '<rect class="m" x="4" y="6.6" width="16" height="1.8" rx=".9"/>'
    + '<path class="m" d="M7.2 8.4 3.2 15.2h8z"/><path class="m" d="M16.8 8.4 12.8 15.2h8z"/>'
    + '<rect class="a" x="7" y="19.6" width="10" height="2" rx="1"/>'
    + '<circle class="a" cx="12" cy="4.6" r="1.9"/>');

  ic('mind','عقل ونفس',
    '<path class="m" d="M15 3.2a6 6 0 0 1 1.6 11.8V21H9.2v-3.6H7a1.5 1.5 0 0 1-1.3-2.2l1.6-3A6.3 6.3 0 0 1 15 3.2z"/>'
    + '<path class="a" d="M13.4 6.4a3.1 3.1 0 1 0 2.2 5.3l-1.4-1.4a1.2 1.2 0 1 1-.8-2z"/>');

  /* الكرة الأرضية: حلقة بخطوط الطول والعرض — اختيار المستخدم (2026-08-20).
     القرص المصمت بخطوط عنبرية كان يُقرأ «كرة سلّة». */
  ic('globe','كرة أرضية',
    '<circle class="s" cx="12" cy="12" r="8.6" stroke-width="2.2"/>'
    + '<ellipse class="s" cx="12" cy="12" rx="3.8" ry="8.6" stroke-width="2"/>'
    + '<path class="sa" d="M3.6 12h16.8"/>'
    + '<path class="s" d="M5.4 7.4h13.2M5.4 16.6h13.2" stroke-width="1.6" opacity=".7"/>');

  ic('quran','مصحف',
    '<path class="m" d="M5.2 3.6h11.2a2.8 2.8 0 0 1 2.8 2.8v13.2c0 .7-.6 1.2-1.3 1-1.9-.6-3.8-.6-5.7 0-1.9.6-3.8.6-5.7 0a1.4 1.4 0 0 1-1-1.3V5a1.4 1.4 0 0 1 .7-1.4z"/>'
    + '<path class="a" d="M14.6 3.6h3.2v7l-1.6-1.4-1.6 1.4z"/>');

  ic('map','خريطة · اجتماعيات',
    '<path class="m" d="M2.6 6.2 8.4 4v13.6L2.6 19.8z"/>'
    + '<path class="m" d="M9.6 4 15.2 6.2v13.6L9.6 17.6z" opacity=".86"/>'
    + '<path class="m" d="M16.4 6.2 21.4 4v13.6l-5 2.2z" opacity=".72"/>'
    + '<path class="a" d="M12.4 7.4a2.6 2.6 0 0 1 2.6 2.6c0 2-2.6 4.6-2.6 4.6S9.8 12 9.8 10a2.6 2.6 0 0 1 2.6-2.6z"/>');

  /* ---------- لغات وعلوم ---------- */
  ic('arabic','لغة عربية',
    '<text class="m" x="12" y="17.4" text-anchor="middle" font-family="IBM Plex Sans Arabic, sans-serif" font-size="17" font-weight="700">ض</text>');

  ic('english','لغة إنجليزية',
    '<text class="m" x="12" y="17.6" text-anchor="middle" font-family="IBM Plex Sans, sans-serif" font-size="16" font-weight="700">A</text>');

  /* المجهر والرياضيات: أُعيدا إلى صورتهما الأولى بطلب المستخدم — أرتب عنده */
  ic('micro','مجهر',
    '<path class="m" d="M10.6 3.4h3.2v7.2h-3.2z" transform="rotate(-18 12.2 7)"/>'
    + '<path class="m" d="M8.6 12.4h6.2v2.2H8.6zM6.4 19.4h13v2H6.4z"/>'
    + '<path class="a" d="M13.4 14.6c2.6 0 4.6 2 4.6 4.6h-2c0-1.5-1.1-2.6-2.6-2.6z"/>');

  ic('math','رياضيات',
    '<path class="m" d="M4 19.6 19 4.6l1.4 1.4L5.4 21z"/>'
    + '<path class="m" d="M3.2 19.4h17.6v2H3.2z"/>'
    + '<path class="a" d="M8.4 8.6h1.6v5.2H8.4zM6.6 10.4h5.2V12H6.6z"/>');

  /* ---------- الشُّعب المضافة ---------- */
  ic('sport','تربية رياضية',
    '<circle class="m" cx="12" cy="12" r="8.8"/>'
    + '<path class="hole" d="M12 7.4 15.4 9.9l-1.3 4h-4.2l-1.3-4z"/>'
    + '<path class="ha" d="M12 3.4v3.6M4.6 10.2l3.2 1.1M19.4 10.2l-3.2 1.1M8 19.2l1.8-2.9M16 19.2l-1.8-2.9"/>');

  ic('art','تربية فنية',
    '<path class="m" d="M12 3c5.2 0 9 3.6 9 8 0 3.1-2.5 4.8-4.8 4.8h-1.6c-1 0-1.7.7-1.7 1.7 0 .5.2.8.5 1.2s.5.8.5 1.3c0 1-.9 1.8-2 1.8-5 0-9-4.2-9-9.4S6.8 3 12 3z"/>'
    + '<circle class="hole" cx="8.2" cy="9.4" r="1.7"/><circle class="hole" cx="12" cy="7.2" r="1.7"/>'
    + '<circle class="ca" cx="15.8" cy="9.6" r="1.7"/>');

  ic('music','تربية موسيقية',
    '<path class="m" d="M9.4 5.2 19.4 3.2v2.8L9.4 8z"/>'
    + '<path class="m" d="M9.4 5.2h1.9v11.4H9.4zM17.5 3.2h1.9v9.8h-1.9z"/>'
    + '<circle class="m" cx="7.4" cy="17.4" r="3"/>'
    + '<circle class="a" cx="15.5" cy="13.8" r="2.8"/>');

  ic('computer','حاسوب',
    '<path class="m" d="M3.4 4.4h17.2a1.4 1.4 0 0 1 1.4 1.4v9.4a1.4 1.4 0 0 1-1.4 1.4H3.4A1.4 1.4 0 0 1 2 15.2V5.8a1.4 1.4 0 0 1 1.4-1.4z"/>'
    + '<path class="hole" d="M5.4 7h9v1.7h-9zM5.4 10.3h6.4V12H5.4z"/>'
    + '<path class="m" d="M10.9 16.6h2.2v2.4h-2.2z"/>'
    + '<rect class="a" x="6.6" y="19" width="10.8" height="2.1" rx="1.05"/>');

  window.SHOUBA_ICONS = {
    map: I,
    list: Object.keys(I).map(function(id){ return { id:id, label:I[id].label }; }),
    svg: function (id, size) {
      var it = I[id]; if(!it) return '';
      return '<svg class="crest-svg" viewBox="0 0 24 24" width="' + (size||24) + '" height="' + (size||24) + '">'
           + it.body + '</svg>';
    },
    label: function (id) { return (I[id] || {}).label || ''; }
  };
})();
