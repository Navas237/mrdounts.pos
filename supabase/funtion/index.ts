// create-user
// ينشئ مستخدماً جديداً (اسم مستخدم + باسورد) ويضيف @MRDOUNTS.COM تلقائياً،
// ويربطه بالفرع، ويمنحه الصلاحيات والأقسام المحددة.
//
// الطلب: POST  (Authorization: Bearer <JWT المستخدم الحالي>)
// {
//   "username": "ahmed",              // 3-32 حرف: a-z 0-9 . _ -
//   "password": "********",           // 8 أحرف على الأقل
//   "full_name": "أحمد",              // اختياري
//   "phone": "01000000000",           // اختياري
//   "branch_id": "<uuid>",            // للسوبر أدمن فقط، وإلا فرع المنفّذ
//   "permissions": ["order.create"],  // مفاتيح من جدول permissions
//   "department_ids": ["<uuid>"]      // الأقسام المسموحة
// }
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, fail, json, readJson } from "../_shared/http.ts";

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
const EMAIL_DOMAIN = Deno.env.get("EMAIL_DOMAIN") ?? "MRDOUNTS.COM";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function strList(v: unknown): string[] | null {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) return null;
  return [...new Set(v as string[])];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return fail(405, "METHOD_NOT_ALLOWED", "POST only");
  }

  // ---- 1) من المنفّذ؟ ----
  const token = (req.headers.get("Authorization") ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  if (!token) return fail(401, "UNAUTHENTICATED", "سجّل الدخول أولاً");
  const { data: authData, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !authData.user) {
    return fail(401, "UNAUTHENTICATED", "جلسة غير صالحة");
  }

  const { data: caller } = await admin
    .from("profiles")
    .select("id, branch_id, is_active, is_super_admin")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (!caller || !caller.is_active) {
    return fail(403, "FORBIDDEN", "حساب غير نشط");
  }

  const callerPerms = new Set<string>();
  if (!caller.is_super_admin) {
    const { data: rows } = await admin
      .from("user_permissions")
      .select("permission_key")
      .eq("user_id", caller.id);
    (rows ?? []).forEach((r: { permission_key: string }) =>
      callerPerms.add(r.permission_key)
    );
    if (!callerPerms.has("users.manage")) {
      return fail(403, "FORBIDDEN", "ليس لديك صلاحية إدارة المستخدمين");
    }
  }

  // ---- 2) تحقق من المدخلات ----
  const body = await readJson(req);
  if (!body) return fail(400, "BAD_REQUEST", "JSON غير صالح");

  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const fullName = String(body.full_name ?? "").trim();
  const phone = body.phone ? String(body.phone).trim() : null;
  const permissions = strList(body.permissions);
  const departmentIds = strList(body.department_ids);

  if (!USERNAME_RE.test(username)) {
    return fail(
      400,
      "INVALID_USERNAME",
      "اسم المستخدم 3-32 حرف إنجليزي صغير أو أرقام أو . _ -",
    );
  }
  if (password.length < 8) {
    return fail(400, "WEAK_PASSWORD", "الباسورد 8 أحرف على الأقل");
  }
  if (permissions === null || departmentIds === null) {
    return fail(
      400,
      "BAD_REQUEST",
      "permissions و department_ids لازم تكون قوائم نصوص",
    );
  }

  // الفرع: غير السوبر أدمن لا ينشئ إلا في فرعه
  let branchId: string = caller.branch_id;
  if (body.branch_id) {
    if (!caller.is_super_admin && body.branch_id !== caller.branch_id) {
      return fail(403, "FORBIDDEN", "لا يمكن إنشاء مستخدم في فرع آخر");
    }
    branchId = String(body.branch_id);
  }
  const { data: branch } = await admin
    .from("branches").select("id").eq("id", branchId).eq("is_active", true)
    .maybeSingle();
  if (!branch) return fail(400, "INVALID_BRANCH", "الفرع غير موجود أو غير نشط");

  // الصلاحيات: موجودة في الكتالوج، والمنفّذ يمنح فقط ما يملكه
  if (permissions.length) {
    const { data: found } = await admin.from("permissions").select("key").in(
      "key",
      permissions,
    );
    const known = new Set((found ?? []).map((p: { key: string }) => p.key));
    const unknown = permissions.filter((p) => !known.has(p));
    if (unknown.length) {
      return fail(
        400,
        "UNKNOWN_PERMISSION",
        `صلاحيات غير معروفة: ${unknown.join(", ")}`,
      );
    }
    if (!caller.is_super_admin) {
      const notOwned = permissions.filter((p) => !callerPerms.has(p));
      if (notOwned.length) {
        return fail(
          403,
          "FORBIDDEN",
          `لا يمكنك منح صلاحيات لا تملكها: ${notOwned.join(", ")}`,
        );
      }
    }
  }

  // الأقسام: لازم تتبع نفس فرع المستخدم الجديد
  if (departmentIds.length) {
    const { data: depts } = await admin
      .from("departments").select("id").eq("branch_id", branchId).in(
        "id",
        departmentIds,
      );
    if ((depts ?? []).length !== departmentIds.length) {
      return fail(400, "INVALID_DEPARTMENT", "قسم غير موجود في هذا الفرع");
    }
  }

  const { data: existing } = await admin
    .from("profiles").select("id").eq("username", username).maybeSingle();
  if (existing) {
    return fail(409, "USERNAME_TAKEN", "اسم المستخدم مستخدم بالفعل");
  }

  // ---- 3) إنشاء المستخدم (التريجر handle_new_user ينشئ البروفايل) ----
  const email = `${username}@${EMAIL_DOMAIN}`;
  const { data: created, error: createErr } = await admin.auth.admin.createUser(
    {
      email,
      password,
      email_confirm: true,
      app_metadata: { branch_id: branchId, full_name: fullName },
    },
  );
  if (createErr || !created.user) {
    const taken = /already|registered|exists/i.test(createErr?.message ?? "");
    return taken
      ? fail(409, "USERNAME_TAKEN", "اسم المستخدم مستخدم بالفعل")
      : fail(500, "CREATE_FAILED", createErr?.message ?? "تعذر إنشاء المستخدم");
  }
  const userId = created.user.id;

  // ---- 4) تفاصيل إضافية، وأي فشل = تراجع كامل ----
  const rollback = async (message: string) => {
    await admin.auth.admin.deleteUser(userId); // يحذف البروفايل تلقائياً (cascade)
    return fail(500, "SETUP_FAILED", message);
  };

  const { data: profile, error: profErr } = await admin
    .from("profiles").select("id").eq("id", userId).maybeSingle();
  if (profErr || !profile) return await rollback("لم يتم إنشاء البروفايل");

  if (phone) {
    const { error } = await admin.from("profiles").update({ phone }).eq(
      "id",
      userId,
    );
    if (error) return await rollback(error.message);
  }
  if (permissions.length) {
    const { error } = await admin.from("user_permissions").insert(
      permissions.map((permission_key) => ({
        user_id: userId,
        permission_key,
        granted_by: caller.id,
      })),
    );
    if (error) return await rollback(error.message);
  }
  if (departmentIds.length) {
    const { error } = await admin.from("user_department_access").insert(
      departmentIds.map((department_id) => ({
        user_id: userId,
        department_id,
      })),
    );
    if (error) return await rollback(error.message);
  }

  return json({
    ok: true,
    user: {
      id: userId,
      username,
      email,
      branch_id: branchId,
      full_name: fullName,
      phone,
      permissions,
      department_ids: departmentIds,
    },
  }, 201);
});
