#!/bin/bash
# نشر شعبة على GitHub Pages — يُشغَّل من جذر المشروع:  bash public/_dev/deploy.sh
# يبني فرع gh-pages من ملفّات الإنتاج وحدها: بلا _dev ولا _legacy ولا القالب.
set -e
REPO="${1:-}"                      # مثال: https://github.com/USER/shouba.git
# ⚠ متسامح مع المسافات: المحاذاة في build.js كسرت القراءة مرّة، و`set -e`
#    أوقف السكربت صامتاً قبل أن يدفع شيئاً (رُصد 2026-09-06).
BUILD=$(grep -oE 'SHOUBA_BUILD[[:space:]]*=[[:space:]]*[0-9]+' public/build.js | grep -oE '[0-9]+' || echo '?')
VER=$(grep -oE "SHOUBA_VERSION[[:space:]]*=[[:space:]]*'[^']+'" public/build.js | grep -oE "[0-9.]+" || echo '?')
[ -z "$REPO" ] && REPO=$(git remote get-url origin 2>/dev/null || true)
[ -z "$REPO" ] && { echo "⚠ لا مستودع بعيد — مرّره وسيطاً"; exit 1; }

TMP=$(mktemp -d)
cp -R public/. "$TMP/"
rm -rf "$TMP/_dev" "$TMP/_legacy" "$TMP/_template.html"
cd "$TMP"
git init -q && git checkout -qb gh-pages
git add -A
git -c user.name="shouba" -c user.email="noreply@shouba" commit -qm "نشر $VER · بناء $BUILD"
git push -qf "$REPO" gh-pages
cd - >/dev/null && rm -rf "$TMP"
echo "نُشرت $VER · بناء $BUILD على فرع gh-pages"
