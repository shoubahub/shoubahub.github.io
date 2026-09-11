import { openDoc, ligatureMap, makeFixer, rects, norm } from './lib2.mjs';
export { openDoc, norm };

const clusterVals = (vals, t) => {
  const s=[...vals].sort((a,b)=>a-b), out=[];
  for (const v of s){ if(!out.length || v-out[out.length-1]>t) out.push(v); else out[out.length-1]=(out[out.length-1]+v)/2; }
  return out;
};

/* ── قراءة جدول توزيع المنهج في صفحة ──────────────────────────────
   ⚠ حدود الأعمدة تُؤخذ من **جسم** الجدول لا من ترويسة الوثيقة (كتلة مستقلّة في وورد).
   ⚠ والخطوط الرأسية تُرسم لكل خانة على حدة، فالعمود يُعرف بتكرار موضعه لا بطول خطّه.
   مستويان: صفّ الأسبوع (يقطعه خطٌّ في عمود الأسبوع) ودرسٌ داخله (يقطعه خطٌّ في عمود الحصص).
   hint: اعمدة الصفحة السابقة من الملف نفسه — لصفحة تكمل جدولها بلا ترويسة */
export async function readTable(page, hint){
  const rs  = await rects(page);
  const fix = makeFixer(await ligatureMap(page));
  const tc  = await page.getTextContent();

  /* ⚠ NFKC: بعض الخطط (الفرنسية) تصل حروفها باشكال العرض «ﺗ و ز ﯾ ﻊ» — تعاد الى صورتها (2026-09-11) */
  /* fs حجم الخط و dir اتجاه الادارة — مركز النص المدار منهما لا من عرضه (انظر ctr) */
  const items = tc.items.filter(i => i.str.trim()).map(i => ({
    s: fix(i.str).normalize('NFKC'), x:i.transform[4], y:i.transform[5], w:i.width,
    rot: Math.abs(i.transform[0]) < 0.01 && Math.abs(i.transform[1]) > 0.01,
    fs: Math.hypot(i.transform[2], i.transform[3]) || 10, dir: Math.sign(i.transform[1]) || 1
  }));
  return tableFrom(rs, items, hint);
}

/* النواة: خطوط (x,y,w,h بنقاط الصفحة) ونص ({s,x,y,w,rot}) من اي مصدر — رسم الملف او القراءة الضوئية
   (ocrpage.mjs للخطط الممسوحة وذات الخط المرمز). فصلت عن pdf.js كي لا يكتب الجدول مرتين (2026-09-12) */
export function tableFrom(rs, items, hint){
  const H = rs.filter(r => Math.abs(r.h) <= 2.5 && Math.abs(r.w) > 5)
              .map(r => ({ x1:Math.min(r.x,r.x+r.w), x2:Math.max(r.x,r.x+r.w), y:r.y }));
  const V = rs.filter(r => Math.abs(r.w) <= 2.5 && Math.abs(r.h) > 8)
              .map(r => ({ y1:Math.min(r.y,r.y+r.h), y2:Math.max(r.y,r.y+r.h), x:r.x, len:Math.abs(r.h) }));
  if (!H.length || !V.length) return null;

  /* ترويسة الاسبوع: كانت تشترط «الأسبوع» كلمة تامة في عنصر واحد، فسقطت خطط تصلها مقطعة
     («األ» + «سبوع» — الاحياء) او بالانجليزية («Weeks» — اللغة الانجليزية) (2026-09-11) */
  const bareS = s => norm(s).replace(/\s+/g, '');
  /* ⚠ مركز النص الافقي: المدار ٩٠° عرضه طوله على y، فكان x + عرضه/٢ يزيحه عن عموده — ترتيبي الاسبوع
     في إنجليزي الثانوي نسب الى عمود الوحدة (2026-09-12). المدار جسمه في جهة ادارته من خط الكتابة */
  const ctr = it => it.rot ? it.x - (it.dir || 1) * (it.fs || 10) * 0.35 : it.x + it.w / 2;
  /* ⚠ والقراءة الضوئية قد تدمج عناوين الترويسة سطرا واحدا («الاسبوع المجال/ الوحدة الدرس … عدد الحصص»
     — التربية الفنية للابتدائي): يقبل سطر اوله «الأسبوع» ان كان فيه عنوان ترويسة آخر، فلا يظن درس
     «الأسبوع التمهيدي» ترويسة (2026-09-12) */
  const WEEK = /^(ال)?[أا]?سبوع$|^الاسبوع$|^الأسبوع$|^سبوع$/;
  const merged = i => { const w = norm(i.s).trim().split(/\s+/); return WEEK.test(w[0] || '') && /المجال|الوحدة|الدرس|الحصص/.test(norm(i.s)); };
  /* والعنوان قد يكتب رأسيا في عمود ضيق (عربي الثالث: «الأسبوع» و«الوحدة» و«الدرس» مدارة) — يقبل تاما وحده،
     ⚠ ان جاوره على ارتفاعه عنوان ترويسة آخر: خانة الاسبوع المدارة «الأسبوع الأول والثاني» تصل كلمات منفصلة
     منها «الأسبوع» وحدها، فظنت ترويسة في جسم إنجليزي الثانوي ص٢ فانقلب الاتجاه وسقطت الصفحة */
  const HDR = /المجال|الوحدة|الدرس|المفاهيم|الحصص|عدد|ملاحظ|دليل|unit|lesson|period|remark|note/i;
  const nearHdr = i => items.some(j => j !== i && Math.abs(j.y - i.y) < 20 && HDR.test(norm(j.s)));
  const head = items.filter(i => (!i.rot && (WEEK.test(bareS(i.s)) || /^weeks?$/i.test(i.s.trim()) || merged(i))) || (i.rot && WEEK.test(bareS(i.s)) && nearHdr(i)))
                    .sort((p, q) => q.y - p.y);
  /* ⚠ صفحة تكمل جدول سابقتها بلا ترويسة (إنجليزي الثانوي: الترويسة في الصفحات الفردية وحدها، فسقط
     نصف الاسابيع) — تقرأ باعمدة سابقتها من الملف نفسه (hint)، وكل ما تحت اعلاها جسم (2026-09-12) */
  const cont = !head.length && hint && hint.colX;
  if (!head.length && !cont) return null;
  const hy = head.length ? head[0].y : 1e9;

  /* الأعمدة: مواضع الخطوط الرأسية تحت الترويسة، مرتّبةً بمجموع أطوالها */
  const below = V.filter(v => v.y2 <= hy + 6);
  const xs = clusterVals(below.map(v => v.x), 4);
  const weight = xs.map(x => ({ x, len: below.filter(v => Math.abs(v.x-x) <= 4).reduce((a,b)=>a+b.len,0) }));

  /* ── ادوار الاعمدة من عناوين الترويسة (2026-09-12) ─────────────────────────
     كانت خمسة اعمدة بمواضع ثابتة من اليمين: الاسبوع · الوحدة · الدرس · الحصص · الملاحظات. فسقط:
     • الجدول المعكوس (إنجليزي الثانوي: Weeks يسارا و Remarks يمينا) — فقرئت الملاحظة اسما للاسبوع؛
     • الجدول ذو الستة (عربي الابتدائي: «الدرس» عمود ممتد وحده و«المفاهيم الأساسية» عمود).
     فالاتجاه من موضع «الأسبوع» نسبة الى «الحصص»، وعدد الاعمدة من انفصال «الدرس» عن «المفاهيم». */
  /* المدار مركزه موضعه الافقي (عرضه طوله على y). ⚠ و«الأسبوع» من عنصر الترويسة نفسه لا بمطابقة نص: كلمة
     «أسبوع» في خانة ترويسة اخرى قلبت الاتجاه في خطط سليمة (علم النفس: ٢٣١ حصة والصواب ٢٦) */
  const cx = ctr;
  const hdrItems = head.length ? items.filter(i => Math.abs(i.y - hy) < 20 || (i.rot && i.y < hy + 40 && i.y > hy - 60)) : [];
  const labelAt = test => { const h = hdrItems.filter(i => test(norm(i.s))); return h.length ? h.reduce((a, i) => a + cx(i), 0) / h.length : null; };
  const cWeek   = head.length && !merged(head[0]) ? cx(head[0]) : null;
  const cUnit   = labelAt(s => /المجال|الوحدة|unit/i.test(s));
  const cLesson = labelAt(s => /المفاهيم|lesson|concept/i.test(s)) ?? labelAt(s => /الدرس/.test(s));
  const cTitle  = labelAt(s => /^(ال)?دروس$|^الدرس$/.test(s.replace(/\s+/g, '')));
  const cPer    = labelAt(s => /الحصص|عدد|period/i.test(s));
  const cNotes  = labelAt(s => /ملاحظ|دليل|الأداء|note|remark/i.test(s));   /* ملاحظات العربي «دليل الإعداد والأداء» */
  /* ⚠ ستة اعمدة ان فصل بين «الدرس» و«المفاهيم» خط رأسي حقيقي — لا بعدهما وحده: الترويسة الثنائية
     («Lesson / Key concepts» و«الدرس / المفاهيم») تقسم «الدرس» قطعة وحدها في الخانة نفسها (إنجليزي الثانوي) */
  /* ⚠ والخط غالب بين العنوانين: ضعف ما سواه بينهما على الاقل، وخمس اطول خط — لا ٤٠٪ من اطول خط: حد
     عمود «الدرس» لا يمتد الا حيث يمتد العمود (٢٦٠ و٢٤٣ نقطة، واطول خط الاطار ٦٨٤)، فسقطت ص٤–٥ من عربي الثالث */
  const maxLen = Math.max(0, ...weight.map(w => w.len));
  const btw = cTitle != null && cLesson != null ? weight.filter(w => w.x > Math.min(cTitle, cLesson) + 3 && w.x < Math.max(cTitle, cLesson) - 3).sort((a, b) => b.len - a.len) : [];
  const six = cTitle != null && cLesson != null && Math.abs(cTitle - cLesson) > 20
    && !!btw[0] && btw[0].len >= maxLen * 0.2 && (!btw[1] || btw[0].len >= 2 * btw[1].len);

  let R, ltr, colX;
  if (cont) {
    R = hint.roles; ltr = !!hint.ltr;
    /* ⚠ الادوار والاتجاه من السابقة، والمواضع من خطوط الصفحة نفسها: عمود الحصص في إنجليزي الثانوي ص١
       ٤٠٥–٤٨٣ وفي ص٢ ٤٣٨–٥١٢ — فلكل حد سابق اطول خط هنا في ٤٠ نقطة منه (خط الجسم اطول من خطوط الترويسة
       والاعتماد)، ولا يتكرر حد */
    const used = new Set();
    colX = hint.colX.map(x => {
      const near = weight.filter(w => Math.abs(w.x - x) <= 40 && !used.has(w.x)).sort((a, b) => b.len - a.len || Math.abs(a.x - x) - Math.abs(b.x - x));
      if (!near.length) return x;
      used.add(near[0].x); return near[0].x;
    });
    if (colX.some((x, j) => j && x <= colX[j - 1])) return null;
  } else {
    R = six ? ['week', 'unit', 'title', 'lesson', 'periods', 'notes'] : ['week', 'unit', 'lesson', 'periods', 'notes'];
    const centers = six ? [cWeek, cUnit, cTitle, cLesson, cPer, cNotes] : [cWeek, cUnit, cLesson, cPer, cNotes];
    ltr = cWeek != null && cPer != null && cWeek < cPer;
    const n = R.length;
    if (below.length < n + 1) return null;
    colX = [...weight].sort((a,b)=>b.len-a.len).slice(0, n + 1).map(o=>o.x).sort((a,b)=>a-b);
    /* ⚠ الحكم عناوين الترويسة: عمود الملاحظات في رياضيات الأدبي مقسوم في الجسم («كتاب الطالب | الكراسة»)
       بخط يساوي حد عمود الاسبوع طولا، فرجح بالمصادفة — فسقط عمود الاسبوع كله وقرئت خانة «الكراسة» حصصا.
       فان لم يقع كل عنوان في عموده، بني كل حد بين عنوانين متجاورين من اطول خط بينهما — والتساوي للاقرب
       الى حد الترويسة. وحدود الترويسة لا تؤخذ نفسها: كتلة مستقلة في وورد تنزاح ٥–١٣ نقطة */
    const colOf = k => ltr ? k : n - 1 - k;
    const fits = cx => centers.every((x, k) => x == null || (x > cx[colOf(k)] && x < cx[colOf(k) + 1]));
    const ordered = centers.every(x => x != null) && centers.every((x, k) => k === 0 || (ltr ? x > centers[k - 1] : x < centers[k - 1]));
    if (centers.filter(x => x != null).length >= n - 1 && !fits(colX) && ordered) {
      const hdrV = V.filter(v => v.y1 <= hy + 4 && v.y2 >= hy - 4).map(v => v.x);
      const dist = x => hdrV.length ? Math.min(...hdrV.map(h => Math.abs(h - x))) : 0;
      const best = (lo, hi) => weight.filter(w => w.x > lo && w.x < hi).sort((a, b) => b.len - a.len || dist(a.x) - dist(b.x))[0];
      const cs = [...centers].sort((a, b) => a - b);
      const picks = [best(-Infinity, cs[0])];
      for (let j = 0; j < cs.length - 1; j++) picks.push(best(cs[j], cs[j + 1]));
      picks.push(best(cs[cs.length - 1], Infinity));
      if (picks.every(Boolean)) { const cx = picks.map(p => p.x); if (fits(cx)) colX = cx; }
    }
  }
  if (colX.length < R.length + 1) return null;

  /* الاعمدة بترتيب x تصاعديا، والدور يحدد عموده بالاتجاه */
  const cols = []; for (let j = 0; j < R.length; j++) cols.push({ a: colX[j], b: colX[j + 1] });
  const COL = {}; R.forEach((r, k) => { COL[r] = ltr ? k : R.length - 1 - k; });
  /* ⚠ نقصر الخطوط على ما تحت الترويسة، وإلّا دخلت كتلتا الترويسة والاعتماد صفوفاً وهمية */
  const bodyH = H.filter(h => h.y <= hy + 6);
  /* الخط يعبر العمود ان غطته قطعه مجتمعة لا قطعة واحدة: خط البكسل في المسح المائل يصل شرائح
     متتابعة، فسقط جدول صفحة كاملة (رياضيات الرابع ص١٨) (2026-09-12).
     ⚠ والمسموح غير المغطى ٦٫٥ نقطة (ثلاث عند كل طرف كالشرط القديم) او ١٠٪ ايهما اكبر — النسبة وحدها
     اسقطت حدود اسابيع في الاعمدة الضيقة (الحصص ٤٠ نقطة) فاندمج اسبوعان في خطط سليمة (رياضيات العاشر) */
  const covers = (y, c) => {
    const segs = bodyH.filter(h => Math.abs(h.y-y) <= 2.5 && h.x2 > c.a && h.x1 < c.b)
                      .map(h => [Math.max(h.x1, c.a), Math.min(h.x2, c.b)]).sort((p, q) => p[0] - q[0]);
    let cov = 0, end = c.a;
    for (const [a, b] of segs) if (b > end) { cov += b - Math.max(a, end); end = b; }
    const w = c.b - c.a;
    return cov >= w - Math.max(6.5, w * 0.1);
  };
  const ys = clusterVals(bodyH.map(h=>h.y), 3);

  /* حدّ الأسبوع: قطعٌ في عمود الأسبوع والحصص **وعمود الدرس** — والأخير هو ما
     يستبعد جدول الاعتماد أسفل الصفحة (خطوطه لا تعبر عمود الدرس كاملاً). */
  const weekY   = ys.filter(y => covers(y, cols[COL.week]) && covers(y, cols[COL.periods]) && covers(y, cols[COL.lesson]));
  /* صفحة التكملة: اول صفوفها يكمل صفا بدأ في سابقتها فلا خط فوقه — حده الاعلى اعلى خطوط الاعمدة الداخلية
     (إنجليزي الثانوي ص٢ سقطت لانها بلا حد علوي) */
  if (cont) {
    const vt = Math.max(-1, ...V.filter(v => colX.slice(1, -1).some(x => Math.abs(v.x - x) <= 4)).map(v => v.y2));
    if (vt > Math.max(-1, ...weekY) + 5) weekY.push(vt);
  }
  if (weekY.length < 2) return null;
  const top = Math.max(...weekY), bottom = Math.min(...weekY);
  const lessonY = ys.filter(y => y >= bottom-1 && y <= top+1 && covers(y, cols[COL.periods]) && covers(y, cols[COL.lesson]));
  /* خانة ممتدة (الوحدة في عربي الابتدائي: «الأولى» خانة واحدة للاسابيع ١–٤، ونصها مدار؛ و«الدرس» في
     الجدول ذي الستة): تقرأ من خانتها كلها — بين الخطين اللذين يعبران عمودها — لا من حدي الصف وحده.
     وفي الخطط المعتادة الخانة هي الصف نفسه، فلا يتغير شيء */
  const cellsOf = ci => ys.filter(y => y >= bottom-1 && y <= top+1 && covers(y, cols[ci])).sort((a,b)=>b-a);
  const cellAt = (lines, mid) => { let t = null, b = null; for (const y of lines) { if (y >= mid) t = y; else { b = y; break; } } return t != null && b != null ? { top: t, bot: b } : null; };
  const unitY = cellsOf(COL.unit), titleY = COL.title != null ? cellsOf(COL.title) : [];

  const band = (t,b) => ({ top:t, bot:b });
  const pick = (ci, bd, wantRot) => {
    const c = cols[ci];
    return items.filter(it => (!!it.rot === !!wantRot)
        && it.y > bd.bot - 1 && it.y < bd.top - 2
        && ctr(it) > c.a && ctr(it) < c.b)
      /* المُدار ٩٠° يُقرأ من الأسفل إلى الأعلى، وإلّا انقلب «الثاني عشر» إلى «عشر الثاني» */
      .sort((p,q) => wantRot ? (p.y - q.y) : (q.y - p.y || q.x - p.x))
      .map(i => i.s.trim()).filter(Boolean);
  };
  const pickAny = (ci, bd) => pick(ci, bd, false).join(' ') || pick(ci, bd, true).join(' ');

  /* بناء الصفوف: أسبوع ⊃ دروس */
  const weeks = [];
  const wy = [...weekY].sort((a,b)=>b-a);
  /* ⚠ الصف من الجدول ان مرت به خطوط اعمدته الداخلية (كلها الا واحدا على الاقل): في الصفحة الممسوحة
     خط البكسل متصل، فتعبر خطوط جدول الاعتماد عمود الدرس كاملا فيحسب صفا («مدير إدارة توجيه»)،
     واعمدته غير اعمدة الجدول — فيسقط بهذا الشرط لا بمطابقة نصه (2026-09-12) */
  const inner = colX.slice(1, -1);
  const through = y => inner.filter(x => V.some(v => Math.abs(v.x - x) <= 4 && v.y1 <= y + 1 && v.y2 >= y - 1)).length >= inner.length - 1;
  for (let i = 0; i < wy.length-1; i++){
    const bd = band(wy[i], wy[i+1]);
    if (!through((wy[i] + wy[i+1]) / 2)) continue;
    const innerY = lessonY.filter(y => y < wy[i]-1 && y > wy[i+1]+1).sort((a,b)=>b-a);
    const bounds = [wy[i], ...innerY, wy[i+1]];
    const lessons = [];
    for (let k = 0; k < bounds.length-1; k++){
      const lb = band(bounds[k], bounds[k+1]);
      /* عنوان الدرس في الجدول ذي الستة: من خانته الممتدة، مع اول صف منها وحده */
      const tc = COL.title != null ? cellAt(titleY, (lb.top + lb.bot) / 2) : null;
      const title = tc && Math.abs(tc.top - lb.top) < 1.5 ? pickAny(COL.title, tc) : '';
      lessons.push({
        دروس:   [title, ...pick(COL.lesson, lb, false)].filter(Boolean),
        /* ⚠ الاعداد تفصل ثم تجمع: ضمها بلا فاصل جعل «٩ ٢ ٦ ١» «9261» (الكيمياء ١٢) */
        /* ⚠ والارقام الهندية («١») تحول لاتينية قبل المطابقة — \d لا يعرفها، فظنت خانات التربية الإسلامية
           غير مقروءة (2026-09-12) */
        حصص:    (() => { const n = (pick(COL.periods, lb, false).join(' ').replace(/[٠-٩]/g, d => d.charCodeAt(0) - 0x660).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 0x6F0).match(/\d+/g) || []).map(Number).filter(v => v > 0 && v <= 30);
                         return n.length ? String(n.reduce((a, b) => a + b, 0)) : ''; })(),
        مراجع:  pick(COL.notes, lb, false).join(' '),
        /* نص خانة الحصص كما جاء — ان كان ولم يقرأ رقما فهو رقم بخط مرمز يقرأ ضوئيا (ocrpage.mjs) */
        حصصنص: pick(COL.periods, lb, false).join(' '),
        /* حدا الخانة (اعلى، اسفل) — لقراءة خانة الحصص وحدها ان فاتت القراءة الاولى */
        band:   [lb.top, lb.bot]
      });
    }
    const row = {
      أسبوع: pick(COL.week, bd, true).join(' ') || pick(COL.week, bd, false).join(' '),
      وحدة:  pickAny(COL.unit, cellAt(unitY, (wy[i] + wy[i+1]) / 2) || bd),
      دروس:  lessons.filter(l => l.دروس.length || l.حصص),
      band:  [bd.top, bd.bot]
    };
    /* ⚠ صفّ «المجموع الكلي لعدد الحصص» ليس درساً — عدُّه يضاعف مجموع الحصص */
    const isTotal = /المجموع\s*الكلي/.test(norm(row.دروس.map(l=>l.دروس.join(' ')).join(' ') + ' ' + row.وحدة));
    if (row.دروس.length && !isTotal) weeks.push(row);   /* ونطاق الفصل بين الكتلتين ليس صفَّاً */
  }
  const rotLabels = items.filter(i => i.rot && i.y < hy).length;
  const colsRead = ltr ? cols : [...cols].reverse();
  return { colX, weeks, rotLabels, ltr, roles: R, cont: !!cont,
    /* للتشخيص: مراكز عناوين الترويسة وقرار الستة — لا تخمين عند السقوط */
    dbg: { hy, cWeek, cUnit, cTitle, cLesson, cPer, cNotes, six, maxLen },
    /* موضعا عمودي الحصص والاسبوع صراحة — لا colX[1..2] و[4..5] الثابتة (الجدول المعكوس وذو الستة) */
    periodsX: [cols[COL.periods].a, cols[COL.periods].b], weekX: [cols[COL.week].a, cols[COL.week].b],
    header: colsRead.map(c => items.filter(i=>!i.rot && Math.abs(i.y-hy)<14 && (i.x+i.w/2)>c.a && (i.x+i.w/2)<c.b).sort((p,q)=>q.y-p.y||q.x-p.x).map(i=>i.s.trim()).join(' ')) };
}
