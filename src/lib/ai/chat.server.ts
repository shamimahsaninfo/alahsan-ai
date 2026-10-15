import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id.server";

const MODEL = "openai/gpt-6-astra";
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

  let body: { messages?: UIMessage[]; threadId?: string };
  try {
    body = await request.json();
  } catch {
    return json(400, "অবৈধ অনুরোধ।");
  }
  const { messages, threadId } = body;
  if (!threadId || !Array.isArray(messages) || messages.length === 0)
    return json(400, "অবৈধ অনুরোধ।");
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

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return json(500, "AI পরিষেবা কনফিগার করা নেই।");
  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const history = messages.slice(-MAX_HISTORY);
  const result = streamText({
    model: provider.responses(MODEL),
    instructions: INSTRUCTIONS,
    messages: await convertToModelMessages(history),
    abortSignal: request.signal,
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  return withLovableAiGatewayRunIdHeader(
    result.toUIMessageStreamResponse({
      originalMessages: messages,
      sendReasoning: true,
      onError: (err) => {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 429) return "AI পরিষেবা ব্যস্ত, একটু পরে আবার চেষ্টা করুন।";
        if (status === 402) return "AI ক্রেডিট শেষ হয়ে গেছে। অ্যাডমিনকে জানান।";
        if (status === 403) return "এই অনুরোধটি AI পরিষেবা গ্রহণ করেনি।";
        console.error("AI error", err);
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
    }),
    runIdFetch,
  );
}
