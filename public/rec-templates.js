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
  }

};
