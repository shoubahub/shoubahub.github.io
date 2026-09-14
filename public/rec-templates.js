/* ===================================================================
   شعبة · قوالب السجلات الرسمية (2026-09-12)
   ────────────────────────────────────────────────────────────────
   كل سجل رسمي **تعريف بيانات** يركب اللبنات السبع — لا شاشة ولا ورقة لسجل بعينه.
   الصيغة وقوائمها المغلقة والتحقق منها في rec-engine.js.

   ⚠ الاصدار المنشور لا يعدل ولا يحذف ابدا: تعديل قالب = اصدار جديد بجانبه
     { 1: {...}, 2: {...} }. والسجل المحفوظ يحمل رقم اصداره فيعرض ويطبع به
     دائما — فتعديل قالب لا يفسد سجلا قديما.
   ⚠ المعرفات (للقالب واللبنات والحقول) ثابتة عبر الاصدارات: بها تحفظ القيم،
     والعناوين تتغير بحرية.
   ⚠ ready: اسم السجل في refdata.readyRecords — به يربط ما اختاره رئيس الشعبة في ش⑥.
   ⚠ بلا تشكيل (قاعدة المنصة) — plain.mjs يفحص هذا الملف.
   =================================================================== */
window.SHOUBA_TPL = {

  /* ── سجل الاجتماعات — مرجعه الصفحة الثانية من نماذج التوجيه ──
     خانات بيانات ⟵ مساحة نص (متابعة القرارات · المحاور · القرارات) ⟵ الحضور */
  meetings: {
    1: {
      id: 'meetings', v: 1, official: true, owner: 'shouba',
      title: 'سجل الاجتماعات', ready: 'سجل اجتماعات الشعبة',
      noun: { one: 'محضر', two: 'محضران', few: 'محاضر', many: 'محضرا', zero: 'لا محاضر بعد' },   /* لعداد Shouba.count */
      page: { orient: 'portrait', fit: 'single-page', minPt: 10 },
      blocks: [
        { type: 'fields', id: 'meta', fields: [
          { id: 'no',    label: 'رقم الاجتماع',   kind: 'number', auto: 'serial:year' },
          { id: 'date',  label: 'اليوم والتاريخ', kind: 'date',   auto: 'today', show: 'weekday+date' },
          { id: 'topic', label: 'الموضوع',        kind: 'text',   required: true }
        ] },
        { type: 'text', id: 'body', lead: '- طرح في الاجتماع عدة محاور تضمنت ما يلي :', fill: 'dotted', sections: [
          { id: 'carry',  kind: 'smart:followup',  title: 'متابعة قرارات الاجتماع السابق', of: 'decide' },
          { id: 'axes',   kind: 'list',            title: 'المحاور', add: 'أضف محورا', ph: 'عنوان المحور',
            item: { title: { kind: 'text', required: true }, details: { kind: 'longtext' } } },
          { id: 'decide', kind: 'smart:decisions', title: 'القرارات والتوصيات', add: 'أضف قرارا' }
        ] },
        /* ⑥ المرفقات (2026-09-11، طلب المستخدم): وثائق مصاحبة للمحضر — غير نسخته الموقعة.
           على الورق قائمة بأسمائها فقط (خيار أ)، وتطبع هي منفصلة. ⚠ اضيفت الى الاصدار ١ قبل نشره
           (لا سجلات محفوظة به في الميدان) — وبعد النشر يكون مثلها اصدارا جديدا */
        { type: 'files', id: 'attach', title: 'المرفقات', accept: ['image', 'pdf'], print: 'list',
          hint: 'نشرة · محضر مجلس الإدارة · تعميم — تطبع أسماؤها في آخر المحضر', add: 'أرفق ملفا' },
        { type: 'signatures', id: 'att', mode: 'smart:attendance', print: { groups: 2, rows: 6, presentOnly: true } }
      ]
    }
  },

  /* ── الخطة التشغيلية للشعبة (المرحلة الثانية ب، 2026-09-12) — السجل السادس عشر ──
     لا نموذج معتمد موحد لها، فشكل المنصة هو المرجع (قرار المستخدم). عرضية ممتدة (flow):
     غلاف (اسم الخطة · الشعبة · الفصل والعام · توقيعا رئيس الشعبة ومدير المدرسة) في صفحته ⟵
     محاور متكررة، لكل محور اسمه وغاياته الاستراتيجية وجدول اجراءاته باربعة اعمدة.
     المطبوع هنا «الخطة» وعمود المتابعة فارغ؛ والمتابعة وتقرير التنفيذ في الخطوتين (ج) و(د). */
  opplan: {
    1: {
      id: 'opplan', v: 1, official: true, owner: 'shouba',
      title: 'الخطة التشغيلية للشعبة', ready: 'الخطة التشغيلية للشعبة',
      noun: { one: 'خطة', two: 'خطتان', few: 'خطط', many: 'خطة', zero: 'لا خطط بعد' },
      copy: true,   /* تنسخ من فصل سابق (المرحلة الثانية هـ) — والمتابعة تمسح */
      page: { orient: 'landscape', fit: 'flow' },
      /* مطبوعان من البيانات نفسها (المرحلة الثانية د): «الخطة» اول الفصل وعمود المتابعة فارغ ·
         و«تقرير التنفيذ» بلا غلاف، في اوله ملخص، والمتابعة حالة وملاحظة، وتختار محاوره
         (محور وحده يخرج «تقرير <اسمه>»)، ومعه ملحق الشواهد اختيارا */
      prints: [
        { id: 'plan', label: 'الخطة', title: 'الخطة التشغيلية للشعبة' },
        { id: 'report', label: 'تقرير التنفيذ', title: 'تقرير تنفيذ الخطة التشغيلية', follow: true, summary: true, cover: false,
          pick: 'axes', appendix: 'evidence' }
      ],
      blocks: [
        /* بيانات الخطة: تعبأ من الاعداد وتعدل — وتطبع على الغلاف لا جدولا (print:false) */
        { type: 'fields', id: 'meta', print: false, fields: [
          { id: 'name', label: 'اسم الخطة', kind: 'text', required: true, value: 'الخطة التشغيلية للشعبة' },
          { id: 'year', label: 'العام الدراسي', kind: 'text', auto: 'year' },
          { id: 'term', label: 'الفصل', kind: 'text', auto: 'term' }
        ] },
        { type: 'signatures', id: 'cover', mode: 'cover', roles: [
          { id: 'head', label: 'رئيس الشعبة', from: 'head' },
          { id: 'principal', label: 'مدير المدرسة', from: 'principal' }
        ] },
        { type: 'repeat', id: 'axes', label: 'محور', title: 'المحاور', add: 'أضف محورا', start: 1, blocks: [
          { type: 'fields', id: 'axis', fields: [
            { id: 'name', label: 'اسم المحور', kind: 'text', required: true, ph: 'مثل: الأنشطة والفعاليات' } ] },
          { type: 'text', id: 'goals', sections: [{ id: 'g', kind: 'paragraph', title: 'الغايات الاستراتيجية' }] },
          { type: 'table', id: 'acts', rowLabel: 'إجراء', rowsLabel: 'إجراءات', add: 'أضف إجراء',
            count: { one: 'إجراء', two: 'إجراءان', few: 'إجراءات', many: 'إجراء' },
            columns: [
              { id: 'what',   label: 'الوسائل والإجراءات والبرامج', kind: 'text' },
              { id: 'who',    label: 'الإعداد والتنفيذ', kind: 'teacher', multi: true },
              { id: 'when',   label: 'مواعيد التنفيذ', kind: 'months', multi: true },
              { id: 'follow', label: 'المتابعة', kind: 'followup' }
            ] }
        ] }
      ]
    }
  },

  /* ── شبكتا المتابعة (2026-09-12) — على لبنة الجدول نفسها: اعمدة ✓ مجمعة بعناوين رأسية، عرضية ممتدة.
     سجل لكل معلم في الفصل (owner: 'teacher' — ينشأ باسمه ويبقى يضاف اليه)، وعلى الجوال كل مجموعة
     قائمة تحقق للصف. المرجع صفحتا نماذج التوجيه العاشرة والحادية عشرة ── */

  /* نموذج متابعة سجلات الاعداد: كل صف متابعة بتاريخها، و٢٧ عنصرا في ست مجموعات، وتوقيع المعلم باليد */
  prep: {
    1: {
      id: 'prep', v: 1, official: true, owner: 'teacher',
      title: 'نموذج متابعة سجلات الإعداد للمعلمين', ready: 'متابعة سجلات الإعداد',
      noun: { one: 'سجل', two: 'سجلان', few: 'سجلات', many: 'سجلا', zero: 'لا سجلات بعد' },
      page: { orient: 'landscape', fit: 'flow' },
      blocks: [
        { type: 'fields', id: 'meta', inline: true, fields: [
          { id: 'who',  label: 'اسم المعلم',    kind: 'teacher', auto: 'teacher' },
          { id: 'term', label: 'الفصل الدراسي', kind: 'text',    auto: 'term' },
          { id: 'year', label: 'العام الدراسي', kind: 'text',    auto: 'year' }
        ] },
        /* choose: رئيس الشعبة يختار من عناصر ✓ ما يتابعه (قرار المستخدم 2026-09-12 — الاغلب لا يملأ النموذج كله) */
        { type: 'table', id: 'rows', rowLabel: 'متابعة', rowsLabel: 'متابعات', add: 'أضف متابعة', choose: true,
          numbered: false, dense: true, rows: { min: 7 },
          count: { one: 'متابعة', two: 'متابعتان', few: 'متابعات', many: 'متابعة' },
          groups: [
            { id: 'intro', label: 'النشاط الاستهلالي' }, { id: 'goals', label: 'الأهداف السلوكية' },
            { id: 'anal',  label: 'تحليل المادة' },       { id: 'grow',  label: 'أنشطة النمو' },
            { id: 'eval',  label: 'التقويم' },            { id: 'extra', label: 'الأنشطة اللاصفية' }
          ],
          columns: [
            { id: 'date', label: 'تاريخ المتابعة', kind: 'date', w: 20 },
            { id: 'hook',     label: 'عنصر التشويق',            kind: 'check', group: 'intro', vertical: true, w: 8 },
            { id: 'ivary',    label: 'التنويع',                  kind: 'check', group: 'intro', vertical: true, w: 8 },
            { id: 'innov',    label: 'الابتكار',                 kind: 'check', group: 'intro', vertical: true, w: 8 },
            { id: 'ilink',    label: 'ارتباط الموضوع',           kind: 'check', group: 'intro', vertical: true, w: 8 },
            { id: 'gcover',   label: 'تغطي المادة العلمية',      kind: 'check', group: 'goals', vertical: true, w: 8 },
            { id: 'gphrase',  label: 'حسن الصياغة',              kind: 'check', group: 'goals', vertical: true, w: 8 },
            { id: 'glevels',  label: 'تنوع المستويات',           kind: 'check', group: 'goals', vertical: true, w: 8 },
            { id: 'gdomains', label: 'تنوع مجالاتها',            kind: 'check', group: 'goals', vertical: true, w: 8 },
            { id: 'aclear',   label: 'وضوح الأفكار',             kind: 'check', group: 'anal',  vertical: true, w: 8 },
            { id: 'alinks',   label: 'الارتباطات',               kind: 'check', group: 'anal',  vertical: true, w: 8 },
            { id: 'askills',  label: 'المهارات',                 kind: 'check', group: 'anal',  vertical: true, w: 8 },
            { id: 'ageneral', label: 'التعميمات',                kind: 'check', group: 'anal',  vertical: true, w: 8 },
            { id: 'aproblem', label: 'المشكلات',                 kind: 'check', group: 'anal',  vertical: true, w: 8 },
            { id: 'nvary',    label: 'تنوعها',                   kind: 'check', group: 'grow',  vertical: true, w: 8 },
            { id: 'ngoals',   label: 'تحقق الأهداف السلوكية',    kind: 'check', group: 'grow',  vertical: true, w: 8 },
            { id: 'ndiff',    label: 'تناسب الفروق الفردية',     kind: 'check', group: 'grow',  vertical: true, w: 8 },
            { id: 'ncoop',    label: 'تنوع التعليم التعاوني',    kind: 'check', group: 'grow',  vertical: true, w: 8 },
            { id: 'emeasure', label: 'يقيس الأهداف المتنوعة',    kind: 'check', group: 'eval',  vertical: true, w: 8 },
            { id: 'evary',    label: 'التنويع',                  kind: 'check', group: 'eval',  vertical: true, w: 8 },
            { id: 'ecover',   label: 'تغطي الموضوع',             kind: 'check', group: 'eval',  vertical: true, w: 8 },
            { id: 'xvary',    label: 'تنوعها',                   kind: 'check', group: 'extra', vertical: true, w: 8 },
            { id: 'xlevels',  label: 'تقيس مستويات الأهداف',     kind: 'check', group: 'extra', vertical: true, w: 8 },
            { id: 'xlink',    label: 'ربط ميول الطالب بمصادر المعرفة', kind: 'check', group: 'extra', vertical: true, w: 8 },
            { id: 'sign', label: 'توقيع المعلم', kind: 'signature', w: 20 }
          ] }
      ]
    }
  },

  /* كشف متابعة الاعمال التحريرية: كل صف متعلم بتاريخ متابعته، وعناصر النشاط الصفي واللاصفي، وملاحظات */
  written: {
    1: {
      id: 'written', v: 1, official: true, owner: 'teacher',
      title: 'كشف متابعة الأعمال التحريرية', ready: 'متابعة الأعمال التحريرية',
      noun: { one: 'كشف', two: 'كشفان', few: 'كشوف', many: 'كشفا', zero: 'لا كشوف بعد' },
      page: { orient: 'landscape', fit: 'flow' },
      blocks: [
        { type: 'fields', id: 'meta', inline: true, fields: [
          { id: 'who',  label: 'اسم المعلم',    kind: 'teacher', auto: 'teacher' },
          { id: 'term', label: 'الفصل الدراسي', kind: 'text',    auto: 'term' },
          { id: 'year', label: 'العام الدراسي', kind: 'text',    auto: 'year' }
        ] },
        { type: 'table', id: 'rows', rowLabel: 'متعلم', rowsLabel: 'متعلمين', add: 'أضف متعلما', choose: true,
          numbered: false, dense: true, rows: { min: 10 },
          count: { one: 'متعلم', two: 'متعلمان', few: 'متعلمين', many: 'متعلما' },
          groups: [{ id: 'in', label: 'النشاط الصفي' }, { id: 'out', label: 'النشاط اللاصفي' }],
          columns: [
            { id: 'name', label: 'اسم المتعلم', kind: 'text', w: 36 },
            { id: 'date', label: 'تاريخ المتابعة', kind: 'date', vertical: true, w: 18 },
            { id: 'cvary',   label: 'التنويع والشمول',                kind: 'check', group: 'in',  w: 14 },
            { id: 'cread',   label: 'تحليل الجداول والصور والأشكال',  kind: 'check', group: 'in',  w: 14 },
            { id: 'cmaps',   label: 'رسم وتلوين الخرائط',             kind: 'check', group: 'in',  w: 14 },
            { id: 'csheets', label: 'أوراق العمل',                    kind: 'check', group: 'in',  w: 14 },
            { id: 'cneat',   label: 'النظافة والترتيب',               kind: 'check', group: 'in',  w: 14 },
            { id: 'cfix',    label: 'دقة التصويب',                    kind: 'check', group: 'in',  w: 14 },
            { id: 'cpraise', label: 'التشجيع والتحفيز',               kind: 'check', group: 'in',  w: 14 },
            { id: 'ovary',   label: 'التنويع والشمولية',              kind: 'check', group: 'out', w: 14 },
            { id: 'omaps',   label: 'رسم وتلوين الخرائط',             kind: 'check', group: 'out', w: 14 },
            { id: 'oresearch', label: 'البحث والاطلاع ومهارات أخرى',  kind: 'check', group: 'out', w: 14 },
            { id: 'oneat',   label: 'الترتيب والنظافة',               kind: 'check', group: 'out', w: 14 },
            { id: 'opraise', label: 'التشجيع والتحفيز',               kind: 'check', group: 'out', w: 14 },
            { id: 'ofix',    label: 'دقة التصويب',                    kind: 'check', group: 'out', w: 14 },
            { id: 'note', label: 'ملاحظات', kind: 'text' }
          ] }
      ]
    },
    /* الاصدار ٢ (2026-09-12، طلب المستخدم): عمود «الفصل» بعد اسم المتعلم — لا في نموذج التوجيه،
       لكن رئيس الشعبة يتابع متعلمين من فصول شتى. والاصدار ١ منشور فلا يمس: كشوفه تعرض به */
    2: {
      id: 'written', v: 2, official: true, owner: 'teacher',
      title: 'كشف متابعة الأعمال التحريرية', ready: 'متابعة الأعمال التحريرية',
      noun: { one: 'كشف', two: 'كشفان', few: 'كشوف', many: 'كشفا', zero: 'لا كشوف بعد' },
      page: { orient: 'landscape', fit: 'flow' },
      blocks: [
        { type: 'fields', id: 'meta', inline: true, fields: [
          { id: 'who',  label: 'اسم المعلم',    kind: 'teacher', auto: 'teacher' },
          { id: 'term', label: 'الفصل الدراسي', kind: 'text',    auto: 'term' },
          { id: 'year', label: 'العام الدراسي', kind: 'text',    auto: 'year' }
        ] },
        { type: 'table', id: 'rows', rowLabel: 'متعلم', rowsLabel: 'متعلمين', add: 'أضف متعلما', choose: true,
          numbered: false, dense: true, rows: { min: 10 },
          count: { one: 'متعلم', two: 'متعلمان', few: 'متعلمين', many: 'متعلما' },
          groups: [{ id: 'in', label: 'النشاط الصفي' }, { id: 'out', label: 'النشاط اللاصفي' }],
          columns: [
            { id: 'name', label: 'اسم المتعلم', kind: 'text', w: 36 },
            { id: 'cls',  label: 'الفصل', kind: 'class', w: 14, ph: 'مثل ١٠/٣' },   /* فصول المعلم من جدوله */
            { id: 'date', label: 'تاريخ المتابعة', kind: 'date', vertical: true, w: 18 },
            { id: 'cvary',   label: 'التنويع والشمول',                kind: 'check', group: 'in',  w: 14 },
            { id: 'cread',   label: 'تحليل الجداول والصور والأشكال',  kind: 'check', group: 'in',  w: 14 },
            { id: 'cmaps',   label: 'رسم وتلوين الخرائط',             kind: 'check', group: 'in',  w: 14 },
            { id: 'csheets', label: 'أوراق العمل',                    kind: 'check', group: 'in',  w: 14 },
            { id: 'cneat',   label: 'النظافة والترتيب',               kind: 'check', group: 'in',  w: 14 },
            { id: 'cfix',    label: 'دقة التصويب',                    kind: 'check', group: 'in',  w: 14 },
            { id: 'cpraise', label: 'التشجيع والتحفيز',               kind: 'check', group: 'in',  w: 14 },
            { id: 'ovary',   label: 'التنويع والشمولية',              kind: 'check', group: 'out', w: 14 },
            { id: 'omaps',   label: 'رسم وتلوين الخرائط',             kind: 'check', group: 'out', w: 14 },
            { id: 'oresearch', label: 'البحث والاطلاع ومهارات أخرى',  kind: 'check', group: 'out', w: 14 },
            { id: 'oneat',   label: 'الترتيب والنظافة',               kind: 'check', group: 'out', w: 14 },
            { id: 'opraise', label: 'التشجيع والتحفيز',               kind: 'check', group: 'out', w: 14 },
            { id: 'ofix',    label: 'دقة التصويب',                    kind: 'check', group: 'out', w: 14 },
            { id: 'note', label: 'ملاحظات', kind: 'text' }
          ] }
      ]
    }
  },

  /* ── كشف متابعة ما قطع من المنهج (2026-09-13، الخطوة هـ من بناء شريط الخطة) — نموذج التوجيه ص١٤ ──
     سجل لكل معلم في **العام** كالنموذج (scope:'year' — قرار المستخدم 2026-09-13: «اجعله للعام كله كالنموذج»)، فتجتمع
     متابعات الفصلين في ورقة واحدة. ⚠ عدل الاصدار ١ قبل نشره (لا كشوف محفوظة به في الميدان) — وبعد النشر يكون مثله
     اصدارا جديدا. على الورق: الشهر (صفان لكل شهر، من التاريخ) · التاريخ · الموضوع ·
     ما قطع من المقرر (متقدم · مطابق · متأخر — علامة في واحدة) · التوقيع · ملاحظات.
     smart:'plan': في الادخال دروس خطة التوجيه المعتمدة لمواد المعلم من جدوله — لمسة على ما وصل اليه تؤشره وما قبله
     وتقترح الحكم من اسبوع الخطة الجاري، و«سجل متابعة اليوم» يضيف صفا (العينة المعتمدة _dev/plan-mark-sim.html).
     الورق للعام: اشهر النموذج الثمانية (سبتمبر–ديسمبر وفبراير–مايو)، ويناير او يونيو ان كان فيهما صف.
     ⚠ خيارات «ما قطع» بترتيبها هذا: rec-form.js يقابلها بحكم الخطة المقترح (ahead · match · behind) */
  covered: {
    1: {
      id: 'covered', v: 1, official: true, owner: 'teacher', scope: 'year',
      title: 'كشف متابعة ما قطع من المنهج', ready: 'ما قطع من المنهج',
      noun: { one: 'كشف', two: 'كشفان', few: 'كشوف', many: 'كشفا', zero: 'لا كشوف بعد' },
      page: { orient: 'portrait', fit: 'single-page', minPt: 9 },
      blocks: [
        /* خانتا النموذج وحدهما: اسم المعلم · العام الدراسي (لا فصل: الكشف للعام) */
        { type: 'fields', id: 'meta', inline: true, fields: [
          { id: 'who',  label: 'اسم المعلم',    kind: 'teacher', auto: 'teacher' },
          { id: 'year', label: 'العام الدراسي', kind: 'text',    auto: 'year' }
        ] },
        { type: 'table', id: 'rows', rowLabel: 'متابعة', rowsLabel: 'متابعات', add: 'أضف متابعة بيدك', smart: 'plan',
          numbered: false, rowGroups: { from: 'months', per: 2, months: [9, 10, 11, 12, 2, 3, 4, 5], label: 'الشهر' },
          count: { one: 'متابعة', two: 'متابعتان', few: 'متابعات', many: 'متابعة' },
          columns: [
            { id: 'date',  label: 'التاريخ', kind: 'date', w: 24 },
            { id: 'topic', label: 'الموضوع', kind: 'text' },
            { id: 'pace',  label: 'ما قطع من المقرر', kind: 'choice', options: ['متقدم', 'مطابق', 'متأخر'], split: true, w: 16 },
            { id: 'sign',  label: 'التوقيع', kind: 'signature', w: 22 },
            { id: 'note',  label: 'ملاحظات', kind: 'text', w: 30 }
          ] }
      ]
    }
  },

  /* ── ملف المعلم (المجموعة أ، 2026-09-14) — مرجعها صفحات نماذج التوجيه ٥ و٨ و١٥. سجلات معلم (owner:'teacher').
     والغلاف «سجل متابعة معلم» (ص٤) ليس سجلا يملأ: صفحة تقديم لملف المعلم حين يطبع (P.registerCover · bundle.html?who=) ── */

  /* بطاقة متابعة معلم (ص٥): بياناته — اختيارية كلها، تكتب او تترك لليد — ثم فصوله ومقرراته وحصصه، تملأ من جدول
     حصصه بلمسة (table.fill)، وعدد الطلبة بيده، والمجموع في آخرها. لكل فصل دراسي */
  tcard: {
    1: {
      id: 'tcard', v: 1, official: true, owner: 'teacher',
      title: 'بطاقة متابعة معلم', ready: 'بطاقة متابعة معلم',
      noun: { one: 'بطاقة', two: 'بطاقتان', few: 'بطاقات', many: 'بطاقة', zero: 'لا بطاقات بعد' },
      page: { orient: 'portrait', fit: 'single-page', minPt: 10 },
      blocks: [
        { type: 'fields', id: 'meta', inline: true, fields: [
          { id: 'term', label: 'الفصل الدراسي', kind: 'text', auto: 'term' },
          { id: 'year', label: 'العام الدراسي', kind: 'text', auto: 'year' }
        ] },
        { type: 'fields', id: 'info', pairs: 2, fields: [
          { id: 'name',  label: 'الاسم الرباعي', kind: 'text', auto: 'teacher' },   /* «اسم المعلم الرباعي» في النموذج — اختصر ليسع سطرا (البطاقة للمعلم فلا لبس) */
          { id: 'nat',   label: 'الجنسية',          kind: 'text' },
          { id: 'civil', label: 'الرقم المدني',      kind: 'text' },
          { id: 'fileno', label: 'رقم الملف',        kind: 'text' },
          { id: 'addr',  label: 'العنوان',           kind: 'text' },
          { id: 'phone', label: 'رقم الهاتف',        kind: 'text' },
          { id: 'hired', label: 'تاريخ التعيين',     kind: 'date' },
          { id: 'years', label: 'سنوات الخبرة',      kind: 'number' },
          { id: 'qual',  label: 'المؤهل وتاريخه',    kind: 'text' },
          { id: 'spec',  label: 'التخصص',            kind: 'text' }
        ] },
        { type: 'table', id: 'classes', title: 'الفصول التي يدرسها المعلم', rowLabel: 'فصل', rowsLabel: 'فصول', add: 'أضف فصلا بيدك',
          rows: { min: 6 }, total: ['periods', 'students'],
          fill: { from: 'schedule', cls: 'cls', subject: 'course', periods: 'periods' },
          count: { one: 'فصل', two: 'فصلان', few: 'فصول', many: 'فصلا' },
          columns: [
            { id: 'cls',      label: 'الفصل والشعبة',        kind: 'class',  w: 26 },
            { id: 'course',   label: 'المقرر الدراسي',       kind: 'text' },
            { id: 'periods',  label: 'عدد الحصص الأسبوعية',  kind: 'number', w: 26 },
            { id: 'students', label: 'عدد الطلبة الإجمالي',  kind: 'number', w: 26 },
            { id: 'note',     label: 'ملاحظات',             kind: 'text',   w: 40 }
          ] }
      ]
    }
  },

  /* الملاحظات التربوية (ص٨): م · اليوم (من التاريخ) · التاريخ · الملاحظة · التوقيع (لليد). للعام كله كنموذجه، واسم
     المعلم تحت الترويسة — النموذج بلا اسم لانه في ملفه، والمطبوع وحده يحتاجه */
  tnotes: {
    1: {
      id: 'tnotes', v: 1, official: true, owner: 'teacher', scope: 'year',
      title: 'الملاحظات التربوية', ready: 'الملاحظات التربوية',
      noun: { one: 'سجل', two: 'سجلان', few: 'سجلات', many: 'سجلا', zero: 'لا سجلات بعد' },
      page: { orient: 'portrait', fit: 'flow' },
      blocks: [
        { type: 'fields', id: 'meta', inline: true, fields: [
          { id: 'who',  label: 'اسم المعلم',    kind: 'teacher', auto: 'teacher' },
          { id: 'year', label: 'العام الدراسي', kind: 'text',    auto: 'year' }
        ] },
        { type: 'table', id: 'rows', rowLabel: 'ملاحظة', rowsLabel: 'ملاحظات', add: 'أضف ملاحظة', rows: { min: 13 },
          count: { one: 'ملاحظة', two: 'ملاحظتان', few: 'ملاحظات', many: 'ملاحظة' },
          columns: [
            { id: 'day',  label: 'اليوم',    kind: 'auto', of: 'date', show: 'weekday', w: 22 },
            { id: 'date', label: 'التاريخ',  kind: 'date', w: 26 },
            { id: 'note', label: 'الملاحظة', kind: 'longtext' },
            { id: 'sign', label: 'التوقيع',  kind: 'signature', w: 30 }
          ] }
      ]
    }
  },

  /* إنجازات وأنشطة المعلم (ص١٥): اسم المعلم والعام تحت الترويسة، ثم م · اليوم والتاريخ · الأنشطة والإنجازات.
     للعام كله، ومعه شواهد تطبع اسماؤها في آخره (شهادة · صورة نشاط · خطاب شكر) */
  tach: {
    1: {
      id: 'tach', v: 1, official: true, owner: 'teacher', scope: 'year',
      title: 'إنجازات وأنشطة المعلم', ready: 'إنجازات المعلم وأنشطته',
      noun: { one: 'سجل', two: 'سجلان', few: 'سجلات', many: 'سجلا', zero: 'لا سجلات بعد' },
      page: { orient: 'portrait', fit: 'flow' },
      blocks: [
        { type: 'fields', id: 'meta', inline: true, fields: [
          { id: 'who',  label: 'اسم المعلم',    kind: 'teacher', auto: 'teacher' },
          { id: 'year', label: 'العام الدراسي', kind: 'text',    auto: 'year' }
        ] },
        { type: 'table', id: 'rows', rowLabel: 'إنجاز', rowsLabel: 'إنجازات', add: 'أضف إنجازا أو نشاطا', rows: { min: 18 },
          count: { one: 'إنجاز', two: 'إنجازان', few: 'إنجازات', many: 'إنجازا' },
          columns: [
            { id: 'date', label: 'اليوم والتاريخ',      kind: 'date', show: 'weekday+date', w: 40 },
            { id: 'act',  label: 'الأنشطة والإنجازات', kind: 'longtext' }
          ] },
        { type: 'files', id: 'ev', title: 'الشواهد', accept: ['image', 'pdf'], print: 'list',
          hint: 'شهادة · صورة نشاط · خطاب شكر — تطبع أسماؤها في آخر السجل', add: 'أرفق شاهدا' }
      ]
    }
  },

  /* ── المجموعة (ب) الزيارات (2026-09-14، تقسيم اعتمده المستخدم) ──
     جدول الزيارات الصفية (ص١٢ «زيارات رئيس القسم»): زيارات الفصل في جدول — «اليوم والتاريخ» (اليوم من التاريخ) ·
     اسم المعلم · الصف (فصول المعلم المختار في صفه، من جدوله) · الحصة · الملاحظات. ورئيس الشعبة تحت الترويسة */
  visits: {
    1: {
      id: 'visits', v: 1, official: true, owner: 'shouba',
      title: 'جدول الزيارات الصفية', ready: 'جدول الزيارات الصفية',
      noun: { one: 'جدول', two: 'جدولان', few: 'جداول', many: 'جدولا', zero: 'لا جداول بعد' },
      page: { orient: 'portrait', fit: 'flow' },
      blocks: [
        { type: 'fields', id: 'meta', inline: true, fields: [
          { id: 'head', label: 'رئيس الشعبة',   kind: 'text', auto: 'head' },
          { id: 'term', label: 'الفصل الدراسي', kind: 'text', auto: 'term' },
          { id: 'year', label: 'العام الدراسي', kind: 'text', auto: 'year' }
        ] },
        { type: 'table', id: 'rows', rowLabel: 'زيارة', rowsLabel: 'زيارات', add: 'أضف زيارة', rows: { min: 12 },
          count: { one: 'زيارة', two: 'زيارتان', few: 'زيارات', many: 'زيارة' },
          groups: [{ id: 'when', label: 'اليوم والتاريخ' }],
          columns: [
            { id: 'day',     label: 'اليوم',      kind: 'auto', of: 'date', show: 'weekday', w: 20, group: 'when' },
            { id: 'date',    label: 'التاريخ',    kind: 'date', w: 24, group: 'when' },
            { id: 'teacher', label: 'اسم المعلم', kind: 'teacher', staff: true, w: 42 },
            { id: 'cls',     label: 'الصف',       kind: 'class', of: 'teacher', w: 21 },   /* «١٢/٣ ع» سطر واحد (١٦ مم كسره) */
            { id: 'period',  label: 'الحصة',      kind: 'number', w: 14 },
            { id: 'note',    label: 'الملاحظات',  kind: 'text' }
          ] }
      ]
    },
    /* الاصدار ٢ (2026-09-14، طلب المستخدم: «جدول الزيارات يجب ضمه الى تقارير الزيارة لا سجل منعزل، لانه يتغذى منه»):
       لا يملأ — يتكون من تقارير زيارة رئيس الشعبة في الفصل (S.visitRows ⟵ visits.html)، كل تقرير صف، ومعه «المادة».
       والملاحظات موضوع الدرس. بلا ready: بابه recordLinks (refdata)، وجداول الاصدار ١ المكتوبة تبقى محفوظة */
    2: {
      id: 'visits', v: 2, official: true, owner: 'shouba',
      title: 'جدول الزيارات الصفية',
      noun: { one: 'جدول', two: 'جدولان', few: 'جداول', many: 'جدولا', zero: 'لا جداول بعد' },
      page: { orient: 'portrait', fit: 'flow' },
      blocks: [
        { type: 'fields', id: 'meta', inline: true, fields: [
          { id: 'head', label: 'رئيس الشعبة',   kind: 'text', auto: 'head' },
          { id: 'term', label: 'الفصل الدراسي', kind: 'text', auto: 'term' },
          { id: 'year', label: 'العام الدراسي', kind: 'text', auto: 'year' }
        ] },
        { type: 'table', id: 'rows', rowLabel: 'زيارة', rowsLabel: 'زيارات', rows: { min: 12 },
          count: { one: 'زيارة', two: 'زيارتان', few: 'زيارات', many: 'زيارة' },
          groups: [{ id: 'when', label: 'اليوم والتاريخ' }],
          columns: [
            { id: 'day',     label: 'اليوم',      kind: 'auto', of: 'date', show: 'weekday', w: 20, group: 'when' },
            { id: 'date',    label: 'التاريخ',    kind: 'date', w: 22, group: 'when' },
            { id: 'teacher', label: 'اسم المعلم', kind: 'teacher', staff: true, w: 36 },
            { id: 'subject', label: 'المادة',     kind: 'text', w: 28 },
            { id: 'cls',     label: 'الصف',       kind: 'class', w: 18 },
            { id: 'period',  label: 'الحصة',      kind: 'number', w: 16 },   /* ١٣ مم صغر عنوانه */
            { id: 'note',    label: 'الملاحظات',  kind: 'text' }
          ] }
      ]
    }
  },

  /* تقرير زيارة رئيس الشعبة (ص١٣): زيارته الصفية للمعلم — سطر الزيارة (المعلم · اليوم والتاريخ · رقمها · الصف · الحصة ·
     الموضوع) ثم «تقويم الدرس» بعناصره العشرة: عبارات كل عنصر رقاقات يؤشر منها ما ينطبق وتحتها «ملاحظات أخرى» — ثم
     الملاحظات والتوصيات. فيه التقييم والسرد معا (قرار المستخدم «ادمج السردي مع التقييمي»). تقارير كثيرة لكل معلم
     (many)، ورقم الزيارة يعد زياراته هو في العام (serial:who)، وتوقيعا المعلم ورئيس الشعبة افتراضا (signs) */
  hvisit: {
    1: {
      id: 'hvisit', v: 1, official: true, owner: 'teacher', many: true,
      title: 'تقرير زيارة رئيس الشعبة', ready: 'تقرير زيارة رئيس الشعبة',
      noun: { one: 'تقرير', two: 'تقريران', few: 'تقارير', many: 'تقريرا', zero: 'لا تقارير بعد' },
      page: { orient: 'portrait', fit: 'single-page', minPt: 9 },
      signs: { teacher: true, head: true },
      blocks: [
        { type: 'fields', id: 'meta', inline: true, fields: [
          { id: 'who',    label: 'المعلم',         kind: 'teacher', auto: 'teacher' },
          { id: 'date',   label: 'اليوم والتاريخ', kind: 'date',    auto: 'today', show: 'weekday+date' },
          { id: 'no',     label: 'رقم الزيارة',    kind: 'number',  auto: 'serial:who' },
          { id: 'cls',    label: 'الصف',           kind: 'class' },
          { id: 'period', label: 'الحصة',          kind: 'number' },
          { id: 'topic',  label: 'الموضوع',        kind: 'text', required: true }
        ] },
        /* choose: رئيس الشعبة يخرج من العناصر ويضيف عناصر له بعباراتها («عناصر النموذج» — طلب المستخدم 2026-09-14) */
        { type: 'rating', id: 'eval', title: 'تقويم الدرس', head: ['عناصر التقويم', 'تقويم الدرس'], note: 'ملاحظات أخرى', choose: true, items: [
          { id: 'warm',    label: 'النشاط الاستهلالي', opts: ['مشوق وجاذب', 'مناسب للدرس', 'المدة الزمنية مناسبة', 'مبتكر', 'مبدع', 'أسئلة حول الدرس السابق'] },
          { id: 'prep',    label: 'إعداد الدروس والالتزام بالخطة', opts: ['الإعداد الذهني مرتب', 'منظم', 'الإعداد الكتابي مطابق للبنود', 'ملتزم مع خطة توزيع المقرر'] },
          { id: 'goals',   label: 'تحقيق الكفايات والأهداف التربوية', opts: ['اختيار الكفايات والأهداف التربوية مستوفية الشروط', 'متنوعة في مجالاتها', 'مدى تحقيقها'] },
          { id: 'know',    label: 'التمكن من المادة العلمية', one: true, opts: ['ممتاز', 'جيد جدا', 'جيد', 'مقبول'] },
          { id: 'strat',   label: 'استراتيجيات التدريس (طرق وأساليب)', opts: ['حديثة', 'متنوعة', 'مناسبة', 'تحقق التعلم الذاتي'] },
          { id: 'tech',    label: 'التقنيات والوسائل التعليمية', opts: ['متنوعة', 'مناسبة', 'مبتكرة', 'تقليدية'] },
          { id: 'acts',    label: 'الأنشطة المصاحبة للدرس', opts: ['كافية', 'متنوعة', 'تحقق الأهداف', 'مرتبطة بموضوع الدرس'] },
          { id: 'manage',  label: 'إدارة الفصل', opts: ['ثقة بالنفس', 'وضوح الصوت', 'استخدام اللغة العربية', 'ضبط الفصل'] },
          { id: 'assess',  label: 'أساليب التقويم', opts: ['مدى كفايتها', 'تقيس الأهداف', 'متنوعة (بنائية - ختامية)', 'مناسبة لمستوى المتعلمين'] },
          { id: 'written', label: 'الأعمال التحريرية', opts: ['متنوعة', 'متابعة', 'مصوبة', 'محققة للأهداف', 'تدوين العبارات'] }
        ] },
        { type: 'text', id: 'recs', sections: [{ id: 'notes', kind: 'paragraph', title: 'الملاحظات والتوصيات' }] }
      ]
    },
    /* الاصدار ٢ (2026-09-14، طلب المستخدم — والاول منشور فلا يمس، وتقاريره تعرض به):
       · «الحصة التي زرتها» من جدول المعلم ليوم الزيارة — لمسة تملأ المادة والصف والحصة (slot)، و«حصة ليست في جدوله»
         لما سواها، ولا يطبع ما يميزها · «المادة» في سطر الزيارة («لتعدد اسماء المواد في كل شعبة»)
       · «متابعة الأعمال التحريرية»: اسماء المتعلمين الذين تابع اعمالهم في الزيارة وحدها (chips)، تغذي كشف متابعة
         الاعمال التحريرية للمعلم (feed — derive.js)، وعلى الورق سطر تحت جدول التقويم */
    2: {
      id: 'hvisit', v: 2, official: true, owner: 'teacher', many: true,
      title: 'تقرير زيارة رئيس الشعبة', ready: 'تقرير زيارة رئيس الشعبة',
      noun: { one: 'تقرير', two: 'تقريران', few: 'تقارير', many: 'تقريرا', zero: 'لا تقارير بعد' },
      page: { orient: 'portrait', fit: 'single-page', minPt: 9 },
      signs: { teacher: true, head: true },
      /* جدول الزيارات الصفية يتكون من هذه التقارير (visits.html) — سطره في الارشيف */
      derived: { page: 'visits.html', label: 'جدول زياراتك الصفية' },
      blocks: [
        { type: 'fields', id: 'meta', inline: true, fields: [
          { id: 'who',     label: 'المعلم',         kind: 'teacher', auto: 'teacher' },
          { id: 'date',    label: 'اليوم والتاريخ', kind: 'date',    auto: 'today', show: 'weekday+date' },
          { id: 'no',      label: 'رقم الزيارة',    kind: 'number',  auto: 'serial:who' },
          { id: 'subject', label: 'المادة',         kind: 'text',    slot: true },
          { id: 'cls',     label: 'الصف',           kind: 'class',   slot: true },
          { id: 'period',  label: 'الحصة',          kind: 'number',  slot: true },
          { id: 'topic',   label: 'الموضوع',        kind: 'text', required: true }
        ] },
        { type: 'rating', id: 'eval', title: 'تقويم الدرس', head: ['عناصر التقويم', 'تقويم الدرس'], note: 'ملاحظات أخرى', choose: true, items: [
          { id: 'warm',    label: 'النشاط الاستهلالي', opts: ['مشوق وجاذب', 'مناسب للدرس', 'المدة الزمنية مناسبة', 'مبتكر', 'مبدع', 'أسئلة حول الدرس السابق'] },
          { id: 'prep',    label: 'إعداد الدروس والالتزام بالخطة', opts: ['الإعداد الذهني مرتب', 'منظم', 'الإعداد الكتابي مطابق للبنود', 'ملتزم مع خطة توزيع المقرر'] },
          { id: 'goals',   label: 'تحقيق الكفايات والأهداف التربوية', opts: ['اختيار الكفايات والأهداف التربوية مستوفية الشروط', 'متنوعة في مجالاتها', 'مدى تحقيقها'] },
          { id: 'know',    label: 'التمكن من المادة العلمية', one: true, opts: ['ممتاز', 'جيد جدا', 'جيد', 'مقبول'] },
          { id: 'strat',   label: 'استراتيجيات التدريس (طرق وأساليب)', opts: ['حديثة', 'متنوعة', 'مناسبة', 'تحقق التعلم الذاتي'] },
          { id: 'tech',    label: 'التقنيات والوسائل التعليمية', opts: ['متنوعة', 'مناسبة', 'مبتكرة', 'تقليدية'] },
          { id: 'acts',    label: 'الأنشطة المصاحبة للدرس', opts: ['كافية', 'متنوعة', 'تحقق الأهداف', 'مرتبطة بموضوع الدرس'] },
          { id: 'manage',  label: 'إدارة الفصل', opts: ['ثقة بالنفس', 'وضوح الصوت', 'استخدام اللغة العربية', 'ضبط الفصل'] },
          { id: 'assess',  label: 'أساليب التقويم', opts: ['مدى كفايتها', 'تقيس الأهداف', 'متنوعة (بنائية - ختامية)', 'مناسبة لمستوى المتعلمين'] },
          { id: 'written', label: 'الأعمال التحريرية', opts: ['متنوعة', 'متابعة', 'مصوبة', 'محققة للأهداف', 'تدوين العبارات'] }
        ] },
        { type: 'table', id: 'wworks', title: 'متابعة الأعمال التحريرية', chips: true, rowLabel: 'متعلم', rowsLabel: 'متعلمين',
          add: 'أضف المتعلم', ph: 'اسم المتعلم', lead: 'تمت متابعة الأعمال التحريرية للمتعلمين',
          hint: 'اسم المتعلم وحده — والصف والتاريخ من الزيارة، ويضاف إلى كشف متابعة الأعمال التحريرية للمعلم',
          feed: { tpl: 'written', block: 'rows', from: { cls: 'meta.cls', date: 'meta.date' } },
          columns: [{ id: 'name', label: 'اسم المتعلم', kind: 'text' }] },
        { type: 'text', id: 'recs', sections: [{ id: 'notes', kind: 'paragraph', title: 'الملاحظات والتوصيات' }] }
      ]
    }
  },

  /* تقرير زيارة الموجه الفني (ص١ وص٣ نموذجا واحدا — اعتمده المستخدم 2026-09-14): زيارة الموجه للشعبة — عبارتها
     الافتتاحية كنموذجها باسم الشعبة والمدرسة ورئيسها، ثم ما تضمنته (سرد ص١)، ثم «متابعة أعمال الشعبة» ببنودها العشرة
     وملاحظة كل بند (ص٣)، ثم التوجيهات الفنية. يوقعه الموجه افتراضا، ونسخته الموقعة ترفق من الارشيف */
  svisit: {
    1: {
      id: 'svisit', v: 1, official: true, owner: 'shouba',
      title: 'تقرير زيارة الموجه الفني', ready: 'تقرير زيارة الموجه الفني',
      noun: { one: 'تقرير', two: 'تقريران', few: 'تقارير', many: 'تقريرا', zero: 'لا تقارير بعد' },
      page: { orient: 'portrait', fit: 'single-page', minPt: 9 },
      signs: { supervisor: true },
      blocks: [
        { type: 'fields', id: 'meta', inline: true, fields: [
          { id: 'date', label: 'اليوم والتاريخ', kind: 'date', auto: 'today', show: 'weekday+date' },
          { id: 'sup',  label: 'الموجه الفني',   kind: 'text', auto: 'supervisor' }
        ] },
        { type: 'text', id: 'body', lead: 'تمت زيارة شعبة {dept} بمدرسة {school} والالتقاء برئيسها أ. {head}.', sections: [
          { id: 'did', kind: 'paragraph', title: 'وتضمنت الزيارة' }
        ] },
        { type: 'rating', id: 'works', title: 'متابعة أعمال الشعبة', head: ['البنود', 'الملاحظات'], items: [
          { id: 'coop',  label: 'التعاون في مجال العمل ومتابعة الأنشطة' },
          { id: 'aims',  label: 'الإلمام بالأهداف العامة والخاصة (الكفايات) ومتابعتها عند العاملين معه' },
          { id: 'pdev',  label: 'التنمية المهنية للمعلمين' },
          { id: 'meet',  label: 'عقد الاجتماعات' },
          { id: 'lwork', label: 'متابعة أعمال المتعلمين' },
          { id: 'twork', label: 'متابعة أعمال المعلمين' },
          { id: 'vplan', label: 'التخطيط للزيارات' },
          { id: 'recs',  label: 'إعداد السجلات' },
          { id: 'exams', label: 'الإشراف على الاختبارات ومتابعة النتائج' },
          { id: 'self',  label: 'التنمية المهنية الذاتية' }
        ] },
        { type: 'text', id: 'guide', sections: [{ id: 'text', kind: 'paragraph', title: 'توجيهات فنية' }] }
      ]
    }
  }

};
