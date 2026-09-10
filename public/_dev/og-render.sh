#!/bin/bash
# يولّد صورة المعاينة (og:image) من أصلها — يُشغَّل من جذر المشروع:  bash public/_dev/og-render.sh
# الأصل: public/_dev/og-cover.html  ⟵  الناتج: public/identity/assets/og-cover.jpg (١٢٠٠×٦٣٠)
# ⚠ بعد التوليد: اختمْ بناءً جديداً (stamp.mjs) — فرقم البناء في عنوان الصورة يُسقط نسخة واتساب القديمة.
set -e
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CH" ] || { echo "⚠ يلزم Google Chrome"; exit 1; }
SRC="$(pwd)/public/_dev/og-cover.html"
OUT="$(pwd)/public/identity/assets/og-cover.jpg"
TMP="$(mktemp -d)/og.png"
"$CH" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --allow-file-access-from-files --virtual-time-budget=9000 \
  --window-size=1200,630 --screenshot="$TMP" "file://$SRC" >/dev/null 2>&1
sips -s format jpeg -s formatOptions 86 "$TMP" --out "$OUT" >/dev/null
rm -f "$TMP"
echo "✓ $(sips -g pixelWidth -g pixelHeight "$OUT" | tail -2 | awk '{printf $2" "}')· $(stat -f%z "$OUT") بايت ⟵ $OUT"
