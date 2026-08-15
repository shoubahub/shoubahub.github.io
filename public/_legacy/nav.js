// تنقّل «شعبة» بين الشاشات (محلي، بلا خادم) — يربط العناصر حسب نصّها.
(function(){
  var GO = {
    'القسم':'/dashboard.html', 'اللوحة':'/dashboard.html',
    'السجلّات':'/records.html', 'المعلّمون':'/teachers.html',
    'الجدول':'/schedule.html', 'الرزنامة الكاملة':'/schedule.html',
    'تسجيل الدخول':'/login.html',
  };

  function go(url){ if(url) location.href = url; }

  // 1) الشريط السفلي: كل عنصر .it حسب نصّه
  document.querySelectorAll('.tabbar .it').forEach(function(it){
    var label = it.textContent.trim();
    var url = GO[label];
    if(url){ it.style.cursor='pointer'; it.addEventListener('click', function(){ go(url); }); }
  });
  // زرّ الإضافة (+) في الوسط → نموذج/إجراء جديد (مبدئياً: السجلّات)
  document.querySelectorAll('.tabbar .fab').forEach(function(f){
    f.style.cursor='pointer'; f.addEventListener('click', function(){ go('/records.html'); });
  });

  // 2) أزرار محدّدة حسب النصّ (في أي مكان)
  var TEXT_LINKS = [
    { match:['المتابعة بحساب جوجل','ابدأ العمل'], url:'/setup.html' }, // الدخول → الإعداد
  ];
  // «ابدأ العمل» في الإعداد → اللوحة (نميّزها حسب الصفحة)
  var path = location.pathname;
  document.querySelectorAll('.cta, .primary, .b1, .b2, .btn').forEach(function(btn){
    var t = btn.textContent.trim();
    if(t.indexOf('جوجل')>-1){ btn.style.cursor='pointer'; btn.addEventListener('click', function(){ go('/setup.html'); }); }
    else if(t==='ابدأ العمل'){ btn.style.cursor='pointer'; btn.addEventListener('click', function(){ go('/dashboard.html'); }); }
    else if(t==='إنشاء حساب جديد'||t==='تسجيل الدخول'){ btn.style.cursor='pointer'; btn.addEventListener('click', function(){ go('/login.html'); }); }
  });

  // 3) روابط نصّية (.link) وبطاقات — حسب النصّ
  document.querySelectorAll('.link, .rowh .link, .go').forEach(function(el){
    var t = el.textContent.trim();
    if(t==='الرزنامة الكاملة'){ el.style.cursor='pointer'; el.addEventListener('click', function(){ go('/schedule.html'); }); }
    if(t==='الملف ›'||t==='الملف'){ el.style.cursor='pointer'; el.addEventListener('click', function(){ go('/teachers.html'); }); }
  });

  // 4) زرّ الرجوع (السهم في الأعلى) → للخلف
  document.querySelectorAll('.back, .navrow .back, .head .nb').forEach(function(b){
    b.style.cursor='pointer'; b.addEventListener('click', function(){ history.length>1 ? history.back() : go('/dashboard.html'); });
  });
})();
