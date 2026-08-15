// QismHub Platform — واجهة SPA (المرحلة الأولى: التسجيل والإعداد)
// حالياً مبنية: الشاشة ٠ (ترحيب) + الشاشة ١ (الحساب). البقية تُبنى تِباعاً.

const view = document.getElementById('view');

// حالة الإعداد (تتجمّع عبر الشاشات، تُحفظ في الخادم لاحقاً)
const state = {
  auth: { method: null, name: '', email: '', password: '' },
};

// أدوات صغيرة
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s) => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const GOOGLE_SVG = `<svg class="gicon" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16 4 9.1 8.6 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 34.9 26.7 36 24 36c-5.3 0-9.7-2.6-11.3-6.8l-6.5 5C9.1 39.4 16 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C40.9 36.9 44 31.3 44 24c0-1.2-.1-2.3-.4-3.5z"/></svg>`;

// شريط التقدّم (٥ خطوات بعد الحساب: الحساب لا يُعدّ خطوة في المعالج الرقمي)
function steps(active) {
  const labels = ['الحساب', 'المدرسة', 'القسم', 'المعلمون', 'الانطلاق'];
  const dots = labels.map((_, i) => `<span class="dot ${i <= active ? 'on' : ''}"></span>`).join('');
  return `<div class="steps">${dots}<span class="lbl">خطوة ${active + 1} من ٥ · ${labels[active]}</span></div>`;
}

// ============ الشاشة ٠: الترحيب ============
function screenWelcome() {
  view.innerHTML = '';
  const c = el(`
    <div class="card">
      <p class="h">أهلاً بك في QismHub</p>
      <p class="sub">أداة رئيس الشعبة لتنظيم قسمه: سجلاته، معلموه، ومتابعته — في مكان واحد.</p>
      <div class="field"><button class="btn" id="toRegister">إنشاء حساب جديد</button></div>
      <div class="field"><button class="btn ghost" id="toLogin">تسجيل الدخول</button></div>
      <p class="note">مجاني للبدء · بياناتك خاصة بك</p>
    </div>`);
  c.querySelector('#toRegister').onclick = () => screenAccount();
  c.querySelector('#toLogin').onclick = () => screenLogin();
  view.appendChild(c);
}

// ============ الشاشة ١: بيانات الحساب (تسجيل) ============
function screenAccount() {
  view.innerHTML = '';
  const a = state.auth;
  const c = el(`
    <div class="card">
      ${steps(0)}
      <p class="h">إنشاء حساب</p>
      <p class="sub">ابدأ بالطريقة الأسرع، أو أدخل بريدك.</p>

      <button class="btn google" id="google">${GOOGLE_SVG} المتابعة بحساب جوجل</button>
      <div class="sep">أو</div>

      <div class="field">
        <label>اسم رئيس الشعبة <span class="req">*</span> <span class="hint">(الاسم الكامل الرسمي)</span></label>
        <input type="text" id="name" value="${esc(a.name)}" placeholder="مثال: محمد عبدالله البراك" />
      </div>
      <div class="field">
        <label>البريد الإلكتروني <span class="req">*</span></label>
        <input type="email" id="email" value="${esc(a.email)}" placeholder="name@example.com" dir="ltr" />
      </div>
      <div class="field">
        <label>كلمة المرور <span class="req">*</span></label>
        <input type="password" id="pass" placeholder="٨ أحرف على الأقل" />
      </div>
      <div class="field">
        <label>تأكيد كلمة المرور <span class="req">*</span></label>
        <input type="password" id="pass2" placeholder="أعد كتابتها" />
      </div>

      <button class="btn" id="next">التالي ←</button>
      <div class="err" id="err"></div>
      <p class="linkline">لديك حساب؟ <a id="toLogin">تسجيل الدخول</a></p>
    </div>`);

  const err = c.querySelector('#err');
  const show = (m) => err.textContent = m;

  c.querySelector('#google').onclick = () => {
    // ربط جوجل الفعلي يُضاف على شبكة المنزل — الآن نحاكي جلب الاسم/البريد
    show('');
    a.method = 'google';
    a.name = a.name || 'اسم من جوجل';
    a.email = a.email || 'you@gmail.com';
    // لا نتخطّى الشاشة: نعرضها مملوءة ليراجع الاسم الرسمي
    screenAccount();
    setTimeout(() => {
      const note = el('<p class="note" style="color:var(--brand-d)">تم جلب بياناتك من جوجل — راجع اسمك الكامل ثم تابع.</p>');
      view.querySelector('.card').appendChild(note);
      view.querySelector('#pass').closest('.field').style.display = 'none';
      view.querySelector('#pass2').closest('.field').style.display = 'none';
    }, 0);
  };

  c.querySelector('#next').onclick = () => {
    const name = c.querySelector('#name').value.trim();
    const email = c.querySelector('#email').value.trim();
    const isGoogle = a.method === 'google';
    const pass = isGoogle ? 'google' : c.querySelector('#pass').value;
    const pass2 = isGoogle ? 'google' : c.querySelector('#pass2').value;

    if (!name) return show('اكتب اسمك الكامل.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return show('أدخل بريداً صحيحاً.');
    if (!isGoogle && pass.length < 8) return show('كلمة المرور ٨ أحرف على الأقل.');
    if (!isGoogle && pass !== pass2) return show('كلمتا المرور غير متطابقتين.');

    a.name = name; a.email = email; a.password = pass;
    // الشاشة ٢ (المدرسة) — تُبنى في الخطوة التالية من البناء
    view.innerHTML = '<div class="card"><p class="h">تم حفظ بيانات الحساب ✅</p>' +
      '<p class="sub">الشاشة التالية (بيانات المدرسة) قيد البناء — نكملها تِباعاً.</p>' +
      `<p class="note">الاسم: ${esc(a.name)} · البريد: ${esc(a.email)} · الطريقة: ${isGoogle ? 'جوجل' : 'بريد'}</p></div>`;
  };

  c.querySelector('#toLogin').onclick = () => screenLogin();
  view.appendChild(c);
}

// ============ شاشة الدخول (مبدئية) ============
function screenLogin() {
  view.innerHTML = '';
  const c = el(`
    <div class="card">
      <p class="h">تسجيل الدخول</p>
      <p class="sub">أدخل بياناتك للوصول إلى لوحة قسمك.</p>
      <button class="btn google" id="google">${GOOGLE_SVG} الدخول بحساب جوجل</button>
      <div class="sep">أو</div>
      <div class="field"><label>البريد الإلكتروني</label><input type="email" dir="ltr" placeholder="name@example.com" /></div>
      <div class="field"><label>كلمة المرور</label><input type="password" placeholder="كلمة المرور" /></div>
      <button class="btn" id="login">دخول</button>
      <div class="err" id="err"></div>
      <p class="linkline">لا حساب لديك؟ <a id="toRegister">إنشاء حساب</a></p>
    </div>`);
  c.querySelector('#login').onclick = () => c.querySelector('#err').textContent = 'ربط الدخول الفعلي يُضاف على شبكة المنزل (مع قاعدة البيانات).';
  c.querySelector('#google').onclick = () => c.querySelector('#err').textContent = 'ربط جوجل يُضاف على شبكة المنزل.';
  c.querySelector('#toRegister').onclick = () => screenAccount();
  view.appendChild(c);
}

// انطلاق
screenWelcome();
