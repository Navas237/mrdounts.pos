# قاعدة البيانات (Supabase / PostgreSQL)

## التشغيل

```bash
supabase init                    # لو المشروع لسه جديد
# انسخ مجلد migrations و seed.sql جوه supabase/
supabase link --project-ref <PROJECT_REF>
supabase db push                 # يطبق المايجريشن بالترتيب
supabase db reset                # (محلياً فقط) يطبق المايجريشن + seed.sql
```

على المشروع الأونلاين شغّل `seed.sql` يدوياً من SQL Editor مرة واحدة (بعد تعديل اسم الفرع).

## ترتيب الملفات

| # | الملف | المحتوى |
|---|---|---|
| 1 | `foundation` | الفروع، إعدادات الفرع، المستخدمون، كتالوج الصلاحيات، دوال التحقق |
| 2 | `menu` | الطابعات، الأقسام، الأصناف، الأحجام، قوائم الصوصات والتوبنج، بنية الدونتس |
| 3 | `commerce` | طرق الدفع، مناطق التوصيل، الخصومات، العملاء وعناوينهم، الكول سنتر |
| 4 | `shifts` | الشفتات وحركات الدرج |
| 5 | `orders` | الأوردرات والأصناف وقطع الدونتس والدفع والأحداث ومهام الطباعة |
| 6 | `logic` | التريجرز والـ RPC (ترقيم، إجماليات، طباعة، دفعات الدونتس، شفت، إلغاء، تسليم) |
| 7 | `rls_realtime` | سياسات الأمان وتفعيل Realtime |

## أول مستخدم (سوبر أدمن)

1. أنشئ مستخدماً من Supabase Dashboard ← Authentication بإيميل مثل `admin@mrdounts.com`.
2. شغّل:

```sql
insert into public.profiles (id, branch_id, username, full_name, is_super_admin)
select u.id, (select id from public.branches limit 1), 'admin', 'المدير', true
from auth.users u where u.email = 'admin@mrdounts.com';
```

3. **عطّل التسجيل العام** (Disable signups) من إعدادات Authentication.

باقي المستخدمين يُنشأون من Edge Function (بمفتاح الخدمة) عبر `auth.admin.createUser` مع
`app_metadata: { branch_id: '<uuid>' }`، فيُنشأ البروفايل تلقائياً. اسم الدخول = `username@MRDOUNTS.COM`.
الصلاحيات تُمنح بعدها في `user_permissions`، والأقسام المسموحة في `user_department_access`.

## كيف يعمل الأوردر (التطبيق ← قاعدة البيانات)

1. الكاشير يفتح شفت: `rpc('open_shift', { p_opening_cash })`.
2. إدخال الأوردر بالترتيب: `orders` ← `order_items` ← `order_item_options` / `order_item_pieces` ← `order_item_piece_options` ← `payments`.
   - **تلقائي:** رقم الأوردر والشفت، الضريبة، الإضافات، إجمالي السطر والأوردر، دفعة الدونتس، ملصقات الطباعة.
   - التطبيق يرسل فقط `unit_price` (سعر الحجم/البوكس) والأسماء كـ Snapshot.
   - بوكس الدونتس = سطر مستقل (quantity = 1).
3. الشاشات تسمع `order_items` و `order_events` عبر Realtime. الإلغاء يظهر كحدث `item_cancelled` / `order_cancelled`.
4. الإجراءات عبر RPC: `start_item`, `finish_item`, `deliver_order`, `cancel_order`, `cancel_order_item`,
   `donut_stop_receiving`, `donut_resume_receiving`, `donut_finish_batch`, `close_shift`, `drawer_report`.
5. خدمة الطباعة (مستخدم عنده `print.manage`) تسمع `print_jobs` الـ `pending` وتحدّث الحالة.

## افتراضات اتحطت (غيّرها لو مش مناسبة)

- **الضريبة** تتحسب على (الأصناف − الخصم) ولا تشمل رسوم التوصيل.
- **سعر بوكس الدونتس** واحد لكل (نوع + عدد قطع) في `donut_box_sizes`، بدون فرق بين المحشي والتوبنج. لو فيه فرق سعر، نضيف عمود.
- **حدود اختيارات الدونتس** (`donut_type_groups`) تُطبَّق لكل قطعة.
- **إيقاف استلام الدونتس** يقفل الدفعة ويحوّل أصنافها لـ "قيد التجهيز"، و"خلص" يجهّز الدفعة كلها.
- **إلغاء الأوردر** يحتفظ بإجماليه الأصلي للتقارير، وتعديل الأوردر لسه مؤجل (يسجّل حدث `item_modified` فقط).
- **التسليم** لا يشترط اكتمال الدفع (ديليفري/صالة ممكن يتدفعوا بعد التسليم).
- الدرج المتوقع = رصيد افتتاحي + مدفوعات نقدية + دخل − خروج (الأوردرات الملغية مستبعدة).

## ما تم اختباره

طُبقت المايجريشن كلها على PostgreSQL 16 واختُبر: ترقيم من 1 وشفت واحد مفتوح، منع الأوردر بدون شفت،
الإجماليات والخصم والإضافات، ملصقات الطباعة، قايمة انتظار الدونتس والدفعات، منع التسليم قبل الجاهزية،
الإلغاء مع الاحتفاظ بالإجمالي، حساب الدرج وقفل الشفت، وعزل الفروع ومنع تعديل المنيو أو منح صلاحيات من غير حق.

---

## Edge Functions

```
supabase/functions/
├── _shared/http.ts        # CORS وردود JSON
├── create-user/index.ts   # إنشاء المستخدمين
└── call-webhook/index.ts  # استقبال مكالمات الكول سنتر
```

### النشر

```bash
supabase functions deploy create-user
supabase functions deploy call-webhook --no-verify-jwt   # الأندرويد بيستخدم توكن جهاز مش JWT

# اختياري: لو عايز دومين تاني غير MRDOUNTS.COM
supabase secrets set EMAIL_DOMAIN=MRDOUNTS.COM
```

أو في `supabase/config.toml`:

```toml
[functions.call-webhook]
verify_jwt = false
```

المتغيرات `SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY` بتتوفر تلقائياً للدوال، ومفتاح الخدمة **لا يوضع أبداً في تطبيق الواجهة**.

### 1) `create-user`

- يتحقق من الجلسة، وإن المنفّذ نشط ويملك `users.manage` (أو سوبر أدمن).
- يضيف `@MRDOUNTS.COM` للاسم، وينشئ المستخدم، والتريجر ينشئ البروفايل.
- غير السوبر أدمن: ينشئ في فرعه فقط، ويمنح فقط صلاحيات يملكها.
- الأقسام لازم تتبع نفس فرع المستخدم الجديد.
- لو فشل أي جزء بعد الإنشاء، المستخدم بيتحذف (تراجع كامل).

```ts
const { data, error } = await supabase.functions.invoke('create-user', {
  body: {
    username: 'ahmed',
    password: 'Str0ng-pass',
    full_name: 'أحمد',
    permissions: ['screen.cashier', 'order.create', 'shift.open'],
    department_ids: ['<uuid>'],
  },
});
```

أكواد الأخطاء: `UNAUTHENTICATED` (401)، `FORBIDDEN` (403)، `INVALID_USERNAME` / `WEAK_PASSWORD` / `UNKNOWN_PERMISSION` / `INVALID_DEPARTMENT` / `INVALID_BRANCH` (400)، `USERNAME_TAKEN` (409).

### 2) `call-webhook`

**إنشاء جهاز الكول سنتر** (مرة واحدة). التوكن بيتخزن كـ SHA-256 فقط، فاحفظ التوكن الأصلي لحظة الإنشاء لأنه مش هيظهر تاني:

```sql
-- ولّد توكن عشوائي وانسخه للتطبيق
select 'dev_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') as token;

insert into public.call_center_devices (branch_id, name, token_hash)
values (
  (select id from public.branches where code = 'MAIN'),
  'موبايل الكول سنتر',
  encode(sha256(convert_to('<التوكن اللي ولّدته>', 'UTF8')), 'hex')
);
```

**من تطبيق الأندرويد:**

```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/call-webhook" \
  -H "x-device-token: <التوكن>" -H "Content-Type: application/json" \
  -d '{"phone": "+201001234567", "event": "ringing"}'
```

- `event`: `ringing` (الافتراضي) / `answered` / `missed` / `dismissed`.
- الرقم بيتوحّد لصيغة `01xxxxxxxxx` (من `+20` و `0020` و `20`) عشان يطابق جدول العملاء.
- لو نفس الرقم بيرن خلال آخر دقيقة، ما بيتكررش الصف.
- الأحداث التانية (`answered`...) بتحدّث آخر مكالمة لنفس الرقم بدل ما تعمل صف جديد.
- الرد فيه بيانات العميل لو الرقم موجود، وشاشة الكاشير تشوف الحدث لحظياً من Realtime على `call_events`.

> **افتراض:** أرقام العملاء في جدول `customers` متخزنة بالصيغة المحلية `01xxxxxxxxx`. لو بتخزنها بصيغة دولية، قولّي أغيّر التطبيع.
