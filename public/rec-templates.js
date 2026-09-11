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
  }

};
