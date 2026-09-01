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
   مستويان: صفّ الأسبوع (يقطعه خطٌّ في عمود الأسبوع) ودرسٌ داخله (يقطعه خطٌّ في عمود الحصص). */
export async function readTable(page){
  const rs  = await rects(page);
  const fix = makeFixer(await ligatureMap(page));
  const tc  = await page.getTextContent();

  const items = tc.items.filter(i => i.str.trim()).map(i => ({
    s: fix(i.str), x:i.transform[4], y:i.transform[5], w:i.width,
    rot: Math.abs(i.transform[0]) < 0.01 && Math.abs(i.transform[1]) > 0.01
  }));

  const H = rs.filter(r => Math.abs(r.h) <= 2.5 && Math.abs(r.w) > 5)
              .map(r => ({ x1:Math.min(r.x,r.x+r.w), x2:Math.max(r.x,r.x+r.w), y:r.y }));
  const V = rs.filter(r => Math.abs(r.w) <= 2.5 && Math.abs(r.h) > 8)
              .map(r => ({ y1:Math.min(r.y,r.y+r.h), y2:Math.max(r.y,r.y+r.h), x:r.x, len:Math.abs(r.h) }));
  if (!H.length || !V.length) return null;

  const head = items.filter(i => !i.rot && /^الأسبوع$|^الاسبوع$/.test(norm(i.s)));
  if (!head.length) return null;
  const hy = head[0].y;

  /* الأعمدة: مواضع الخطوط الرأسية تحت الترويسة، مرتّبةً بمجموع أطوالها */
  const below = V.filter(v => v.y2 <= hy + 6);
  if (below.length < 6) return null;
  const xs = clusterVals(below.map(v => v.x), 4);
  const weight = xs.map(x => ({ x, len: below.filter(v => Math.abs(v.x-x) <= 4).reduce((a,b)=>a+b.len,0) }));
  const colX = weight.sort((a,b)=>b.len-a.len).slice(0,6).map(o=>o.x).sort((a,b)=>a-b);
  if (colX.length < 6) return null;

  const cols = []; for (let i = colX.length-1; i > 0; i--) cols.push({ a: colX[i-1], b: colX[i] });
  const COL = { week:0, unit:1, lesson:2, periods:3, notes:4 };
  /* ⚠ نقصر الخطوط على ما تحت الترويسة، وإلّا دخلت كتلتا الترويسة والاعتماد صفوفاً وهمية */
  const bodyH = H.filter(h => h.y <= hy + 6);
  const covers = (y, c) => bodyH.some(h => Math.abs(h.y-y) <= 2.5 && h.x1 <= c.a + 3 && h.x2 >= c.b - 3);
  const ys = clusterVals(bodyH.map(h=>h.y), 3);

  /* حدّ الأسبوع: قطعٌ في عمود الأسبوع والحصص **وعمود الدرس** — والأخير هو ما
     يستبعد جدول الاعتماد أسفل الصفحة (خطوطه لا تعبر عمود الدرس كاملاً). */
  const weekY   = ys.filter(y => covers(y, cols[COL.week]) && covers(y, cols[COL.periods]) && covers(y, cols[COL.lesson]));
  if (weekY.length < 2) return null;
  const top = Math.max(...weekY), bottom = Math.min(...weekY);
  const lessonY = ys.filter(y => y >= bottom-1 && y <= top+1 && covers(y, cols[COL.periods]) && covers(y, cols[COL.lesson]));

  const band = (t,b) => ({ top:t, bot:b });
  const pick = (ci, bd, wantRot) => {
    const c = cols[ci];
    return items.filter(it => (!!it.rot === !!wantRot)
        && it.y > bd.bot - 1 && it.y < bd.top - 2
        && (it.x + it.w/2) > c.a && (it.x + it.w/2) < c.b)
      /* المُدار ٩٠° يُقرأ من الأسفل إلى الأعلى، وإلّا انقلب «الثاني عشر» إلى «عشر الثاني» */
      .sort((p,q) => wantRot ? (p.y - q.y) : (q.y - p.y || q.x - p.x))
      .map(i => i.s.trim()).filter(Boolean);
  };

  /* بناء الصفوف: أسبوع ⊃ دروس */
  const weeks = [];
  const wy = [...weekY].sort((a,b)=>b-a);
  for (let i = 0; i < wy.length-1; i++){
    const bd = band(wy[i], wy[i+1]);
    const inner = lessonY.filter(y => y < wy[i]-1 && y > wy[i+1]+1).sort((a,b)=>b-a);
    const bounds = [wy[i], ...inner, wy[i+1]];
    const lessons = [];
    for (let k = 0; k < bounds.length-1; k++){
      const lb = band(bounds[k], bounds[k+1]);
      lessons.push({
        دروس:   pick(COL.lesson, lb, false),
        حصص:    (pick(COL.periods, lb, false).join('').match(/\d+/)||[])[0] || '',
        مراجع:  pick(COL.notes, lb, false).join(' ')
      });
    }
    const row = {
      أسبوع: pick(COL.week, bd, true).join(' ') || pick(COL.week, bd, false).join(' '),
      وحدة:  pick(COL.unit, bd, false).join(' '),
      دروس:  lessons.filter(l => l.دروس.length || l.حصص)
    };
    /* ⚠ صفّ «المجموع الكلي لعدد الحصص» ليس درساً — عدُّه يضاعف مجموع الحصص */
    const isTotal = /المجموع\s*الكلي/.test(norm(row.دروس.map(l=>l.دروس.join(' ')).join(' ') + ' ' + row.وحدة));
    if (row.دروس.length && !isTotal) weeks.push(row);   /* ونطاق الفصل بين الكتلتين ليس صفَّاً */
  }
  const rotLabels = items.filter(i => i.rot && i.y < hy).length;
  return { colX, weeks, rotLabels, header: cols.map(c => items.filter(i=>!i.rot && Math.abs(i.y-hy)<14 && (i.x+i.w/2)>c.a && (i.x+i.w/2)<c.b).sort((p,q)=>q.y-p.y||q.x-p.x).map(i=>i.s.trim()).join(' ')) };
}
