/* شعبة · إشعارات المعلم — قسمها في صفحتين (2026-11-06، tpush.js):
   t.html (رابط المعلم والواجهة غير منشورة) وتبويب «إشعاراتي» في face.html (رابط المعلم والواجهة منشورة —
   قرار المستخدم: «الا يمكن دمجهم برابط واحد؟»). العناصر بأسمائها: .part · .lead2 · .btn-ghost · .msg · .pick
   ⚠ لا تقرأ وثيقة الشعبة ولا مخزن الجهاز: كل ما فيها من api/t/<الرمز> */
(function(){
  var TOKEN = (location.pathname.match(/^\/t\/([0-9a-f]{16})/) || [])[1] || '';
  var API = '/api/t/' + TOKEN;
  var CHK = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6.4 L4.6 9 L10 3" stroke="#F4F1EA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var KINDS = [
    { k: 'pre',   t: 'قبل بداية الحصة', s: ['قبلها بـ', '5', ' دقائق'] },
    { k: 'start', t: 'عند بداية الحصة', s: ['في أول دقيقة منها'] },
    { k: 'end',   t: 'قبل نهاية الحصة', s: ['قبلها بـ', '5', ' دقائق لتختم درسك'] }
  ];

  function el(tag, cls, txt){ var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function num(t){ return el('span', 'num', t); }
  function say(m, t, good){ m.textContent = t || ''; m.classList.toggle('ok', !!good); }
  function api(method, url, body){
    return fetch(url, { method: method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ return { ok: r.ok, status: r.status, j: j }; }); });
  }
  function u8(b64){
    var s = (b64 + '===='.slice((b64.length % 4) || 4)).replace(/-/g, '+').replace(/_/g, '/'), raw = atob(s), out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }


  /* ملف التطبيق برمز المعلم: من أضاف الصفحة إلى الشاشة الرئيسية تفتح له أيقونتها على رابطه هو */
  function manifest(){
    if (!TOKEN || document.querySelector('link[rel=manifest]')) return;
    var mf = document.createElement('link'); mf.rel = 'manifest'; mf.href = '/t/' + TOKEN + '/manifest.webmanifest';
    document.head.appendChild(mf);
    if (!document.querySelector('link[rel=apple-touch-icon]')) {
      var ic = document.createElement('link'); ic.rel = 'apple-touch-icon'; ic.href = '/identity/assets/app-icon-approved.png';
      document.head.appendChild(ic);
    }
  }
  manifest();

  /* يبني القسم في wrap ببيانات P (جواب api/t/<الرمز>) */
  /* «المواعيد» (2026-11-09، طلب المستخدم: «تبويب مواعيد بجانب الرسائل»): مواعيد التسليم القادمة وأيام مراقبة الشعبة */
  function dates(wrap, P){
    /* مواعيد التسليم القادمة (2026-11-06، قرار المستخدم 17:38): ما لم يسلّمه، بالأقرب */
    var dl = P.deadlines || [];
    wrap.appendChild(el('div', 'part', 'مواعيد التسليم'));
    if (!dl.length) wrap.appendChild(el('p', 'lead2', 'لا مواعيد تسليم قادمة.'));
    else {
      var dls = el('div', 'stack');
      dl.forEach(function(d){
        var r = el('div', 'pick due');
        r.innerHTML = '<div class="tx"><b></b><small></small></div>';
        r.querySelector('b').textContent = d.title;
        r.querySelector('small').textContent = d.when;
        dls.appendChild(r);
      });
      wrap.appendChild(dls);
    }
    /* أيام مراقبة الشعبة (duty.js): أيامها وفرصها بأوقاتها */
    var du = P.duty || {}, days = du.days || [], br = du.breaks || [];
    wrap.appendChild(el('div', 'part', 'مراقبة الشعبة'));
    if (!days.length) wrap.appendChild(el('p', 'lead2', 'لم تُحدَّد أيام المراقبة بعد.'));
    else {
      var r = el('div', 'pick due');
      r.innerHTML = '<div class="tx"><b></b><small></small></div>';
      r.querySelector('b').textContent = days.join(' · ');
      r.querySelector('small').textContent = br.length
        ? 'في ' + br.map(function(b){ return b.label + ' ' + b.from + '–' + b.to; }).join('، و') : 'في الفرص';
      var st = el('div', 'stack'); st.appendChild(r); wrap.appendChild(st);
    }
  }

  /* «الرسائل» (2026-11-09، طلب المستخدم: «تبويب للرسائل بحيث يدخل عليه المعلم فيجد الرسالة الجديدة و الارشيف كامل»):
     الأحدث أولا، وما لم يره هذا الجهاز «جديدة». seen() يسجل أنه رآها (حين يفتح التبويب) — onCount يحدّث رقم التبويب */
  function when(isoAt){
    var d = new Date(isoAt); if (isNaN(d.getTime())) return '';
    var p = function(x){ return (x < 10 ? '0' : '') + x; }, n = new Date();
    var day = d.toDateString() === n.toDateString() ? 'اليوم' : d.getDate() + ' / ' + (d.getMonth() + 1);
    return day + ' · ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function messages(wrap, P, onCount){
    wrap.appendChild(el('div', 'part', 'الرسائل'));
    var box = el('div', 'stack'), note = el('div', 'msg');
    wrap.appendChild(box); wrap.appendChild(note);
    var top = 0, loaded = false, want = false;
    api('GET', API + '/messages').then(function(r){
      if (!r.ok) { say(note, 'تعذر جلب الرسائل. أعد فتح الصفحة بعد قليل.'); return; }
      var list = r.j.messages || [], seen = r.j.seen || 0;
      if (!list.length) box.appendChild(el('p', 'lead2', 'لا رسائل بعد.'));
      list.forEach(function(m){
        var fresh = m.id > seen;
        var c = el('div', 'pick due' + (fresh ? ' new' : ''));
        c.innerHTML = '<div class="tx"><small></small><b></b><p></p></div>';
        c.querySelector('small').textContent = (fresh ? 'جديدة · ' : '') + when(m.at);
        c.querySelector('b').textContent = m.title;
        c.querySelector('p').textContent = m.body;
        box.appendChild(c);
        if (m.id > top) top = m.id;
      });
      loaded = true;
      if (want) seenNow();
    }).catch(function(){ say(note, 'لا اتصال بالإنترنت. افتح الصفحة حين تتصل.'); });
    function seenNow(){
      if (!loaded) { want = true; return; }
      if (onCount) onCount(0);
      if (top) api('POST', API + '/seen', { id: top }).catch(function(){});
    }
    if (onCount) onCount(P.unread || 0);
    return { seen: seenNow };
  }

  /* إعدادات الإشعارات: التفعيل وتنبيهات الحصة — في آخر «الرسائل» (قرار المستخدم 2026-11-09) */
  function settings(wrap, P){
    /* أُلغي جهازه والصفحة مفتوحة (رصد معاينة السلوك، النسخة 0.41.0 · بناء 139): يسأل عن حاله حين يعود إليها وكل دقيقة،
       فإن لم يعد مقبولا أعاد التحميل فيخدمه الخادم صفحة حاله — فلا تبقى «مفعّلة على هذا الجهاز» وهي ليست كذلك */
    function still(){
      if (document.hidden) return;
      api('GET', API).then(function(r){ if (r.ok && r.j.state && r.j.state !== 'ok') location.reload(); }).catch(function(){});
    }
    document.addEventListener('visibilitychange', still);
    setInterval(still, 60000);
    wrap.appendChild(el('div', 'part', 'إشعارات الجوال'));
    var lead = el('p', 'lead2'), btn = el('button', 'btn-ghost'), msg = el('div', 'msg');
    btn.type = 'button'; btn.hidden = true;
    wrap.appendChild(lead); wrap.appendChild(btn); wrap.appendChild(msg);

    /* تنبيهات الحصة: الثلاثة مفعلة ابتداء، ويطفئ المعلم ما لا يريد — ورسائل رئيس الشعبة لا تطفأ */
    var part2 = el('div', 'part', 'تنبيهات حصصك'), list = el('div', 'stack'), note = el('p', 'lead2', 'ورسائل رئيس الشعبة تصلك دائماً.');
    var pmsg = el('div', 'msg');
    wrap.appendChild(part2); wrap.appendChild(list); wrap.appendChild(note); wrap.appendChild(pmsg);
    KINDS.forEach(function(o){ list.appendChild(row(o)); });
    function row(o){
      var r = el('div', 'pick');
      r.setAttribute('role', 'checkbox'); r.tabIndex = 0;
      r.innerHTML = '<span class="mark">' + CHK + '</span><div class="tx"><b></b><small></small></div>';
      r.querySelector('b').textContent = o.t;
      var sm = r.querySelector('small');
      o.s.forEach(function(x){ sm.appendChild(/^\d+$/.test(x) ? num(x) : document.createTextNode(x)); });
      function set(on){ r.classList.toggle('on', on); r.setAttribute('aria-checked', on ? 'true' : 'false'); }
      set(!!P.prefs[o.k]);
      function tap(){
        var next = !P.prefs[o.k], body = { endpoint: mine }; body[o.k] = next;
        set(next); say(pmsg, '');
        api('PUT', API + '/prefs', body).then(function(x){
          if (!x.ok) throw new Error('save');
          P.prefs = x.j.prefs; set(!!P.prefs[o.k]);
        }).catch(function(){ set(!!P.prefs[o.k]); say(pmsg, 'لا اتصال — لم يتغير اختيارك.'); });
      }
      r.addEventListener('click', tap);
      r.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(); } });
      return r;
    }
    function prefsShown(on){ part2.hidden = list.hidden = note.hidden = !on; if (!on) say(pmsg, ''); }
    prefsShown(false);

    /* ⚠ آيفون لا يعطي الإشعارات إلا للصفحة المضافة إلى الشاشة الرئيسية (iOS 16.4 فأحدث) — ففي سفاري
       يظهر الإرشاد بدل الزر. وطلب الإذن داخل الضغطة نفسها: المتصفح يرفضه بلا فعل من المستخدم */
    var ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var standalone = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
    var can = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!can) {
      lead.textContent = ios && !standalone
        ? 'على آيفون تصل الإشعارات إلى الصفحة المضافة إلى الشاشة الرئيسية وحدها: افتح هذا الرابط في سفاري، والمس زر المشاركة، ثم «إضافة إلى الشاشة الرئيسية»، وافتحها من أيقونتها.'
        : 'هذا المتصفح لا يدعم الإشعارات. افتح الرابط في متصفح محدّث.';
      return;
    }
    function blocked(){
      lead.textContent = 'الإشعارات ممنوعة لهذه الصفحة في إعدادات جهازك. اسمح بها من الإعدادات، ثم ارجع إلى هنا.';
      btn.hidden = true; prefsShown(false);
    }
    /* الرابط لجهاز واحد (2026-11-06): مفعل على غير هذا الجهاز ⟵ لا زر، بل ارشاد الى رابط جديد */
    function locked(){
      lead.textContent = 'الإشعارات مفعّلة بهذا الرابط على جهاز آخر، والرابط لجهاز واحد. اطلب من رئيس الشعبة رابطاً جديداً لهذا الجهاز.';
      btn.hidden = true; prefsShown(false);
    }
    function show(on){
      lead.textContent = '';
      if (on) { var b = el('b', null, 'مفعّلة'); b.style.color = 'var(--shouba-success)'; lead.appendChild(b); }
      lead.appendChild(document.createTextNode(on ? ' على هذا الجهاز: تنبيهات حصصك ومواعيد التسليم، ورسائل رئيس الشعبة.'
                                                  : 'تصلك على هذا الجهاز ولو كانت الصفحة مغلقة: تنبيهات حصصك ومواعيد التسليم، ورسائل رئيس الشعبة.'));
      btn.textContent = on ? 'أوقف الإشعارات على هذا الجهاز' : 'فعّل الإشعارات على هذا الجهاز';
      btn.hidden = false; btn.disabled = false; btn.dataset.on = on ? '1' : '';
      prefsShown(on);
    }

    var reg = null, mine = '';
    navigator.serviceWorker.register('/t/sw.js', { scope: '/t/' }).then(function(){
      return navigator.serviceWorker.getRegistration('/t/');
    }).then(function(r){
      reg = r;
      return r.pushManager.getSubscription();
    }).then(function(sub){
      if (Notification.permission === 'denied') return blocked();
      var on = !!sub && Notification.permission === 'granted';
      if (!on) return show(false);   /* الجهاز مقبول (2026-11-08) — فلا قفل «مفعّل على جهاز آخر» بعد اليوم */
      /* جهاز مشترك من قبل: يؤكد اشتراكه عند الخادم بلا إشعار ترحيب — فإن رده لأن غيره صار المفعل، فهو مقفل */
      mine = sub.endpoint; show(true);
      api('POST', API + '/subscribe', { subscription: sub.toJSON(), quiet: true })
        .then(function(r){
          /* مقفل على جهاز آخر: يلغى اشتراك هذا الجهاز كما في مسار التفعيل، فلا تبقى بقية معلقة (معاينة السلوك، بناء 132) */
          if (r.status === 409) { mine = ''; sub.unsubscribe().catch(function(){}); locked(); }
        }).catch(function(){});
    }).catch(function(){ show(false); });

    btn.addEventListener('click', function(){
      say(msg, ''); btn.disabled = true;
      if (btn.dataset.on) {
        reg.pushManager.getSubscription().then(function(sub){
          if (!sub) return;
          var ep = sub.endpoint;
          return sub.unsubscribe().then(function(){ return api('POST', API + '/unsubscribe', { endpoint: ep }); });
        }).then(function(){ mine = ''; show(false); say(msg, 'أوقفت الإشعارات على هذا الجهاز.', true); })
          .catch(function(){ btn.disabled = false; say(msg, 'تعذر الإيقاف — أعد المحاولة.'); });
        return;
      }
      Notification.requestPermission().then(function(p){
        if (p !== 'granted') { btn.disabled = false; if (p === 'denied') blocked(); return; }
        return reg.pushManager.getSubscription().then(function(old){
          return old || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(P.key) });
        }).then(function(sub){
          return api('POST', API + '/subscribe', { subscription: sub.toJSON() }).then(function(r){
            /* مقفل على جهاز آخر: يلغى اشتراك هذا الجهاز فلا يبقى معلقا */
            if (r.status === 409) return sub.unsubscribe().catch(function(){}).then(function(){ locked(); return null; });
            if (!r.ok) throw new Error('save');
            mine = sub.endpoint; return r;
          });
        }).then(function(r){
          if (!r) return;
          show(true); say(msg, 'فُعّلت الإشعارات على هذا الجهاز.', true);
        });
      }).catch(function(){ btn.disabled = false; say(msg, 'تعذر التفعيل — تأكد من الاتصال وأعد المحاولة.'); });
    });
  }

  /* ما قبل القبول (2026-11-08، اقتراح المستخدم: «يصلني زر تفعيل او قبول فيفتح له الرابط»): من فتح الرابط لا يرى
     شيئا حتى يقبل رئيس الشعبة جهازه — فهنا حاله وحدها: يطلب · ينتظر · رُفض · توقف.
     ⚠ آيفون: سفاري وأيقونة الشاشة الرئيسية جهازان (لكل منهما كعكاته) — فلا يطلب من سفاري، بل يرشد إلى التثبيت
       ثم يطلب من الأيقونة، فيصل رئيس الشعبة طلب واحد (قرار المستخدم 05:11) */
  function gate(wrap, state){
    var ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var standalone = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
    var part = el('div', 'part'), lead = el('p', 'lead2'), msg = el('div', 'msg');
    wrap.appendChild(part); wrap.appendChild(lead); wrap.appendChild(msg);
    function paint(st){
      if (st === 'pending') {
        part.textContent = 'بانتظار موافقة رئيس الشعبة';
        lead.textContent = 'أُرسل طلبك إلى رئيس الشعبة. تُفتح الصفحة هنا حين يوافق.';
        wait();
      } else if (st === 'no') {
        part.textContent = 'لم يُقبل هذا الجهاز';
        lead.textContent = 'اطلب من رئيس الشعبة رابطاً جديداً.';
      } else if (st === 'gone') {
        part.textContent = 'توقف الرابط على هذا الجهاز';
        lead.textContent = 'قبل رئيس الشعبة جهازاً آخر لهذا الرابط أو ألغى هذا الجهاز. اطلب منه رابطاً جديداً إن احتجته.';
      } else if (st === 'ok') {
        location.reload();
      } else if (ios && !standalone) {
        part.textContent = 'ثبّت الصفحة على شاشتك أولاً';
        lead.textContent = 'افتح هذا الرابط في سفاري، والمس زر المشاركة، ثم «إضافة إلى الشاشة الرئيسية»، وافتحها من أيقونتها. ومن هناك يُرسل طلبك إلى رئيس الشعبة.';
      } else ask();
    }
    function ask(){
      part.textContent = 'بانتظار موافقة رئيس الشعبة'; lead.textContent = '';
      api('POST', API + '/ask', {}).then(function(r){
        if (r.ok) return paint(r.j.state);
        say(msg, r.j.error || 'تعذر إرسال الطلب. أعد فتح الصفحة بعد قليل.');
      }).catch(function(){ say(msg, 'لا اتصال بالإنترنت. افتح الصفحة حين تتصل.'); });
    }
    /* ينتظر وهو ينظر: يسأل كل ١٥ ثانية، وحين يعود إلى الصفحة — فإذا قُبل فتحت وحدها */
    var timer = null;
    function wait(){
      if (timer) return;
      function check(){
        if (document.hidden) return;
        api('GET', API).then(function(r){ if (r.ok && r.j.state !== 'pending') { clearInterval(timer); timer = null; paint(r.j.state); } }).catch(function(){});
      }
      timer = setInterval(check, 15000);
      document.addEventListener('visibilitychange', check);
    }
    paint(state);
  }

  /* صفحة بلا تبويبات (t.html — الواجهة غير منشورة): الأقسام متتالية، والرسائل تُعد مقروءة بفتحها */
  function mount(wrap, P){
    messages(wrap, P).seen();
    dates(wrap, P);
    settings(wrap, P);
  }

  window.TNotify = { token: TOKEN, api: api, load: function(){ return api('GET', API); }, mount: mount, gate: gate, el: el,
    messages: messages, dates: dates, settings: settings };
})();
