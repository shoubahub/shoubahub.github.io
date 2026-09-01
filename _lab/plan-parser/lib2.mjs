import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';

export async function openDoc(file){
  return pdfjs.getDocument({ data:new Uint8Array(fs.readFileSync(file)), useSystemFonts:true }).promise;
}

/* ── إصلاح الرابطة «لا» ─────────────────────────────────────────────
   pdf.js يعكس النصّ العربي حرفاً حرفاً ليصير منطقياً، والرابطة رمزٌ واحد
   بحرفين فتنقلب «لا»←«ال». نبني خريطة معطوب←صحيح من قائمة العمليات. */
export async function ligatureMap(page){
  const ol = await page.getOperatorList();
  const names = {}; for (const k in pdfjs.OPS) names[pdfjs.OPS[k]] = k;
  const map = new Map();
  for (let i = 0; i < ol.fnArray.length; i++){
    if (names[ol.fnArray[i]] !== 'showText') continue;
    const gs = ol.argsArray[i][0].filter(g => g && typeof g === 'object');
    if (!gs.some(g => (g.unicode||'').length > 1)) continue;
    const visual  = gs.map(g => g.unicode || '').join('');
    const correct = gs.slice().reverse().map(g => g.unicode || '').join('');
    const damaged = [...visual].reverse().join('');
    if (damaged !== correct && damaged.trim()) map.set(damaged.trim(), correct.trim());
  }
  return map;
}
/* ⚠ الاستبدال يجب أن يكون **مسحاً واحداً بأطول مطابقة**، لا استبدالاً متكرّراً:
   الاستبدال المتتالي يعيد المسّ بنصٍّ أُصلح فيفسده («الاسبوع» صارت «لااسبوع»). */
export function makeFixer(map){
  const keys = [...map.keys()].filter(k => k.length >= 3).sort((a,b)=>b.length-a.length);
  return (s) => {
    if (map.has(s)) return map.get(s);
    let out = '', i = 0;
    while (i < s.length){
      let hit = null;
      for (const k of keys){ if (k.length <= s.length - i && s.startsWith(k, i)) { hit = k; break; } }
      if (hit){ out += map.get(hit); i += hit.length; }
      else { out += s[i]; i++; }
    }
    return out;
  };
}

export async function rects(page){
  const ol = await page.getOperatorList();
  const names = {}; for (const k in pdfjs.OPS) names[pdfjs.OPS[k]] = k;
  const out = [];
  for (let i = 0; i < ol.fnArray.length; i++){
    if (names[ol.fnArray[i]] !== 'constructPath') continue;
    const [ops, args] = ol.argsArray[i];
    let p = 0;
    for (const op of ops){
      if (op === 19){ out.push({ x:args[p], y:args[p+1], w:args[p+2], h:args[p+3] }); p += 4; }
      else p += 2;
    }
  }
  return out;
}

const NORM = s => s.replace(/[ً-ْـ]/g,'').replace(/\s+/g,' ').trim();
export const norm = NORM;

/* ── تحديد جدول التوزيع وقراءته خلايا ───────────────────────────── */
export async function readTable(page){
  const rs   = await rects(page);
  const fix  = makeFixer(await ligatureMap(page));
  const tc   = await page.getTextContent();

  const items = tc.items.filter(i => i.str.trim()).map(i => ({
    s: fix(i.str),
    x: i.transform[4], y: i.transform[5], w: i.width, h: i.height,
    rot: Math.abs(i.transform[0]) < 0.01 && Math.abs(i.transform[1]) > 0.01
  }));

  const H = rs.filter(r => Math.abs(r.h) <= 2.5 && Math.abs(r.w) > 20)
              .map(r => ({ x1:Math.min(r.x,r.x+r.w), x2:Math.max(r.x,r.x+r.w), y:r.y }));
  const V = rs.filter(r => Math.abs(r.w) <= 2.5 && Math.abs(r.h) > 20)
              .map(r => ({ y1:Math.min(r.y,r.y+r.h), y2:Math.max(r.y,r.y+r.h), x:r.x }));
  if (!H.length || !V.length) return null;

  /* ترويسة الجدول: الصفّ الذي يحمل «الأسبوع» و«الملاحظات» */
  const head = items.filter(i => !i.rot && /الأسبوع|الاسبوع/.test(NORM(i.s)));
  if (!head.length) return null;
  const hy = head[0].y;

  /* الأعمدة: الخطوط الرأسية التي تعبر سطر الترويسة */
  const cross = V.filter(v => v.y1 <= hy && v.y2 >= hy + 2);
  if (cross.length < 4) return null;
  const colX = clusterVals(cross.map(v => v.x), 5);
  const left = Math.min(...colX), right = Math.max(...colX);

  /* الجسم كتلة مستقلّة تحت الترويسة (وورد يفصلهما) — نلتقط أعمدته بمطابقة المواضع */
  const bodyV = V.filter(v => v.y2 <= hy + 6 && colX.some(cx => Math.abs(v.x - cx) <= 5));
  const top    = bodyV.length ? Math.max(...bodyV.map(v => v.y2)) : Math.max(...cross.map(v => v.y2));
  const bottom = bodyV.length ? Math.min(...bodyV.map(v => v.y1)) : Math.min(...cross.map(v => v.y1));

  /* الصفوف: الخطوط الأفقية داخل حدود الجسم */
  const inH = H.filter(h => h.y >= bottom - 2 && h.y <= top + 2 && h.x2 > left + 5 && h.x1 < right - 5);
  const rowY = clusterVals(inH.map(h => h.y), 3);

  const cols = []; for (let i = colX.length-1; i > 0; i--) cols.push({ a: colX[i-1], b: colX[i] });
  const bands = []; for (let i = rowY.length-1; i > 0; i--) bands.push({ top: rowY[i], bot: rowY[i-1] });

  const cell = (ci, bi, withRot=false) => {
    const c = cols[ci], b = bands[bi];
    return items.filter(it => (withRot ? it.rot : !it.rot)
        && it.y > b.bot - 1 && it.y < b.top - 2
        && (it.x + it.w/2) > c.a && (it.x + it.w/2) < c.b)
      .sort((p,q) => q.y - p.y || q.x - p.x)
      .map(i => i.s.trim()).filter(Boolean);
  };
  /* خطّ فاصل فوق هذه الخانة؟ غيابه يعني اندماجها مع ما فوقها */
  const cut = (ci, bi) => inH.some(h => Math.abs(h.y - bands[bi].top) <= 2.5
      && h.x1 <= cols[ci].a + 3 && h.x2 >= cols[ci].b - 3);

  return { cols, bands, cell, cut, items, headerY: hy };
}

function clusterVals(vals, t){
  const s = [...vals].sort((a,b)=>a-b), out = [];
  for (const v of s){ if (!out.length || v - out[out.length-1] > t) out.push(v); else out[out.length-1] = (out[out.length-1]+v)/2; }
  return out;
}
