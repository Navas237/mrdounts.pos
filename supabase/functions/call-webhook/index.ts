// call-webhook
// تطبيق الأندرويد يبعت هنا رقم المتصل، فيظهر للكاشير لحظياً (Realtime على call_events).
// بدون تسجيل مكالمات: رقم + حالة فقط.
//
// الطلب: POST  (Header: x-device-token: <توكن الجهاز>)
// { "phone": "+201000000000", "event": "ringing" }
//   event: ringing (الافتراضي) | answered | missed | dismissed
//
// المصادقة: التوكن بيتحوّل SHA-256 ويتقارن بـ call_center_devices.token_hash
// ⚠️ لازم تُنشر بدون JWT:  supabase functions deploy call-webhook --no-verify-jwt
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, fail, json, readJson } from "../_shared/http.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const EVENTS = ["ringing", "answered", "missed", "dismissed"] as const;
type CallEvent = (typeof EVENTS)[number];

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// يوحّد الرقم لصيغة محلية مصرية (01xxxxxxxxx) عشان يطابق جدول العملاء
function normalizePhone(raw: string): string | null {
  let p = raw.replace(/[\s()-]/g, "");
  p = p.startsWith("+")
    ? "+" + p.slice(1).replace(/\D/g, "")
    : p.replace(/\D/g, "");

  if (p.startsWith("+20") && p.length === 13) p = "0" + p.slice(3);
  else if (p.startsWith("0020") && p.length === 14) p = "0" + p.slice(4);
  else if (p.startsWith("20") && p.length === 12) p = "0" + p.slice(2);

  return /^[0-9+]{6,20}$/.test(p) ? p : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return fail(405, "METHOD_NOT_ALLOWED", "POST only");
  }

  // ---- 1) الجهاز ----
  const deviceToken = req.headers.get("x-device-token")?.trim();
  if (!deviceToken) return fail(401, "UNAUTHENTICATED", "x-device-token مطلوب");

  const { data: device } = await admin
    .from("call_center_devices")
    .select("id, branch_id, is_active")
    .eq("token_hash", await sha256Hex(deviceToken))
    .maybeSingle();
  if (!device || !device.is_active) {
    return fail(401, "UNAUTHENTICATED", "جهاز غير مصرّح");
  }

  // ---- 2) المدخلات ----
  const body = await readJson(req);
  if (!body) return fail(400, "BAD_REQUEST", "JSON غير صالح");

  const phone = normalizePhone(String(body.phone ?? ""));
  if (!phone) return fail(400, "INVALID_PHONE", "رقم غير صالح");

  const event = String(body.event ?? "ringing") as CallEvent;
  if (!EVENTS.includes(event)) {
    return fail(400, "INVALID_EVENT", `event لازم يكون: ${EVENTS.join(" | ")}`);
  }

  await admin.from("call_center_devices")
    .update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);

  const select = "id, status, phone, customer_id, customers(id, name)";
  const ago = (seconds: number) =>
    new Date(Date.now() - seconds * 1000).toISOString();

  // ---- 3) الحدث ----
  let row: Record<string, unknown> | null = null;

  if (event === "ringing") {
    // منع التكرار: نفس الرقم بيرن بالفعل خلال آخر دقيقة
    const { data: dup } = await admin.from("call_events").select(select)
      .eq("branch_id", device.branch_id).eq("phone", phone).eq(
        "status",
        "ringing",
      )
      .gte("created_at", ago(60)).order("created_at", { ascending: false })
      .limit(1).maybeSingle();
    row = dup;
  } else {
    // نحدّث آخر مكالمة لنفس الرقم (خلال 10 دقايق) بدل ما نكرر الصفوف
    const { data: last } = await admin.from("call_events").select("id")
      .eq("branch_id", device.branch_id).eq("phone", phone).in("status", [
        "ringing",
        "answered",
      ])
      .gte("created_at", ago(600)).order("created_at", { ascending: false })
      .limit(1).maybeSingle();
    if (last) {
      const { data: upd, error } = await admin.from("call_events")
        .update({ status: event }).eq("id", last.id).select(select).single();
      if (error) return fail(500, "DB_ERROR", error.message);
      row = upd;
    }
  }

  if (!row) {
    // ربط العميل يتم تلقائياً بتريجر call_events_link_customer
    const { data: ins, error } = await admin.from("call_events")
      .insert({
        branch_id: device.branch_id,
        device_id: device.id,
        phone,
        status: event,
      })
      .select(select).single();
    if (error) return fail(500, "DB_ERROR", error.message);
    row = ins;
  }

  return json({ ok: true, call: row });
});
