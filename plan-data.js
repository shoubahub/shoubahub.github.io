/* ===================================================================
   شعبة · خطط التوزيع المعتمدة عند رئيس الشعبة (2026-09-13، الخطوة ج من بناء شريط الخطة)
   ────────────────────────────────────────────────────────────────
   الخطط بيانات مرجعية لا في وثيقة الشعبة (حدها ٢ ميغابايت، وترسل مع كل حفظ): تجلب من الخادم
   (api/plans — المعتمدة لمرحلة الشعبة وحدها) وتحفظ نسختها في مخزن الجهاز، فتظهر فورا دون انتظار
   وتعمل بلا انترنت. وتحدث في الخلفية ببصمتها v: ان لم يتغير شيء اجاب الخادم «لا جديد».
   الربط بمواد الشعبة وحساب الاسبوع في derive.js (S.planLinks) — هنا الجلب والحفظ وحدهما.
   =================================================================== */
(function () {
  var KEY = 'shouba.plans', listeners = [];
  function read() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function write(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }
  var cache = read();

  window.ShoubaPlans = {
    /* النسخة المحفوظة: { stage, v, set, calendar, plans } او null */
    get: function (stage) { return cache && (!stage || cache.stage === stage) ? cache : null; },
    onChange: function (fn) { listeners.push(fn); },
    /* يجلب المعتمد لمرحلة الشعبة ان تغير، ويعيد النسخة الحاضرة — ولا يرمي: بلا خادم او بلا جلسة تبقى المحفوظة */
    load: function (stage) {
      if (!stage || !window.fetch) return Promise.resolve(this.get(stage));
      var have = cache && cache.stage === stage ? cache.v : '';
      return fetch('api/plans?stage=' + encodeURIComponent(stage) + (have ? '&v=' + encodeURIComponent(have) : ''),
                   { credentials: 'same-origin', cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j || j.same) return ShoubaPlans.get(stage);
          cache = { stage: stage, v: j.v, set: j.set, calendar: j.calendar || [], plans: j.plans || [] };
          write(cache);
          listeners.forEach(function (fn) { try { fn(cache); } catch (e) {} });
          return cache;
        })
        .catch(function () { return ShoubaPlans.get(stage); });
    }
  };
})();
