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
const RATE_PER_MINUTE = 30;

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
  if (!threadId || !Array.isArray(messages) || messages.length === 0) {
    return json(400, "বার্তা অনুপস্থিত।");
  }

  // Rate Limiting
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count: recentCount, error: countErr } = await db
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", oneMinuteAgo);
  if (countErr) return json(500, "অনুরোধ যাচাই করা যায়নি।");
  if ((recentCount ?? 0) >= RATE_PER_MINUTE) {
    return json(429, "এক মিনিটে অনেক অনুরোধ পাঠানো হয়েছে। কিছুক্ষণ অপেক্ষা করে আবার চেষ্টা করুন।");
  }

  // Thread Ownership
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

  // Load Fatwa & User Memory
  const [fatwas, userMemories] = await Promise.all([
    findFatwas(lastUserText).catch(() => []),
    loadMemory(userId, 20).catch(() => []),
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
- ব্যবহারকারীর ভাষায় শুদ্ধ ও প্রাতিষ্ঠানিক বাংলায় উত্তর দাও।
- সালাম নিয়ম: ব্যবহারকারী সরাসরি সালাম দিলে "ওয়ালাইকুমুস সালাম" বলবে, অন্যথায় সরাসরি উত্তর দেবে।
- বর্তমান বাংলাদেশ সময়: ${bdTime} (Asia/Dhaka)।
- গণিত, বিজ্ঞান ও জটিল সমস্যায় স্পষ্ট ধাপে ধাপে যুক্তি উপস্থাপন করবে।
- ওয়েবসাইট চাইলে সম্পূর্ণ একক HTML ফাইল (\`\`\`html ব্লকে) প্রদান করবে।
- তুলনামূলক পরিসংখ্যানের ক্ষেত্রে \`\`\`chart কোড ব্লকে JSON অবজেক্ট দেবে (type: bar, line, pie)।
`;

  if (fatwas.length > 0) {
    systemPrompt += fatwaPrompt(fatwas);
  }

  if (userMemories.length > 0) {
    systemPrompt += `\n\n=== ব্যবহারকারীর পূর্ববর্তী তথ্য ও পছন্দসমূহ ===\n${userMemories.map((m) => "- " + m.text).join("\n")}`;
  }

  const history = messages.slice(-MAX_HISTORY);
  const coreMessages = await convertToModelMessages(history);

  const runId = getLovableAiGatewayRunId(request);
  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  const googleApiKey = process.env["GOOGLE_API_KEY"];

  let openaiClient;
  let activeModel = "openai/gpt-6-astra";

  if (googleApiKey) {
    openaiClient = createOpenAI({
      apiKey: googleApiKey,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    });
    activeModel = "gemini-2.5-flash";
  } else if (lovableApiKey) {
    openaiClient = createOpenAI({
      apiKey: lovableApiKey,
      baseURL: "https://ai.gateway.lovable.dev/v1",
      fetch: createLovableAiGatewayRunIdFetch(runId),
    });
    activeModel = "openai/gpt-6-astra";
  } else {
    return json(500, "কোনো এআই এপিআই কী কনফিগার করা নেই।");
  }

  const result = streamText({
    model: openaiClient(activeModel),
    system: systemPrompt,
    messages: coreMessages,
  });

  const response = result.toUIMessageResponse();
  return withLovableAiGatewayRunIdHeader(response, runId);
}
