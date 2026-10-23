import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type SignalRequest = { provider?: string; source?: string; poolIndex?: number };

const CHAT_ENDPOINTS: Record<string, string> = {
  google: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
  deepseek: "https://api.deepseek.com/chat/completions",
};
const DEFAULT_MODELS: Record<string, string> = {
  google: "gemini-3.8-flash",
  groq: "llama-3.3-70b-versatile",
  openrouter: "openrouter/free",
  openai: "gpt-4o-mini",
  deepseek: "deepseek-chat",
};

export const Route = createFileRoute("/api/provider-signal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return Response.json({ ok: false, message: "লগইন প্রয়োজন" }, { status: 401 });
        const pub = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: user, error } = await pub.auth.getUser(token);
        if (error || !user.user) return Response.json({ ok: false, message: "লগইন যাচাই হয়নি" }, { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: admin } = await supabaseAdmin.rpc("has_role", { _user_id: user.user.id, _role: "admin" });
        if (!admin) return Response.json({ ok: false, message: "শুধু অ্যাডমিন" }, { status: 403 });

        const body = await request.json().catch(() => ({})) as SignalRequest;
        const provider = String(body.provider ?? "").toLowerCase();
        const source = String(body.source ?? "");
        if (!CHAT_ENDPOINTS[provider]) return Response.json({ ok: false, message: "এই provider-এর নিরাপদ live signal পরীক্ষা সমর্থিত নয়" });
        const [{ data: keys }, { data: settings }] = await Promise.all([
          supabaseAdmin.from("ai_keys").select("google_key,openai_key,key_pool").eq("id", 1).maybeSingle(),
          supabaseAdmin.from("ai_settings").select("provider,model").eq("id", 1).maybeSingle(),
        ]);
        let key = "";
        let model = DEFAULT_MODELS[provider] ?? "";
        if (source === "google_key" && provider === "google") { key = String(keys?.google_key ?? ""); if (settings?.provider === "google") model = String(settings.model || model); }
        else if (source === "openai_key" && provider === "openai") key = String(keys?.openai_key ?? "");
        else if (source === "provider_main") {
          const pool = Array.isArray(keys?.key_pool) ? keys.key_pool as Array<{ provider?: string; key?: string; active?: boolean; model?: string }> : [];
          const entry = pool.find((item) => item.provider === provider && item.active && item.key?.trim());
          key = String(entry?.key ?? "");
          if (settings?.provider === provider) model = String(settings.model || entry?.model || model);
          else model = String(entry?.model || model);
        } else if (source === "pool" && Number.isInteger(body.poolIndex)) {
          const pool = Array.isArray(keys?.key_pool) ? keys.key_pool as Array<{ provider?: string; key?: string; active?: boolean; model?: string }> : [];
          const entry = pool[body.poolIndex!];
          if (entry?.provider === provider && entry.active) {
            key = String(entry.key ?? "");
            model = String(entry.model || model);
          }
        }
        if (!key.trim()) return Response.json({ ok: false, message: "এই provider/key-এর সক্রিয় সংরক্ষিত API key পাওয়া যায়নি। আগে সেটিংস সংরক্ষণ করুন।" });

        const controller = new AbortController();
        const startedAt = Date.now();
        const timer = setTimeout(() => controller.abort(), 8000);
        try {
          const headers: Record<string, string> = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
          if (provider === "openrouter") {
            headers["HTTP-Referer"] = "https://alahsan-ai.lovable.app";
            headers["X-Title"] = "Al Ahsan AI";
          }
          const response = await fetch(CHAT_ENDPOINTS[provider]!, {
            method: "POST",
            headers,
            signal: controller.signal,
            body: JSON.stringify({ model, messages: [{ role: "user", content: "Reply with OK." }], max_tokens: 4, stream: false }),
          });
          if (!response.ok) {
            const text = (await response.text()).slice(0, 250);
            const safeDetail = response.status === 401 || response.status === 403 ? "API key বা অনুমতি গ্রহণ হয়নি" : response.status === 402 ? "provider-এর billing/balance সমস্যা" : response.status === 429 ? "provider-এর quota/rate limit পূর্ণ" : `provider HTTP ${response.status}`;
            return Response.json({ ok: false, message: safeDetail, status: response.status });
          }
          const elapsedMs = Date.now() - startedAt;
          return Response.json({ ok: true, elapsedMs, message: `সংরক্ষিত ${provider} key থেকে সার্ভার উত্তর পেয়েছে (${model}, ${elapsedMs} ms)` }, { headers: { "Cache-Control": "no-store" } });
        } catch (e) {
          const timedOut = e instanceof Error && e.name === "AbortError";
          return Response.json({ ok: false, message: timedOut ? "৮ সেকেন্ডে provider সাড়া দেয়নি" : "provider-এ সংযোগ করা যায়নি" });
        } finally { clearTimeout(timer); }
      },
    },
  },
});
