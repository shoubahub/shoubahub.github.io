/* ===================================================================
   شعبة · خطط التوزيع المعتمدة عند رئيس الشعبة (2026-09-13، الخطوة ج من بناء شريط الخطة)
   ────────────────────────────────────────────────────────────────
   الخطط بيانات مرجعية لا في وثيقة الشعبة (حدها ٢ ميغابايت، وترسل مع كل حفظ): تجلب من الخادم
   (api/plans — المعتمدة لمرحلة الشعبة وحدها) وتحفظ نسختها في مخزن الجهاز، فتظهر فورا دون انتظار
   وتعمل بلا انترنت. وتحدث في الخلفية ببصمتها v: ان لم يتغير شيء اجاب الخادم «لا جديد».
   الربط بمواد الشعبة وحساب الاسبوع في derive.js (S.planLinks) — هنا الجلب والحفظ وحدهما.

   ⚠ الجلب لا يستسلم (2026-09-19، رصد زميل المستخدم: «تجلب خطط التوزيع…» لا تنتهي عنده):
     · تعثر طلب واحد كان يترك الشاشة على «تجلب…» ابدا ولا يعيد المحاولة — الآن محاولات متباعدة،
       ومع عودة الاتصال، ومع عودة المنصة الى الواجهة (shouba:resume).
     · وجواب فارغ لا يمحو نسخة سليمة محفوظة: «لا خطط» لا تعني «امح ما عندك».
     · فان فشلت المحاولات كلها فالحال معلنة (state='fail' وسببها) لا صامتة — والشاشة تعرض «أعد المحاولة».
   =================================================================== */
(function () {
  var KEY = 'shouba.plans', listeners = [];
  function read() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function write(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }
  var cache = read();

  /* المحاولات: متباعدة صاعدة ثم تقف — ولا تستأنف الا بحدث (اتصال · عودة · لمسة «أعد المحاولة») */
  var WAITS = [3000, 8000, 20000, 60000], tries = 0, timer = null, busy = false, lastStage = '';
  var state = { at: 'idle', why: '' };   /* idle · loading · ok · fail — والسبب: offline · auth · net */

  function tell() { listeners.forEach(function (fn) { try { fn(cache, ShoubaPlans.state()); } catch (e) {} }); }
  function has(stage) { return !!(cache && cache.stage === stage && (cache.plans || []).length); }
  function stop() { if (timer) { clearTimeout(timer); timer = null; } }

  function fail(why, stage) {
    var more = tries < WAITS.length, wait = more ? WAITS[tries++] : 0;
    /* اول تعثر قد يكون عابرا فلا يزعج بشيء، وما بعده يعلن ولو كانت المحاولات ماضية في الخلفية —
       فلا يقعد صاحبها امام «تجلب…» دقيقة ونصفا لا يدري (رصد زميل المستخدم 2026-09-19) */
    state = { at: (tries > 1 || !more) ? 'fail' : 'loading', why: why };
    if (more) { stop(); timer = setTimeout(function () { timer = null; ShoubaPlans.load(stage); }, wait); }
    tell();
  }

  window.ShoubaPlans = {
    /* النسخة المحفوظة: { stage, v, set, calendar, plans } او null */
    get: function (stage) { return cache && (!stage || cache.stage === stage) ? cache : null; },
    /* حال الجلب لمن يعرضها: { at, why } — at: idle · loading · ok · fail */
    state: function () { return { at: state.at, why: state.why }; },
    onChange: function (fn) { listeners.push(fn); },
    /* يعيد المحاولة من اولها بطلب صاحبها (زر «أعد المحاولة») */
    retry: function (stage) { tries = 0; stop(); return this.load(stage || lastStage); },
    /* يجلب المعتمد لمرحلة الشعبة ان تغير، ويعيد النسخة الحاضرة — ولا يرمي: بلا خادم او بلا جلسة تبقى المحفوظة */
    load: function (stage) {
      if (!stage || !window.fetch) return Promise.resolve(this.get(stage));
      lastStage = stage;
      if (busy) return Promise.resolve(this.get(stage));
      busy = true;
      if (state.at !== 'loading') { state = { at: 'loading', why: state.why }; tell(); }
      var have = cache && cache.stage === stage ? cache.v : '';
      return fetch('api/plans?stage=' + encodeURIComponent(stage) + (have ? '&v=' + encodeURIComponent(have) : ''),
                   { credentials: 'same-origin', cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) { busy = false; fail(r.status === 401 ? 'auth' : 'net', stage); return ShoubaPlans.get(stage); }
          return r.json().then(function (j) {
            busy = false; tries = 0; stop();
            if (!j) { fail('net', stage); return ShoubaPlans.get(stage); }
            /* ⚠ جواب بلا خطط لا يمحو نسخة سليمة: قد يكون خللا في الخادم او مرحلة لم تقرأ بعد */
            if (!j.same && !(j.plans || []).length && has(stage)) { state = { at: 'ok', why: '' }; tell(); return cache; }
            if (!j.same) {
              cache = { stage: stage, v: j.v, set: j.set, calendar: j.calendar || [], plans: j.plans || [] };
              write(cache);
            }
            state = { at: 'ok', why: '' };
            tell();
            return cache;
          });
        })
        .catch(function () {
          busy = false;
          fail(window.navigator && navigator.onLine === false ? 'offline' : 'net', stage);
          return ShoubaPlans.get(stage);
        });
    }
  };

  /* المحاولة تستأنف مع الحدث لا بالتكرار الاعمى: عودة الاتصال · عودة المنصة الى الواجهة (components.js) */
  function wake() { if (lastStage && state.at !== 'ok') { tries = 0; stop(); ShoubaPlans.load(lastStage); } }
  if (window.addEventListener) {
    window.addEventListener('online', wake);
    document.addEventListener('shouba:resume', wake);   /* يطلق على document في components.js (bindResume) */
  }
})();
