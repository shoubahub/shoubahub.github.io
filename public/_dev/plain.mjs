// تنظيف التشكيل من مصدر المنصّة — يُشغَّل من جذر المشروع:  node public/_dev/plain.mjs [--dry]
// قرار المستخدم 2026-09-11 (نصيحة زميل: راحةٌ للعين): **لا تشكيل في نصوص المنصّة**.
// يحذف الحركات (U+064B–U+0652) والألف الخنجرية (U+0670) من ملفّات الواجهة ورسائل الخادم.
// ⚠ الوثيقة المحفوظة عند المستخدمين تُرحَّل مرّةً في derive.js (refDataVersion ٣) — لا هنا.
// ⚠ لا يمسّ: دليل الهوية (identity/) · _dev · _legacy · التوثيق (SKILL.md, LAYOUT.md).
// ⚠ يرفض العمل إن وجد حركةً حرفيةً داخل نمط regex في derive.js — فالحذف يكسره.
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const DRY = process.argv.includes('--dry');
const H = new RegExp('[' + String.fromCharCode(0x064B) + '-' + String.fromCharCode(0x0652) + String.fromCharCode(0x0670) + ']', 'g');

const files = [path.join(ROOT, 'auth.js')];
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (/[\\/](_dev|_legacy|identity|node_modules)([\\/]|$)/.test(p)) continue;
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(html|js|css|webmanifest)$/.test(f)) files.push(p);
  }
})(path.join(ROOT, 'public'));

const derive = fs.readFileSync(path.join(ROOT, 'public/derive.js'), 'utf8');
const bad = derive.split('\n').filter(l => /HARAKAT\s*=/.test(l) && H.test(l));
H.lastIndex = 0;
if (bad.length) { console.error('⛔ نمط الحركات في derive.js مكتوبٌ بحروفها — الحذف يكسره:\n' + bad.join('\n')); process.exit(1); }

let total = 0;
for (const p of files) {
  const src = fs.readFileSync(p, 'utf8');
  const n = (src.match(H) || []).length;
  if (!n) continue;
  total += n;
  if (!DRY) fs.writeFileSync(p, src.replace(H, ''));
  console.log(String(n).padStart(5) + '  ' + path.relative(ROOT, p));
}
console.log((DRY ? '(تجربة) ' : '') + 'حُذفت ' + total + ' حركة من ' + files.length + ' ملفّاً مفحوصاً');
