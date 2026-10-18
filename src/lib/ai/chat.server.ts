import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id.server";
import { findFatwas, fatwaPrompt } from "@/lib/fatwa.server";
import { loadMemory } from "@/lib/memory.server";

const MAX_HISTORY = 30;
const MAX_TEXT = 12000;

function json(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textOf(m: UIMessage) {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

// লাইভ ওয়েব অনুসন্ধান ও ইউআরএল রিডার হেল্পার
async function readUrlContent(urlStr: string): Promise<string> {
  try {
    const url = new URL(urlStr);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    // SSRF ফিল্টার: লোকালহোস্ট ও প্রাইভেট আইপি ব্লক
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1]))/i.test(url.hostname)) return "";

    const res = await fetch(urlStr, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AlAhsanAI/2.0)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    // ট্যাগ ও স্ক্রিপ্ট পরিষ্কার করা
    const clean = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return clean.slice(0, 3500);
  } catch {
    return "";
  }
}

async function quickWebSearch(query: string): Promise<string> {
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(`https://news.google.com/rss/search?q=${encoded}&hl=bn&gl=BD&ceid=BD:bn`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return "";
    const xml = await res.text();
    const titles = Array.from(xml.matchAll(/<title>(.*?)<\/title>/g))
      .slice(1, 4)
      .map((m) => "- " + (m[1] ?? "").replace(/<!\[CDATA\[|\]\]>/g, "").trim());
    return titles.length ? `সংগৃহীত লাইভ তথ্য:\n${titles.join("\n")}` : "";
  } catch {
    return "";
  }
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
  if (!threadId || !Array.isArray(messages) || messages.length === 0) {
    return json(400, "বার্তা অনুপস্থিত।");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // অ্যাডমিন সেটিংস ও রেট লিমিট যাচাই
  const [{ data: settings }, { data: isAdmin }] = await Promise.all([
    supabaseAdmin.from("ai_settings").select("*").eq("id", 1).maybeSingle(),
    supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" }),
  ]);

  if (settings && settings.chat_enabled === false && !isAdmin) {
    return json(503, "চ্যাট সিস্টেম বর্তমানে রক্ষণাবেক্ষণের জন্য সাময়িকভাবে বন্ধ আছে।");
  }

  if (!isAdmin) {
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const dayAgo = new Date(Date.now() - 86400_000).toISOString();
    const [{ count: hCount }, { count: dCount }] = await Promise.all([
      supabaseAdmin.from("chat_usage").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", hourAgo),
      supabaseAdmin.from("chat_usage").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", dayAgo),
    ]);

    const maxHourly = settings?.hourly_limit ?? 40;
    const maxDaily = settings?.daily_limit ?? 200;

    if ((hCount ?? 0) >= maxHourly) {
      return json(429, `আপনি এক ঘণ্টার সীমা (${maxHourly}টি প্রশ্ন) অতিক্রম করেছেন। কিছুক্ষণ পর চেষ্টা করুন।`);
    }
    if ((dCount ?? 0) >= maxDaily) {
      return json(429, `আপনার আজকের দৈনিক প্রশ্ন সীমা (${maxDaily}টি) শেষ হয়েছে। আগামীকাল আবার চেষ্টা করুন।`);
    }
  }

  // ব্যবহার হিসেব সংরক্ষণ
  await supabaseAdmin.from("chat_usage").insert({ user_id: userId, kind: "chat", ok: true });

  // Thread Ownership যাচাই
  const { data: threadData, error: threadErr } = await db
    .from("threads")
    .select("id,user_id")
    .eq("id", threadId)
    .maybeSingle();
  if (threadErr || !threadData) return json(404, "চ্যাট পাওয়া যায়নি।");
  if (threadData.user_id !== userId) return json(403, "এই চ্যাটে প্রবেশের অনুমতি নেই।");

  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const lastUserText = lastUserMsg ? textOf(lastUserMsg) : "";
  if (!lastUserText.trim()) return json(400, "বার্তা খালি হতে পারে না।");
  if (lastUserText.length > MAX_TEXT) return json(400, "বার্তা অনেক দীর্ঘ। অনুগ্রহ করে ছোট করে লিখুন।");

  // ফতোয়া, মেমোরি ও রিয়েলটাইম ওয়েব তথ্য রিডার
  const urlMatch = lastUserText.match(/https?:\/\/[^\s]+/i);
  const needsNews = /(আজকের|বর্তমান|সাম্প্রতিক|খবর|আজকে|তাজা খবর)/i.test(lastUserText);

  const [fatwas, userMemories, urlContent, newsContent] = await Promise.all([
    findFatwas(lastUserText).catch(() => []),
    loadMemory(userId, 20).catch(() => []),
    urlMatch && settings?.url_reader !== false ? readUrlContent(urlMatch[0]) : Promise.resolve(""),
    needsNews && settings?.web_search !== false ? quickWebSearch(lastUserText) : Promise.resolve(""),
  ]);

  const now = new Date();
  const bdTime = new Intl.DateTimeFormat("bn-BD", {
    timeZone: "Asia/Dhaka",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(now);

  let systemPrompt = `তুমি "আল আহসান এআই" (Al Ahsan AI) — আল-আহসান ফাউন্ডেশন বাংলাদেশ কর্তৃক তৈরি একটি উন্নত, সত্যবাদী ও বিনয়ী এআই সহকারী।

## তোমার ব্যক্তিত্ব ও কঠোর নিয়ম
- শুদ্ধ, মার্জিত ও প্রাতিষ্ঠানিক বাংলায় উত্তর দাও।
- সালাম নিয়ম: ব্যবহারকারী সরাসরি সালাম দিলে তবেই "ওয়ালাইকুমুস সালাম" বলবে, নতুবা সরাসরি উত্তর দেবে।
- বর্তমান বাংলাদেশ সময়: ${bdTime} (Asia/Dhaka)।
- গণিত ও বিজ্ঞানে ধাপে ধাপে সমাধান উপস্থাপন করো।
- ওয়েবসাইট তৈরির অনুরোধে সম্পূর্ণ একক HTML ফাইল (\`\`\`html ব্লকে) দাও, যার সাথে ইন্টারঅ্যাক্টিভ JS ও Tailwind CSS থাকবে।
- পরিসংখ্যান বা ডেটা উপস্থাপনে \`\`\`chart কোড ব্লকে JSON অবজেক্ট দেবে (type: bar, line, pie)।
`;

  if (settings?.admin_note?.trim()) {
    systemPrompt += `\n\n=== অ্যাডমিন বিশেষ নির্দেশনা ===\n${settings.admin_note.trim()}`;
  }

  if (urlContent) {
    systemPrompt += `\n\n=== ওয়েব লিংকের তথ্য ===\n${urlContent}`;
  }

  if (newsContent) {
    systemPrompt += `\n\n=== সাম্প্রতিক অনুসন্ধান তথ্য ===\n${newsContent}`;
  }

  if (fatwas.length > 0) {
    systemPrompt += fatwaPrompt(fatwas);
  }

  if (userMemories.length > 0) {
    systemPrompt += `\n\n=== ব্যবহারকারীর তথ্য ও পছন্দসমূহ ===\n${userMemories.map((m) => "- " + m.text).join("\n")}`;
  }

  const history = messages.slice(-MAX_HISTORY);
  const coreMessages = await convertToModelMessages(history);

  const runId = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  const googleApiKey = process.env["GOOGLE_API_KEY"];
  const openaiApiKey = process.env["OPENAI_API_KEY"];

  let openaiClient;
  let activeModel = "openai/gpt-6-astra";

  if (googleApiKey) {
    openaiClient = createOpenAI({
      apiKey: googleApiKey,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    });
    activeModel = "gemini-2.5-flash";
  } else if (openaiApiKey) {
    openaiClient = createOpenAI({
      apiKey: openaiApiKey,
      baseURL: "https://api.openai.com/v1",
    });
    activeModel = "gpt-4o";
  } else if (lovableApiKey) {
    openaiClient = createOpenAI({
      apiKey: lovableApiKey,
      baseURL: "https://ai.gateway.lovable.dev/v1",
      fetch: runId.fetch,
    });
    activeModel = "openai/gpt-6-astra";
  } else {
    return json(500, "কোনো এআই এপিআই কী সেট করা নেই। অ্যাডমিন প্যানেলে কী বসান।");
  }

  const result = streamText({
    model: openaiClient(activeModel),
    system: systemPrompt,
    messages: coreMessages,
  });

  const response = result.toUIMessageStreamResponse();
  return withLovableAiGatewayRunIdHeader(response, runId);
}
