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
        }, { type: f.kind === 'date' ? 'date' : 'text', numeric: f.kind === 'number', long: f.kind === 'longtext', rows: 3, label: f.label, ph: f.ph }).box);
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

  /* ── ③ الجدول (المرحلة الثانية أ): كل صف بطاقة على الجوال، تسمية كل خانة فوقها ─────────
     والورق جدول بإطار يمتد صفحات (rec-print.js). الصف الجديد من المحرك (ShoubaRec.newRow)
     بمعرف ثابت. المعلمون والاشهر رقاقات تتبدل بلمسة. خانة التوقيع للورق وحده، والمتابعة في خطوتها (ج). */
  function REF() { return window.SHOUBA_REF || {}; }
  function toggles(opts, isOn, tap) {
    var w = el('div', 'tgs');
    function sync() {
      [].forEach.call(w.children, function (x, i) {
        var on = isOn(opts[i].v);
        x.classList.toggle('on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
    opts.forEach(function (o) {
      var c = el('button', 'tg', o.t);
      c.type = 'button';
      c.addEventListener('click', function () { tap(o.v); sync(); });
      w.appendChild(c);
    });
    sync();
    return w;
  }
  function whoOpts(ctx) {
    return (REF().whoGroups || []).map(function (g) { return { v: g.id, t: g.t }; })
      .concat((ctx.teachers || []).map(function (n) { return { v: n, t: 'أ. ' + n }; }));
  }
  var CELL = {};
  CELL.text = function (c, row, ctx, changed) {
    return input(row[c.id], function (x) { row[c.id] = x; changed(); }, { ph: c.ph || '', label: c.label }).box;
  };
  CELL.longtext = function (c, row, ctx, changed) {
    return input(row[c.id], function (x) { row[c.id] = x; changed(); }, { long: true, rows: 2, ph: c.ph || '', label: c.label }).box;
  };
  CELL.number = function (c, row, ctx, changed) {
    return input(row[c.id], function (x) {
      var n = latin(x).trim(); row[c.id] = n === '' ? '' : (isNaN(+n) ? n : +n); changed();
    }, { numeric: true, label: c.label }).box;
  };
  CELL.date = function (c, row, ctx, changed) {
    return input(row[c.id], function (x) { row[c.id] = x; changed(); }, { type: 'date', ph: 'التاريخ', label: c.label }).box;
  };
  CELL.choice = function (c, row, ctx, changed) {
    return drop(c.label, (c.options || []).map(function (o) { return { v: o, t: o }; }), row[c.id],
      function (x) { row[c.id] = x; changed(); }, 'اختر');
  };
  CELL.check = function (c, row, ctx, changed) {
    var s = el('div', 'segs sm'), b = el('button', 'seg' + (row[c.id] ? ' on' : ''));
    b.type = 'button'; b.innerHTML = TICK; b.appendChild(document.createTextNode(c.on || 'تم'));
    b.addEventListener('click', function () { row[c.id] = !row[c.id]; b.classList.toggle('on', !!row[c.id]); changed(); });
    s.appendChild(b);
    return s;
  };
  /* المعلم: واحد بمنسدلة، او اكثر برقاقات. «معلمو الشعبة» يغني عن الاسماء والاسم يلغيه،
     و«الادارة المدرسية» تجتمع مع ايهما */
  CELL.teacher = function (c, row, ctx, changed) {
    if (!c.multi) return drop(c.label, whoOpts(ctx), row[c.id], function (x) { row[c.id] = x; changed(); }, 'اختر');
    var v = row[c.id] = Array.isArray(row[c.id]) ? row[c.id] : [];
    return toggles(whoOpts(ctx), function (x) { return v.indexOf(x) > -1; }, function (x) {
      var i = v.indexOf(x), k;
      if (i > -1) v.splice(i, 1);
      else {
        if (x === '@all') { for (k = v.length - 1; k >= 0; k--) if (v[k] !== '@admin') v.splice(k, 1); }
        else if (x !== '@admin') { k = v.indexOf('@all'); if (k > -1) v.splice(k, 1); }
        v.push(x);
      }
      changed();
    });
  };
  /* مواعيد التنفيذ: اشهر الفصل الحالي (refdata.termMonths) او «طوال الفصل»، وملاحظة اختيارية */
  CELL.months = function (c, row, ctx, changed) {
    var v = row[c.id] = (row[c.id] && typeof row[c.id] === 'object' && !Array.isArray(row[c.id])) ? row[c.id] : { m: [], all: false, note: '' };
    v.m = Array.isArray(v.m) ? v.m : [];
    var R = REF(), d = (window.Shouba && Shouba.data) ? Shouba.data() : {};
    var list = (R.termMonths || {})[d.term] || [9, 10, 11, 12, 1, 2, 3, 4, 5, 6], w = el('div', 'rb-cell');
    var opts = [{ v: 0, t: 'طوال الفصل' }].concat(list.map(function (n) { return { v: n, t: (R.months || [])[n - 1] || String(n) }; }));
    w.appendChild(toggles(opts, function (x) { return x === 0 ? !!v.all : (!v.all && v.m.indexOf(x) > -1); }, function (x) {
      if (x === 0) { v.all = !v.all; if (v.all) v.m = []; }
      else {
        v.all = false;
        var i = v.m.indexOf(x);
        if (i > -1) v.m.splice(i, 1); else v.m.push(x);
        v.m.sort(function (a, b) { return list.indexOf(a) - list.indexOf(b); });
      }
      changed();
    }));
    w.appendChild(input(v.note, function (x) { v.note = x; changed(); },
      { ph: 'ملاحظة — اختياري، مثل: حسب الإذاعة المدرسية', label: c.label + ' — ملاحظة' }).box);
    return w;
  };
  /* سطر ملف مرفق: نوعه وحجمه، وعرضه، وحذفه بلمستين (الاولى تسأل «احذفه نهائيا») —
     مكون واحد للمرفقات (⑥) وشواهد المتابعة، فلا يفترق سلوكهما */
  function fileRow(it, prefix, onDel) {
    var FL = window.ShoubaFiles, row = el('div', 'rb-tools rb-file'), see = el('button', 'rb-btn'), del = el('button', 'rb-btn del');
    row.appendChild(el('span', 'hint', (prefix || '') + (it.mime === 'application/pdf' ? 'PDF' : 'صورة') + ' · ' + FL.kb(it.size)));
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
      onDel();
    });
    row.appendChild(see); row.appendChild(del);
    return row;
  }

  /* المتابعة (المرحلة الثانية ج): حالة بلمسة — نفذ · جار · مؤجل · لم ينفذ — ولمس المختارة يلغيها.
     وبعد اختيار حالة تظهر ملاحظة قصيرة وشاهد مرفق (اختياريان) — فالخطة اول الفصل لا تزدحم بما لم يحن.
     القيمة { st, at (متى حسمت), note, ev: [{ file, mime, size, name, at }] } — والشاهد يحذف مع السجل (R.files) */
  var FST = [{ v: 'done', t: 'نفذ' }, { v: 'doing', t: 'جار' }, { v: 'later', t: 'مؤجل' }, { v: 'no', t: 'لم ينفذ' }];
  CELL.followup = function (c, row, ctx, changed) {
    var v = row[c.id] = (row[c.id] && typeof row[c.id] === 'object' && !Array.isArray(row[c.id])) ? row[c.id] : {};
    v.ev = Array.isArray(v.ev) ? v.ev : [];
    var FL = window.ShoubaFiles, w = el('div', 'rb-cell fu'), more = el('div', 'rb-cell'), list = el('div', 'stack'), msg = el('div', 'warnbox');
    function showMore() { more.hidden = !(v.st || v.note || v.ev.length); }
    w.appendChild(toggles(FST, function (x) { return v.st === x; }, function (x) {
      v.st = v.st === x ? '' : x;
      v.at = v.st ? new Date().toISOString() : '';
      changed(); showMore();
    }));
    more.appendChild(input(v.note, function (x) { v.note = x; changed(); }, { ph: 'ملاحظة — اختياري', label: c.label + ' — ملاحظة' }).box);
    if (FL) {
      msg.hidden = true;
      var paintEv = function () {
        list.textContent = '';
        v.ev.forEach(function (e, i) {
          list.appendChild(fileRow(e, 'شاهد: ', function () { v.ev.splice(i, 1); FL.remove(e.file); changed(); paintEv(); showMore(); }));
        });
      };
      var add = el('button', 'btn-ghost rb-add', '+ أرفق شاهدا');
      add.type = 'button';
      add.addEventListener('click', function () {
        msg.hidden = true;
        FL.pick(function (file) {
          var wait = el('div', 'hint', 'يجهز الشاهد ويرفعه إلى حسابك…');
          list.appendChild(wait);
          FL.prepare(file).then(function (p) { return FL.upload(ctx.recId, p); }).then(function (j) {
            v.ev.push({ file: j.id, mime: j.mime, size: j.size, name: '', at: new Date().toISOString() });
            changed(); paintEv();
          }).catch(function (e) {
            if (wait.parentNode) wait.parentNode.removeChild(wait);
            msg.textContent = e && e.user ? e.message : 'تعذر الرفع — أعد المحاولة';
            msg.hidden = false;
          });
        });
      });
      more.appendChild(list); more.appendChild(msg); more.appendChild(add);
      paintEv();
    }
    w.appendChild(more);
    showMore();
    return w;
  };

  function groupLabel(b, id) { var g = (b.groups || []).filter(function (x) { return x.id === id; })[0]; return g ? g.label : ''; }
  BLOCK.table = function (b, v, ctx, changed) {
    var rows = v, noun = b.rowLabel || 'صف', sec = section(b.title || '', b.hint), box = el('div', 'stack');
    /* الشبكة: عناصر النموذج المختارة وحدها (لقطة السجل او اختيار الشعبة) — وسائر الجداول كل اعمدتها */
    var cols = (window.Shouba && Shouba.colsOf ? Shouba.colsOf(ctx.rec, b) : b.columns).filter(function (c) { return CELL[c.kind]; });
    function move(i, d) { var x = rows.splice(i, 1)[0]; rows.splice(i + d, 0, x); changed(); paint(); }
    function paint() {
      box.textContent = '';
      rows.forEach(function (row, i) {
        var card = el('div', 'rb-item' + (ctx.focus && ctx.focus === row.id ? ' focus' : ''));
        card.setAttribute('data-row', row.id || '');   /* للوصول المباشر من اللوحة (?focus=) */
        card.appendChild(el('div', 'rb-q', noun + ' ' + (i + 1)));
        /* اعمدة ✓ المتجاورة في مجموعة واحدة (شبكتا المتابعة) خانة واحدة: اسم المجموعة ورقاقة لكل عنصر —
           قائمة تحقق للصف على الجوال بدل عشرات الازرار. وسائر الاعمدة خانة لكل عمود */
        for (var k = 0; k < cols.length;) {
          var c = cols[k], cell = el('div', 'rb-cell');
          if (c.kind === 'check' && c.group) {
            var grp = [];
            while (k < cols.length && cols[k].kind === 'check' && cols[k].group === c.group) grp.push(cols[k++]);
            cell.appendChild(el('div', 'rb-lab', groupLabel(b, c.group)));
            cell.appendChild(toggles(grp.map(function (x) { return { v: x.id, t: x.label }; }),
              function (id) { return !!row[id]; }, function (id) { row[id] = !row[id]; changed(); }));
          } else {
            cell.appendChild(el('div', 'rb-lab', c.label));
            cell.appendChild(CELL[c.kind](c, row, ctx, changed));
            k++;
          }
          card.appendChild(cell);
        }
        card.appendChild(tools(i > 0 ? function () { move(i, -1); } : null,
                               i < rows.length - 1 ? function () { move(i, 1); } : null,
                               function () { rows.splice(i, 1); changed(); paint(); }));
        box.appendChild(card);
      });
      if (!rows.length) box.appendChild(el('div', 'hint', 'لا ' + (b.rowsLabel || 'صفوف') + ' بعد — أضف أولها'));
    }
    sec.appendChild(box);
    sec.appendChild(addBtn(b.add || 'أضف صفا', function () {
      rows.push(window.ShoubaRec.newRow(b)); changed(); paint();
      var last = box.lastElementChild, f = last && last.querySelector('input,textarea');
      if (f) f.focus();
    }));
    paint();
    return sec;
  };

  /* ── القسم المتكرر (المرحلة الثانية ب): نسخ يضيفها المستخدم من مجموعة لبنات — «محور» في الخطة ──
     كل نسخة لوح يطوى: رأسه «محور ١ · اسمه» وعدد صفوف جدوله، وفيه لبناته بمولداتها نفسها.
     الجديدة مفتوحة وسواها مطوية (الجوال: محاور كثيرة في شاشة واحدة). حذف نسخة بتأكيد — تذهب صفوفها معها. */
  BLOCK.repeat = function (b, v, ctx, changed) {
    var items = v, label = b.label || 'قسم', sec = section(b.title || '', b.hint), box = el('div', 'stack'), open = {};
    if (items.length === 1) open[items[0].id] = true;
    /* الوصول المباشر (?focus=صف): تفتح النسخة التي فيها ذلك الصف */
    if (ctx.focus) items.forEach(function (it) {
      b.blocks.forEach(function (c) {
        if (c.type === 'table' && Array.isArray(it[c.id]) && it[c.id].some(function (r) { return r && r.id === ctx.focus; })) open[it.id] = true;
      });
    });
    function nameOf(it) {
      var n = '';
      b.blocks.forEach(function (c) {
        if (c.type !== 'fields' || n) return;
        (c.fields || []).forEach(function (f) { if (!n && f.required && it[c.id] && it[c.id][f.id]) n = String(it[c.id][f.id]).trim(); });
      });
      return n;
    }
    function rowsOf(it) {
      var n = 0, forms = null;
      b.blocks.forEach(function (c) { if (c.type === 'table' && Array.isArray(it[c.id])) { n += it[c.id].length; forms = forms || c.count; } });
      return !n ? '' : forms && window.Shouba ? Shouba.count(n, forms) : String(n);
    }
    function move(i, d) { var x = items.splice(i, 1)[0]; items.splice(i + d, 0, x); changed(); paint(); }
    function paint() {
      box.textContent = '';
      items.forEach(function (it, i) {
        var card = el('div', 'rb-rep' + (open[it.id] ? ' open' : '')), head = el('button', 'rb-rep-h'), body = el('div', 'rb-rep-b');
        var ttl = el('b'), meta = el('span', 'hint');
        function refresh() {
          var n = nameOf(it);
          ttl.textContent = label + ' ' + (i + 1) + (n ? ' · ' + n : '');
          meta.textContent = rowsOf(it);
        }
        function ch() { changed(); refresh(); }
        head.type = 'button';
        head.appendChild(ttl); head.appendChild(meta);
        head.insertAdjacentHTML('beforeend', '<span class="chv">' + ICON.down + '</span>');
        head.addEventListener('click', function () { open[it.id] = !open[it.id]; card.classList.toggle('open', !!open[it.id]); });
        b.blocks.forEach(function (c) {
          var vv = it[c.id];
          if (c.type === 'table') { if (!Array.isArray(vv)) vv = it[c.id] = []; }
          else if (!vv || typeof vv !== 'object' || Array.isArray(vv)) vv = it[c.id] = {};
          var n = BLOCK[c.type] && BLOCK[c.type](c, vv, ctx, ch);
          if (n) body.appendChild(n);
        });
        body.appendChild(tools(i > 0 ? function () { move(i, -1); } : null,
          i < items.length - 1 ? function () { move(i, 1); } : null,
          function () {
            var title = label + ' ' + (i + 1) + (nameOf(it) ? ' · ' + nameOf(it) : '');
            Shouba.ask('حذف ' + title, 'يحذف «' + title + '» ومعه كل ما فيه' + (rowsOf(it) ? ' (' + rowsOf(it) + ')' : '') + '.', 'احذفه',
              function () { items.splice(i, 1); changed(); paint(); });
          }));
        card.appendChild(head); card.appendChild(body);
        refresh();
        box.appendChild(card);
      });
    }
    sec.appendChild(box);
    sec.appendChild(addBtn(b.add || 'أضف', function () {
      var it = window.ShoubaRec.newItem(b);
      items.push(it); open[it.id] = true; changed(); paint();
      var last = box.lastElementChild, f = last && last.querySelector('.rb-rep-b input');
      if (last) last.scrollIntoView({ block: 'start', behavior: 'smooth' });
      if (f) f.focus({ preventScroll: true });
    }));
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
        var card = el('div', 'rb-item');
        card.appendChild(input(it.name, function (x) { it.name = x; changed(); },
          { ph: 'عنوان المرفق — مثل: نشرة', label: 'عنوان المرفق ' + (i + 1) }).box);
        card.appendChild(fileRow(it, '', function () { items.splice(i, 1); FL.remove(it.file); changed(); paint(); }));
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

  F.toggles = toggles;   /* الرقاقات المتبدلة — تستعملها خيارات الطباعة في شاشة السجل */

  F.render = function (root, tpl, rec, ctx, onChange) {
    /* نسخة من السياق ومعها معرف السجل (للرفع) — لا يمس سياق المنادي */
    var cx = {};
    Object.keys(ctx || {}).forEach(function (k) { cx[k] = ctx[k]; });
    cx.recId = rec.id;
    cx.rec = rec;                          /* لاعمدة الشبكة المختارة (Shouba.colsOf) */
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
      if ((b.type === 'table' || b.type === 'repeat') && !Array.isArray(v)) v = rec.values[b.id] = [];   /* صفوف · نسخ */
      var n = BLOCK[b.type](b, v, ctx, changed);
      if (n) form.appendChild(n);
    });
    root.appendChild(form);
    return form;
  };
})();
