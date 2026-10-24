import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type LanguageModel, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id.server";
import { DEFAULT_MODEL_VALUE, findModel, type ModelOption } from "./models";
import { chooseApiKey } from "./keys";

const MAX_HISTORY = 30;
const MAX_TEXT = 8000;
const RATE_PER_MINUTE = 15;

const INSTRUCTIONS = `You are Al Ahsan AI, a helpful, honest assistant built for Al-Ahsan Foundation, Bangladesh.
Reply in the same language the user writes in (Bengali by default when unclear). Use clear, natural Bengali (বাংলা) when replying in Bengali.
You help with studies, math, science, translation, writing, programming and problem solving. Show step-by-step reasoning for math and science.
Use Markdown: headings, lists, tables and fenced code blocks with a language tag. If you are unsure, say so instead of guessing.`;

function json(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textOf(m: UIMessage) {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

/**
 * Builds the language model for the chosen option.
 * Lovable AI uses the Responses API through the Lovable gateway (unchanged behaviour).
 * Groq and Gemini use their OpenAI-compatible Chat Completions endpoints. The key typed in the
 * app is used first; a server secret is only a fallback.
 */
function buildModel(
  option: ModelOption,
  runIdFetch: ReturnType<typeof createLovableAiGatewayRunIdFetch> | undefined,
  userKey: unknown,
): { model: LanguageModel } | { error: string } {
  if (option.provider === "lovable") {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey || !runIdFetch) return { error: "AI পরিষেবা কনফিগার করা নেই।" };
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });
    return { model: provider.responses(option.modelId) };
  }

  const config =
    option.provider === "groq"
      ? { name: "Groq", baseURL: "https://api.groq.com/openai/v1" }
      : { name: "Gemini", baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/" };
  const apiKey = chooseApiKey(option.provider, userKey, process.env);
  if (!apiKey) return { error: `${config.name} এপিআই কি নেই। মেনু → API কি থেকে কি বসান।` };
  const provider = createOpenAI({ baseURL: config.baseURL, apiKey });
  return { model: provider.chat(option.modelId) };
}

export async function handleChat(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return json(401, "অনুগ্রহ করে লগইন করুন।");

  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const db = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        h.set("apikey", key);
        h.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData.user) return json(401, "সেশন শেষ হয়ে গেছে, আবার লগইন করুন।");
  const userId = userData.user.id;

  let body: { messages?: UIMessage[]; threadId?: string; model?: unknown; apiKey?: unknown };
  try {
    body = await request.json();
  } catch {
    return json(400, "অবৈধ অনুরোধ।");
  }
  const { messages, threadId } = body;
  if (!threadId || !Array.isArray(messages) || messages.length === 0)
    return json(400, "অবৈধ অনুরোধ।");

  // Unknown or missing model values fall back to the default instead of failing the chat.
  const option = findModel(body.model) ?? findModel(DEFAULT_MODEL_VALUE)!;

  // Check the model's configuration before anything is saved, so a missing key never leaves a half-finished turn.
  const runIdFetch =
    option.provider === "lovable"
      ? createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request))
      : undefined;
  const built = buildModel(option, runIdFetch, body.apiKey);
  if ("error" in built) return json(option.provider === "lovable" ? 500 : 400, built.error);

  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") return json(400, "অবৈধ অনুরোধ।");
  const lastText = textOf(last).trim();
  if (!lastText) return json(400, "খালি বার্তা পাঠানো যাবে না।");
  if (lastText.length > MAX_TEXT) return json(400, `বার্তা ${MAX_TEXT} অক্ষরের বেশি হতে পারবে না।`);

  const { data: thread } = await db.from("threads").select("id,title").eq("id", threadId).maybeSingle();
  if (!thread) return json(404, "চ্যাট পাওয়া যায়নি।");

  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await db
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("role", "user")
    .gte("created_at", since);
  if ((count ?? 0) >= RATE_PER_MINUTE)
    return json(429, "খুব দ্রুত বার্তা পাঠানো হচ্ছে। এক মিনিট পরে আবার চেষ্টা করুন।");

  const { error: saveErr } = await db.from("messages").upsert(
    { thread_id: threadId, user_id: userId, ui_id: last.id, role: "user", parts: last.parts as never },
    { onConflict: "thread_id,ui_id" },
  );
  if (saveErr) {
    console.error("save user message failed", saveErr.message);
    return json(500, "বার্তা সংরক্ষণ করা যায়নি।");
  }
  const title = thread.title === "নতুন চ্যাট" ? lastText.slice(0, 60) : thread.title;
  await db.from("threads").update({ title, updated_at: new Date().toISOString() }).eq("id", threadId);

  const history = messages.slice(-MAX_HISTORY);
  const result = streamText({
    model: built.model,
    instructions: INSTRUCTIONS,
    messages: await convertToModelMessages(history),
    abortSignal: request.signal,
    ...(option.provider === "lovable"
      ? {
          providerOptions: {
            openai: {
              store: false,
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              include: ["reasoning.encrypted_content"],
            },
          },
        }
      : {}),
  });

  const response = result.toUIMessageStreamResponse({
    originalMessages: messages,
    sendReasoning: true,
    onError: (err) => {
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 429) return "AI পরিষেবা ব্যস্ত, একটু পরে আবার চেষ্টা করুন।";
      if (status === 402) return "AI ক্রেডিট শেষ হয়ে গেছে। অ্যাডমিনকে জানান।";
      if (status === 403) return "এই অনুরোধটি AI পরিষেবা গ্রহণ করেনি।";
      if (status === 401 && option.provider !== "lovable")
        return "এপিআই কি সঠিক নয় বা মেয়াদ শেষ। মেনু → API কি থেকে কি আবার বসান।";
      // Log only the provider and status, never the request, so a user's key cannot end up in the logs.
      console.error("AI error", option.provider, status ?? "no-status");
      return "AI থেকে উত্তর আনতে সমস্যা হয়েছে। আবার চেষ্টা করুন।";
    },
    onFinish: async ({ responseMessage, isAborted }) => {
      if (!responseMessage.parts.length) return;
      const { error } = await db.from("messages").upsert(
        {
          thread_id: threadId,
          user_id: userId,
          ui_id: responseMessage.id,
          role: "assistant",
          parts: responseMessage.parts as never,
        },
        { onConflict: "thread_id,ui_id" },
      );
      if (error) console.error("save assistant message failed", error.message, { isAborted });
    },
  });
  return runIdFetch ? withLovableAiGatewayRunIdHeader(response, runIdFetch) : response;
}
