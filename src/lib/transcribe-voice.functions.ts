import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GoogleGenAI } from "@google/genai";
import { voiceError } from "./service-errors";

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["audio/webm", "audio/mp4", "audio/ogg", "audio/wav", "audio/mpeg", "audio/aac"]);
const BENGALI_CLEANUP_INSTRUCTIONS = `You are a faithful Bengali speech transcription editor. Transcribe only what the speaker said. Return the corrected transcript in natural, standard Bangladeshi Bengali. Fix clear speech-recognition errors, spelling, punctuation and obvious filler/repetition while preserving the speaker's intended meaning, names, numbers, English words, questions, negation, and every substantive detail. Do not answer, summarize, translate, add facts, or guess words that cannot be heard. If a span is uncertain, retain the closest audible wording. Output only the transcript.

বাংলা নির্দেশনা: বক্তার কথাটুকুই লিখুন। প্রমিত, স্বাভাবিক বাংলাদেশি বাংলায় সুস্পষ্ট ভুল বানান ও যতিচিহ্ন ঠিক করুন; অর্থ, নাম, সংখ্যা, ইংরেজি শব্দ, প্রশ্ন, না-বোধকতা ও সব তথ্য অক্ষুণ্ণ রাখুন। কোনো উত্তর, সারাংশ, অনুবাদ বা নতুন তথ্য যোগ করবেন না। অস্পষ্ট শব্দ অনুমান করে বদলাবেন না; যতটা শোনা যায় ততটাই রাখুন। শুধু সংশোধিত ট্রান্সক্রিপ্ট দিন।`;

function decodeBase64(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export const transcribeVoiceInput = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: { audioBase64: string; mimeType: string }) => {
    if (!value || typeof value.audioBase64 !== "string" || typeof value.mimeType !== "string") {
      throw new Error("রেকর্ড করা অডিও পাওয়া যায়নি। আবার বলুন।");
    }
    const mimeType = value.mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!ALLOWED_MIME_TYPES.has(mimeType)) throw new Error("এই অডিও ফরম্যাট সমর্থিত নয়।");
    if (value.audioBase64.length > Math.ceil(MAX_AUDIO_BYTES * 4 / 3) + 8) {
      throw new Error("রেকর্ডটি বেশি দীর্ঘ। ছোট করে আবার বলুন।");
    }
    if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(value.audioBase64)) throw new Error("অডিও ডেটা সঠিক নয়। আবার বলুন।");
    let bytes: Uint8Array;
    try { bytes = decodeBase64(value.audioBase64); } catch { throw new Error("অডিও ডেটা সঠিক নয়। আবার বলুন।"); }
    if (!bytes.length || bytes.length > MAX_AUDIO_BYTES) throw new Error("রেকর্ডটি খালি বা বেশি বড়। ছোট করে আবার বলুন।");
    return { bytes, mimeType };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (roleError) throw new Error("প্রবেশাধিকার যাচাই করা যায়নি। আবার লগইন করুন।");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: keys }, { data: settings }, { count: hourly }, { count: daily }] = await Promise.all([
      supabaseAdmin.from("ai_keys").select("google_key").eq("id", 1).maybeSingle(),
      supabaseAdmin.from("ai_settings").select("chat_enabled,hourly_limit,daily_limit").eq("id", 1).maybeSingle(),
      supabase.from("chat_usage").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", new Date(Date.now() - 3600_000).toISOString()),
      supabase.from("chat_usage").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", new Date(Date.now() - 86400_000).toISOString()),
    ]);
    if (!settings?.chat_enabled) throw new Error("চ্যাট ও ভয়েস সেবা আপাতত বন্ধ আছে।");
    if (!isAdmin && ((hourly ?? 0) >= settings.hourly_limit || (daily ?? 0) >= settings.daily_limit)) {
      throw new Error("আপনার অ্যাকাউন্টের ব্যবহারের সীমা শেষ হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।");
    }
    const key = keys?.google_key?.trim();
    if (!key) throw new Error("অ্যাডমিন প্যানেলে Google Gemini API Key সংরক্ষণ করুন।");
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const result = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [{
          role: "user",
          parts: [
            { text: BENGALI_CLEANUP_INSTRUCTIONS },
            { inlineData: { mimeType: data.mimeType, data: btoa(Array.from(data.bytes, byte => String.fromCharCode(byte)).join("")) } },
          ],
        }],
        config: { temperature: 0 },
      });
      const transcript = result.text?.trim();
      if (!transcript) throw new Error("অডিও থেকে কোনো স্পষ্ট কথা শনাক্ত হয়নি।");
      const { error: usageError } = await supabaseAdmin.from("chat_usage").insert({ user_id: userId });
      if (usageError) throw new Error("ভয়েস ব্যবহারের হিসাব সংরক্ষণ করা যায়নি।");
      return { transcript };
    } catch (error) {
      if (error instanceof Error && error.message === "অডিও থেকে কোনো স্পষ্ট কথা শনাক্ত হয়নি।") throw error;
      const status = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : 503;
      throw new Error(voiceError({ httpStatus: status, message: error instanceof Error ? error.message : "" }));
    }
  });
