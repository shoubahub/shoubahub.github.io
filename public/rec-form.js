/* ===================================================================
   شعبة · لبنات السجلات — شاشة الادخال (2026-09-12)
   ────────────────────────────────────────────────────────────────
   تولد شاشة الادخال من تعريف القالب: لكل لبنة مولد واحد لكل القوالب — لا شاشة لسجل بعينه.
   الهاتف اولا واقل كتابة ممكنة: ما يملأ تلقائيا او يختار بلمسة لا يكتب.
   ⚠ من components.css وحده (.field · .paper · .sdrop · .segs · .btn-ghost · .rb-* · .att-*) — لا هيكل ولا لون هنا.
   ⚠ لا تشكيل (قاعدة المنصة).
   F.render(root, tpl, rec, ctx, onChange) — ctx: { teachers, open (القرارات المفتوحة قبل السجل) }
   يعدل rec.values في موضعه وينادي onChange(rec) — والحفظ للمنادي (Shouba.saveRec).
   المنفذ الآن: ① fields · ② text (paragraph · list · smart:followup · smart:decisions)
   · ⑦ signatures (smart:attendance). وسائر اللبنات في مراحلها — تتخطى هنا بصمت ولا تكسر.
   =================================================================== */
(function () {
  var F = window.ShoubaForm = {};
  var HEAD = 'رئيس الشعبة', ALL = 'جميع المعلمين';
  F.HEAD = HEAD; F.ALL = ALL;

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function latin(v) { return String(v == null ? '' : v).replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 0x660; }); }
  function dm(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? (+p[2]) + '/' + (+p[1]) : ''; }

  var TICK = '<span class="tick"><svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6.4 L4.6 9 L10 3" stroke="#F4F1EA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
  var CHEV = '<span class="chev"><svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M5 8 L10 13 L15 8" stroke="#8A7F6E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
  var ICON = {
    up:   '<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M5 12.5 10 7.5l5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    down: '<svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M5 7.5 10 12.5l5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    del:  '<svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    eye:  '<svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M1.8 10S5 4.5 10 4.5 18.2 10 18.2 10 15 15.5 10 15.5 1.8 10 1.8 10z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="10" cy="10" r="2.6" fill="currentColor"/></svg>'
  };

  /* حقل في ورقة المنصة */
  function input(value, onInput, opt) {
    opt = opt || {};
    var p = el('div', 'paper'), i = el(opt.long ? 'textarea' : 'input');
    if (!opt.long) i.type = opt.type || 'text';
    if (opt.numeric) i.inputMode = 'numeric';
    if (opt.rows) i.rows = opt.rows;
    if (opt.ph) i.placeholder = opt.ph;
    if (opt.label) i.setAttribute('aria-label', opt.label);
    i.value = value == null ? '' : value;
    i.addEventListener('input', function () { onInput(i.value); });
    /* التاريخ لا يقبل placeholder، وكروم يعرض فارغه «dd/mm/yyyy» بالانجليزية وسفاري لا يعرض شيئا —
       فالنائب العربي يرسم على الورقة ما دام الحقل فارغا (.paper.empty[data-ph]) */
    if (opt.type === 'date' && opt.ph) {
      p.setAttribute('data-ph', opt.ph);
      var sync = function () { p.classList.toggle('empty', !i.value); };
      i.addEventListener('input', sync); i.addEventListener('change', sync); sync();
    }
    p.appendChild(i);
    return { box: p, el: i };
  }
  /* منسدلة المنصة (لوحة سفلية) — تبنى هنا وتربط بـ Shouba.bindDrop */
  function drop(label, options, value, onPick, ph) {
    var d = el('div', 'sdrop'), t = el('button', 'trigger'), s = el('select');
    d.setAttribute('data-label', label);
    t.type = 'button';
    t.innerHTML = '<span class="val ph"></span>' + CHEV;
    t.querySelector('.val').textContent = ph || label;
    var o0 = el('option', null, ph || label);
    o0.value = ''; o0.disabled = true; o0.hidden = true;
    s.appendChild(o0);
    options.forEach(function (o) {
      var op = el('option', null, o.t);
      op.value = o.v;
      if (o.v === value) op.selected = true;
      s.appendChild(op);
    });
    if (!value) o0.selected = true;
    s.addEventListener('change', function () { onPick(s.value); });
    d.appendChild(t); d.appendChild(s);
    if (window.Shouba && Shouba.bindDrop) Shouba.bindDrop(d);
    return d;
  }
  /* ادوات البند: اعلى · اسفل · احذف — الترتيب بالاسهم لا بالسحب (قرار المستخدم: يعمل باللمس) */
  function tools(onUp, onDown, onDel) {
    var t = el('div', 'rb-tools');
    [[onUp, 'up', 'انقله أعلى'], [onDown, 'down', 'انقله أسفل'], [onDel, 'del', 'احذفه']].forEach(function (x) {
      var b = el('button', 'rb-btn' + (x[1] === 'del' ? ' del' : ''));
      b.type = 'button'; b.innerHTML = ICON[x[1]]; b.setAttribute('aria-label', x[2]);
      if (x[0]) b.addEventListener('click', x[0]); else b.disabled = true;
      t.appendChild(b);
    });
    return t;
  }
  function section(title, note) {
    var s = el('div', 'rb-sec');
    s.appendChild(el('div', 't', title));
    if (note) s.appendChild(el('div', 'hint', note));
    return s;
  }
  function addBtn(text, onClick) {
    var b = el('button', 'btn-ghost rb-add', '+ ' + text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }
  function focusLast(box, sel) { var a = box.querySelectorAll(sel); if (a.length) a[a.length - 1].focus(); }

  /* ── ① خانات البيانات ─────────────────────────────────────────── */
  var BLOCK = {};
  BLOCK.fields = function (b, v, ctx, changed) {
    var wrap = el('div', 'rb');
    b.fields.forEach(function (f) {
      var fld = el('div', 'field'), h = el('div', 'hint');
      fld.appendChild(el('label', null, f.label));
      function hint() {
        h.textContent = f.kind === 'date' && v[f.id] ? window.ShoubaRec.weekday(v[f.id])
          : f.auto === 'serial:year' ? 'يرقم تلقائيا — عدله إن لزم'
          : f.required ? 'مطلوب' : '';
      }
      if (f.kind === 'choice' || f.kind === 'teacher') {
        var opts = f.kind === 'teacher'
          ? (ctx.teachers || []).map(function (n) { return { v: n, t: 'أ. ' + n }; })
          : (f.options || []).map(function (o) { return { v: o, t: o }; });
        fld.appendChild(drop(f.label, opts, v[f.id], function (x) { v[f.id] = x; hint(); changed(); }, 'اختر'));
      } else {
        fld.appendChild(input(v[f.id], function (x) {
          if (f.kind === 'number') { var n = latin(x).trim(); v[f.id] = n === '' ? '' : (isNaN(+n) ? n : +n); }
          else v[f.id] = x;
          hint(); changed();
        }, { type: f.kind === 'date' ? 'date' : 'text', numeric: f.kind === 'number', long: f.kind === 'longtext', rows: 3, label: f.label }).box);
      }
      hint();
      fld.appendChild(h);
      wrap.appendChild(fld);
    });
    return wrap;
  };

  /* ── ② مساحة النص: الاقسام بترتيبها ────────────────────────────────
     العبارة الافتتاحية (lead) صيغة ورق تطبع وحدها — لا تظهر في الادخال فلا تزاحم الحقول */
  var SECTION = {};
  BLOCK.text = function (b, v, ctx, changed) {
    var wrap = el('div', 'rb');
    b.sections.forEach(function (s) {
      var n = SECTION[s.kind] && SECTION[s.kind](s, v, ctx, changed);
      if (n) wrap.appendChild(n);
    });
    return wrap;
  };

  SECTION.paragraph = function (s, v, ctx, changed) {
    var fld = el('div', 'field');
    fld.appendChild(el('label', null, s.title || ''));
    fld.appendChild(input(v[s.id], function (x) { v[s.id] = x; changed(); }, { long: true, rows: 4, label: s.title }).box);
    return fld;
  };

  /* قائمة مرقمة: لكل بند عنوان (مطلوب) وتفاصيل (اختيارية)، باضافة وحذف واعادة ترتيب */
  SECTION.list = function (s, v, ctx, changed) {
    var arr = v[s.id] = Array.isArray(v[s.id]) ? v[s.id] : [];
    var sec = section(s.title), box = el('div', 'stack');
    function move(i, d) { var x = arr.splice(i, 1)[0]; arr.splice(i + d, 0, x); changed(); paint(); }
    function paint() {
      box.textContent = '';
      arr.forEach(function (it, i) {
        var card = el('div', 'rb-item');
        card.appendChild(input(it.title, function (x) { it.title = x; changed(); }, { ph: s.ph || 'العنوان', label: (s.ph || 'العنوان') + ' ' + (i + 1) }).box);
        card.appendChild(input(it.details, function (x) { it.details = x; changed(); }, { long: true, rows: 2, ph: 'تفاصيل — اختياري' }).box);
        card.appendChild(tools(i > 0 ? function () { move(i, -1); } : null,
                               i < arr.length - 1 ? function () { move(i, 1); } : null,
                               function () { arr.splice(i, 1); changed(); paint(); }));
        box.appendChild(card);
      });
    }
    sec.appendChild(box);
    sec.appendChild(addBtn(s.add || 'أضف بندا', function () {
      arr.push({ title: '', details: '' }); changed(); paint(); focusLast(box, '.rb-item input');
    }));
    paint();
    return sec;
  };

  /* متابعة القرارات: المفتوح من السجلات السابقة للقالب نفسه (ctx.open) — «نفذ» يغلقه و«مستمر» ينقله.
     لا يظهر القسم ان لم يبق شيء مفتوح. والضغط على المختار يلغيه (يبقى القرار مفتوحا بلا تأشير) */
  SECTION['smart:followup'] = function (s, v, ctx, changed) {
    var open = ctx.open || [];
    if (!open.length) return null;
    var marks = v[s.id] = (v[s.id] && typeof v[s.id] === 'object' && !Array.isArray(v[s.id])) ? v[s.id] : {};
    var sec = section(s.title, 'قرارات لم تغلق بعد — أشر على كل منها'), box = el('div', 'stack');
    open.forEach(function (d) {
      var card = el('div', 'rb-item');
      card.appendChild(el('div', 'rb-q', d.text));
      var meta = [d.owner && ('المسؤول: ' + (d.owner === HEAD || d.owner === ALL ? d.owner : 'أ. ' + d.owner)), d.due && ('الموعد: ' + dm(d.due))].filter(Boolean).join(' · ');
      if (meta) card.appendChild(el('div', 'hint', meta));
      var segs = el('div', 'segs sm');
      [['done', 'نفذ'], ['cont', 'مستمر']].forEach(function (o) {
        var b = el('button', 'seg' + (marks[d.id] === o[0] ? ' on' : ''));
        b.type = 'button'; b.innerHTML = TICK + o[1];
        b.addEventListener('click', function () {
          if (marks[d.id] === o[0]) delete marks[d.id]; else marks[d.id] = o[0];
          [].forEach.call(segs.children, function (x, k) { x.classList.toggle('on', marks[d.id] === ['done', 'cont'][k]); });
          changed();
        });
        segs.appendChild(b);
      });
      card.appendChild(segs);
      box.appendChild(card);
    });
    sec.appendChild(box);
    return sec;
  };

  /* القرارات والتوصيات: النص + المسؤول (معلم · رئيس الشعبة · جميع المعلمين) + الموعد (اختياري).
     كل قرار جديد مفتوح حتى يؤشر عليه «نفذ» في اجتماع لاحق */
  SECTION['smart:decisions'] = function (s, v, ctx, changed) {
    var arr = v[s.id] = Array.isArray(v[s.id]) ? v[s.id] : [];
    var owners = [{ v: HEAD, t: HEAD }, { v: ALL, t: ALL }].concat((ctx.teachers || []).map(function (n) { return { v: n, t: 'أ. ' + n }; }));
    var sec = section(s.title), box = el('div', 'stack');
    function move(i, d) { var x = arr.splice(i, 1)[0]; arr.splice(i + d, 0, x); changed(); paint(); }
    function paint() {
      box.textContent = '';
      arr.forEach(function (x, i) {
        var card = el('div', 'rb-item');
        card.appendChild(input(x.text, function (t) { x.text = t; changed(); }, { ph: 'نص القرار', label: 'نص القرار ' + (i + 1) }).box);
        var row = el('div', 'rb-row');
        row.appendChild(drop('المسؤول', owners, x.owner, function (o) { x.owner = o; changed(); }, 'المسؤول — اختياري'));
        row.appendChild(input(x.due, function (t) { x.due = t; changed(); }, { type: 'date', label: 'موعد التنفيذ', ph: 'الموعد' }).box);
        card.appendChild(row);
        card.appendChild(tools(i > 0 ? function () { move(i, -1); } : null,
                               i < arr.length - 1 ? function () { move(i, 1); } : null,
                               function () { arr.splice(i, 1); changed(); paint(); }));
        box.appendChild(card);
      });
    }
    sec.appendChild(box);
    sec.appendChild(addBtn(s.add || 'أضف قرارا', function () {
      arr.push({ id: window.ShoubaRec.newId('d'), text: '', owner: '', due: '' }); changed(); paint(); focusLast(box, '.rb-item input[type=text]');
    }));
    paint();
    return sec;
  };

  /* ── ⑦ التوقيعات: الحضور (ذكي) ─────────────────────────────────
     معلمو الشعبة لقطة يوم الانشاء، والجميع حاضر افتراضا — لمسة تجعل المعلم غائبا.
     ويضاف حاضر من خارج الشعبة باسمه. الورق يطبع الحاضرين وحدهم وخانات التوقيع فارغة لليد. */
  BLOCK.signatures = function (b, v, ctx, changed) {
    if (b.mode !== 'smart:attendance') return null;
    v.roster = Array.isArray(v.roster) ? v.roster : [];
    v.absent = Array.isArray(v.absent) ? v.absent : [];
    v.guests = Array.isArray(v.guests) ? v.guests : [];
    var sec = section('الحضور'), cnt = el('div', 'hint'), chips = el('div', 'att');
    sec.appendChild(cnt);
    sec.appendChild(chips);
    function paint() {
      chips.textContent = '';
      v.roster.forEach(function (n) {
        var off = v.absent.indexOf(n) > -1, c = el('button', 'att-c' + (off ? ' off' : ''), 'أ. ' + n);
        c.type = 'button'; c.setAttribute('aria-pressed', off ? 'false' : 'true');
        c.addEventListener('click', function () {
          var i = v.absent.indexOf(n);
          if (i > -1) v.absent.splice(i, 1); else v.absent.push(n);
          changed(); paint();
        });
        chips.appendChild(c);
      });
      v.guests.forEach(function (g, i) {
        var c = el('button', 'att-c guest', 'أ. ' + g), x = el('span', 'x');
        c.type = 'button'; c.setAttribute('aria-label', 'احذف ' + g);
        x.innerHTML = ICON.del; c.appendChild(x);
        c.addEventListener('click', function () { v.guests.splice(i, 1); changed(); paint(); });
        chips.appendChild(c);
      });
      var all = v.roster.length + v.guests.length, present = all - v.absent.length;
      cnt.textContent = all ? 'حضر ' + present + ' من ' + all + ' — المس اسما ليصير غائبا'
                            : 'لا معلمين في شعبتك بعد — أضف الحاضرين بأسمائهم';
    }
    var row = el('div', 'rb-row'), g = input('', function () {}, { ph: 'حاضر من خارج الشعبة — اسمه', label: 'اسم حاضر من خارج الشعبة' });
    var add = el('button', 'rb-btn add', '+');
    add.type = 'button'; add.setAttribute('aria-label', 'أضف الحاضر');
    function addGuest() {
      /* اللقب يعرض ولا يخزن: ينزع «أ.» من المدخل كي لا يتكرر «أ. أ.» (قاعدة ش⑤) */
      var n = g.el.value.trim().replace(/^أ\.\s*/, '');
      if (!n) return;
      v.guests.push(n); g.el.value = ''; changed(); paint(); g.el.focus();
    }
    add.addEventListener('click', addGuest);
    g.el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addGuest(); } });
    row.appendChild(g.box); row.appendChild(add);
    sec.appendChild(row);
    paint();
    return sec;
  };

  /* ── ⑥ المرفقات: صورة او PDF بعنوان يكتبه (نشرة · محضر مجلس الادارة …) ─────
     ترفع لحسابك (ShoubaFiles) والسجل يحمل الاشارة وحدها { file, mime, size, name, at }.
     الحذف بلمستين — الاولى تسأل «احذفه نهائيا» — لانه لا يسترجع، والخادم يحذف الملف في الحال.
     عنوان الصورة فارغ افتراضا (اسم ملف الكاميرا لا يعني شيئا)، وملف PDF يأخذ اسمه. */
  BLOCK.files = function (b, v, ctx, changed) {
    var FL = window.ShoubaFiles, items = v.items = Array.isArray(v.items) ? v.items : [];
    var sec = section(b.title || 'المرفقات', b.hint), box = el('div', 'stack'), msg = el('div', 'warnbox');
    msg.hidden = true;
    function say(t) { msg.textContent = t || ''; msg.hidden = !t; }
    sec.appendChild(box);
    sec.appendChild(msg);
    if (!FL) { sec.appendChild(el('div', 'hint', 'الإرفاق غير متاح في هذه الشاشة')); return sec; }
    function paint() {
      box.textContent = '';
      items.forEach(function (it, i) {
        var card = el('div', 'rb-item'), row = el('div', 'rb-tools rb-file');
        var see = el('button', 'rb-btn'), del = el('button', 'rb-btn del');
        card.appendChild(input(it.name, function (x) { it.name = x; changed(); },
          { ph: 'عنوان المرفق — مثل: نشرة', label: 'عنوان المرفق ' + (i + 1) }).box);
        row.appendChild(el('span', 'hint', (it.mime === 'application/pdf' ? 'PDF' : 'صورة') + ' · ' + FL.kb(it.size)));
        see.type = del.type = 'button';
        see.innerHTML = ICON.eye; see.setAttribute('aria-label', 'اعرضه');
        see.addEventListener('click', function () { FL.view(FL.label(it), it); });
        del.innerHTML = ICON.del; del.setAttribute('aria-label', 'احذفه');
        del.addEventListener('click', function () {
          if (!del.classList.contains('sure')) {
            del.classList.add('sure'); del.textContent = 'احذفه نهائيا';
            setTimeout(function () { if (del.isConnected) { del.classList.remove('sure'); del.innerHTML = ICON.del; } }, 4000);
            return;
          }
          items.splice(i, 1); FL.remove(it.file); changed(); paint();
        });
        row.appendChild(see); row.appendChild(del);
        card.appendChild(row);
        box.appendChild(card);
      });
    }
    function attach() {
      say('');
      FL.pick(function (file) {
        var pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
        var name = pdf ? String(file.name || '').replace(/\.[^.]+$/, '').slice(0, 80) : '';
        var wait = el('div', 'rb-item');
        wait.appendChild(el('div', 'hint', 'يجهز الملف ويرفعه إلى حسابك…'));
        box.appendChild(wait);
        FL.prepare(file).then(function (p) { return FL.upload(ctx.recId, p); }).then(function (j) {
          items.push({ file: j.id, mime: j.mime, size: j.size, name: name, at: new Date().toISOString() });
          changed(); paint();
        }).catch(function (e) {
          if (wait.parentNode) wait.parentNode.removeChild(wait);
          say(e && e.user ? e.message : 'تعذر الرفع — أعد المحاولة');
        });
      });
    }
    sec.appendChild(addBtn(b.add || 'أرفق ملفا', attach));
    paint();
    return sec;
  };

  F.render = function (root, tpl, rec, ctx, onChange) {
    /* نسخة من السياق ومعها معرف السجل (للرفع) — لا يمس سياق المنادي */
    var cx = {};
    Object.keys(ctx || {}).forEach(function (k) { cx[k] = ctx[k]; });
    cx.recId = rec.id;
    ctx = cx;
    root.textContent = '';
    var form = el('div', 'rb-form');
    function changed() { if (onChange) onChange(rec); }
    tpl.blocks.forEach(function (b) {
      if (!BLOCK[b.type]) return;
      var v = rec.values[b.id];
      if (!v || typeof v !== 'object') v = rec.values[b.id] = {};
      /* سجل انشئ قبل ان تصير قيمة المرفقات كائنا ({ items }) يحمل [] — يحول هنا فلا تسقط مرفقاته عند الحفظ */
      if (b.type === 'files' && Array.isArray(v)) v = rec.values[b.id] = { items: v.slice() };
      var n = BLOCK[b.type](b, v, ctx, changed);
      if (n) form.appendChild(n);
    });
    root.appendChild(form);
    return form;
  };
})();
