import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GoogleGenAI } from "@google/genai";
import { voiceError } from "./service-errors";

export const synthesizeGeminiSpeech = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: { text: string }) => {
    const text = typeof value?.text === "string" ? value.text.trim() : "";
    if (!text || text.length > 1200) throw new Error("ভয়েসের জন্য লেখাটি খালি বা বেশি বড়।");
    return { text };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (roleError) throw new Error("প্রবেশাধিকার যাচাই করা যায়নি। আবার লগইন করুন।");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: keys, error: keyError }, { data: settings, error: settingsError }, { count: hourly }, { count: daily }] = await Promise.all([
      supabaseAdmin.from("ai_keys").select("google_key").eq("id", 1).maybeSingle(),
      supabaseAdmin.from("ai_settings").select("chat_enabled,hourly_limit,daily_limit").eq("id", 1).maybeSingle(),
      supabase.from("chat_usage").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", new Date(Date.now() - 3600_000).toISOString()),
      supabase.from("chat_usage").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", new Date(Date.now() - 86400_000).toISOString()),
    ]);
    if (keyError || settingsError) throw new Error("ভয়েস সেটিংস যাচাই করা যায়নি।");
    if (!settings?.chat_enabled) throw new Error("চ্যাট ও ভয়েস সেবা আপাতত বন্ধ আছে।");
    if (!isAdmin && ((hourly ?? 0) >= settings.hourly_limit || (daily ?? 0) >= settings.daily_limit)) throw new Error("আপনার অ্যাকাউন্টের ব্যবহারের সীমা শেষ হয়েছে।");
    const key = keys?.google_key?.trim();
    if (!key) throw new Error("অ্যাডমিন প্যানেলে Google Gemini API Key সংরক্ষণ করুন।");
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const interaction = await ai.interactions.create({
        model: "gemini-3.8-flash-tts",
        input: [
          {
            type: "text",
            text: data.text,
            annotations: [
              {
                type: "speech_metadata",
                style: "conversational, warm, natural and polite Bangladeshi Bengali male speaker with standard pronunciation and clear articulation",
              },
            ],
          },
        ],
        response_format: { type: "audio" },
        generation_config: { speech_config: [{ voice: "Fenrir" }] },
      });
      const audio = interaction.output_audio;
      if (!audio?.data || audio.mime_type !== "audio/wav") throw new Error("Gemini থেকে অডিও পাওয়া যায়নি।");
      await supabaseAdmin.from("chat_usage").insert({ user_id: userId });
      return { audioBase64: audio.data, mimeType: audio.mime_type };
    } catch (error) {
      if (error instanceof Error && error.message.includes("Gemini থেকে অডিও")) throw error;
      const status = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : 503;
      throw new Error(voiceError({ httpStatus: status, message: error instanceof Error ? error.message : "" }));
    }
  });
