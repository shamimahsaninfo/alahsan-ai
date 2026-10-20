import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { DEFAULT_MODELS, LOVABLE_MODELS, type Provider } from "@/lib/models";
import { serviceError } from "@/lib/service-errors";
import { clockContext, directSessionFact, evidencePolicy, parseNewsRss, requiresLiveSearch } from "@/lib/chat-grounding";

const Body = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(50000),
        image: z
          .string()
          .regex(/^data:image\/(png|jpe?g|webp|gif);base64,/)
          .max(5_000_000)
          .optional(),
        images: z
          .array(z.string().regex(/^data:image\/(png|jpe?g|webp|gif);base64,/).max(3_000_000))
          .max(5)
          .optional(),
      })
    )
    .min(1)
    .max(60),
  model: z.string().max(80).optional(),
});

const PERSONA = `## তোমার ব্যক্তিত্ব ও ইসলামিক শিষ্টাচার (সর্বোচ্চ অগ্রাধিকার)
- তুমি "আল আহসান এআই" (Al Ahsan AI) — আল আহসান ফাউন্ডেশন বাংলাদেশ কর্তৃক তৈরি একটি বিশ্বমানের, অত্যন্ত নির্ভরযোগ্য, ন্যায়পরায়ণ ও জনকল্যাণমুখী বাংলা কৃত্রিম বুদ্ধিমত্তা।
- তোমার মূল লক্ষ্য: প্রতিটি মানুষের নিঃস্বার্থ উপকার করা, নির্ভুল জ্ঞান পৌঁছে দেওয়া, শিক্ষার্থীদের শেখানো, কোডিং ও আধুনিক প্রযুক্তির সমাধান দেওয়া এবং ইসলামের বিশুদ্ধ বিধান বিশ্বস্ততার সাথে জানানো।
- সালামের কঠোর নিয়ম: ব্যবহারকারীর সর্বশেষ বার্তায় সরাসরি সালাম (যেমন "আসসালামু আলাইকুম", "সালাম") থাকলে কেবল তখনই উত্তরের শুরুতে "ওয়ালাইকুমুস সালাম" বলবে। অন্য সব ক্ষেত্রে কখনোই নিজে থেকে সালাম লিখবে না — সরাসরি মূল বিষয়ে স্বাভাবিক উত্তর দেবে।
- বিনয় ও আন্তরিকতা: সর্বদা শালীন, প্রাতিষ্ঠানিক ও শ্রদ্ধাশীল বাংলা ভাষা ("আপনি" সম্বোধন) ব্যবহার করবে। কোনো তোষামোদ, কৃত্রিম অহংকার বা অপ্রয়োজনীয় ভূমিকা বর্জন করবে।
- প্রথম বাক্য থেকেই আসল উত্তর: কোনো ভূমিকা বা অহেতুক প্রশংসা ("চমৎকার প্রশ্ন") ছাড়া সরাসরি সমাধান শুরু করবে।
- সত্য ও আমানতদারিতা: কোনো তথ্য বা সূত্র নিশ্চিত না হলে অনুমান করে বলবে না। স্পষ্ট জানিয়ে দেবে যে বিষয়টি যাচাই করা সম্ভব হয়নি। কুরআন ও সহিহ হাদিসের ক্ষেত্রে কাল্পনিক কোনো রেফারেন্স বা দুর্বল হাদিসকে সহিহ বলে প্রচার করা কঠোরভাবে নিষিদ্ধ।
- উত্তরের কাঠামো: গুরুত্বপূর্ণ পয়েন্টগুলোর জন্য "### " দিয়ে ছোট, স্পষ্ট ও পরিচ্ছন্ন হেডলাইন ব্যবহার করবে। কোনো সস্তা ইমোজি বা অনর্থক সাজসজ্জার চিহ্ন দেবে না।`;

const BASE_PROMPT = `## সাধারণ জ্ঞান, বিজ্ঞান, গবেষণা ও সমস্যা সমাধান
- বিজ্ঞান, গণিত, চিকিৎসা, আইন, প্রযুক্তি, প্রোগ্রামিং, সাহিত্য ও সাধারণ জ্ঞানে গভীর বিশ্লেষণাত্মক উত্তর দাও।
- গণিত ও বিজ্ঞানের ক্ষেত্রে কেবল উত্তর না দিয়ে ধাপে ধাপে সূত্র, প্রমাণ ও সমাধান স্পষ্ট করে বুঝিয়ে দাও, যেন একজন শিক্ষার্থী পরিপূর্ণভাবে শিখতে পারে।
- চিকিৎসা ও আইনি বিষয়ে প্রমাণভিত্তিক ও সতর্ক তথ্য দেবে এবং প্রয়োজনে সংশ্লিষ্ট বিশেষজ্ঞের পরামর্শ নেওয়ার নির্দেশ দেবে।

## ওয়েবসাইট ও সফটওয়্যার তৈরির প্রোটোকল (পূর্ণাঙ্গ ও প্রোডাকশন-রেডি)
ব্যবহারকারী ওয়েবসাইট, সফটওয়্যার বা কোড চাইলে:
- একক-ফাইলের পূর্ণাঙ্গ HTML: \`<!DOCTYPE html>\` থেকে \`</html>\` পর্যন্ত একটি পূর্ণ \`\`\`html ব্লকে সম্পূর্ণ কোড দেবে। কোনো "// বাকি কোড এখানে" বা অসম্পূর্ণ ফাংশন কঠোরভাবে নিষিদ্ধ।
- প্রযুক্তি স্ট্যাক: হেডারে Tailwind CSS CDN (<script src="https://cdn.tailwindcss.com"></script>), Google Fonts (Hind Siliguri ও Inter) এবং চমৎকার কালার প্যালেট ব্যবহার করবে।
- কার্যকারিতা: সমস্ত মেনু, বাটন, ফর্ম, কার্ট এবং মডাল জাভাস্ক্রিপ্টে সত্যিই কাজ করবে। ব্রাউজার রিলোড হলেও যাতে ডেটা টিকে থাকে, সেজন্য \`localStorage\` ব্যবহার করবে।
- কোডের শেষে শুধু লিখবে: "নিচে লাইভ লিংক দেওয়া হলো।" সিস্টেম স্বয়ংক্রিয়ভাবে এর জন্য স্থায়ী ওয়েব লিংক তৈরি করে দেয়।`;

const INTEGRITY = `\n\n## সততা ও দলীল প্রোটোকল
- ফতোয়া ও শরীয়তের মাসআলায় ফাউন্ডেশনের অনুমোদিত ফতোয়া ভান্ডারের তথ্য সর্বোচ্চ অগ্রাধিকারে রাখবে। দলীল নিশ্চিত না হলে স্পষ্ট বলবে মূল কিতাব থেকে যাচাই করে নেওয়া আবশ্যক।
- বাংলাদেশের প্রেক্ষাপট (টাকা ৳, স্থানীয় আইন, সংস্কৃতি, বিকাশ/নগদ) প্রাধান্য পাবে।
- দীর্ঘ উত্তর ও কোডের ক্ষেত্রে কোনো অংশ কাটছাঁট করবে না, প্রতিটি ব্লক নিখুঁতভাবে শেষ করবে।`;

// সার্ভার ইন-মেমোরি ক্যাশ (৬০ সেকেন্ডের জন্য সেটিংস ও কী ক্যাশ রাখা)
let cachedSettings: { data: any; time: number } | null = null;
let cachedKeys: { data: any; time: number } | null = null;

async function getCachedSettingsAndKeys(supabaseAdmin: any) {
  const now = Date.now();
  const needSettings = !cachedSettings || now - cachedSettings.time > 60_000;
  const needKeys = !cachedKeys || now - cachedKeys.time > 60_000;

  const [sRes, kRes] = await Promise.all([
    needSettings ? supabaseAdmin.from("ai_settings").select("*").eq("id", 1).maybeSingle() : Promise.resolve({ data: cachedSettings!.data }),
    needKeys ? supabaseAdmin.from("ai_keys").select("*").eq("id", 1).maybeSingle() : Promise.resolve({ data: cachedKeys!.data }),
  ]);

  if (needSettings && sRes.data) cachedSettings = { data: sRes.data, time: now };
  if (needKeys && kRes.data) cachedKeys = { data: kRes.data, time: now };

  return { s: sRes.data ?? cachedSettings?.data, keys: kRes.data ?? cachedKeys?.data };
}

function isIslamicQuery(text: string): boolean {
  return /(নামাজ|নামায|রোজা|রোযা|হজ|হজ্জ|যাকাত|ফতোয়া|ফতোয়া|মাসআলা|মাসয়ালা|হাদিস|হাদীস|কুরআন|কোরআন|তাফসির|তাফসীর|হালাল|হারাম|সুদ|মুয়ামালাত|নিকাহ|তালাক|পর্দা|তাহাজ্জুদ|ওজু|অজু|গোসল|তায়াম্মুম|কিবলা|শরিয়ত|শরীয়ত|সুন্নাত|ওয়াজিব|ওয়াজিব|ফরজ|নফল|সাহাবি|নবী|রাসূল)/i.test(text);
}

function cleanSearchQuery(text: string): string {
  let q = text
    .replace(/^\[নির্দেশ:[\s\S]*?\]\s*/i, "")
    .replace(/=== সংযুক্ত ফাইল:[\s\S]*$/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .trim();
  q = q.replace(/^(?:ভাই|দয়া করে|দয়া করে|অনুগ্রহ করে|বলুন তো|জানান তো|আমাকে|একটু|আমি জানতে চাই)\s+/gi, "");
  q = q.replace(/\s+(?:বলুন|জানান|দাও|কী|কি|কেন|কীভাবে|কিভাবে|সম্পর্কে বলুন|সম্পর্কে জানতে চাই)[?।!]*$/gi, "");
  return q.trim() || text.slice(0, 120);
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async (ctx) => {
        try {
          return await handleChat(ctx.request);
        } catch (e) {
          console.error("Central chat orchestrator failed:", e);
          return new Response("উত্তর তৈরি করতে সাময়িক বিঘ্ন ঘটেছে। একটু পরে আবার চেষ্টা করুন।", { status: 503 });
        }
      },
    },
  },
});

async function handleChat(request: Request): Promise<Response> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return new Response("অননুমোদিত প্রবেশ। অনুগ্রহ করে লগইন করুন।", { status: 401 });

  const pub = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: u, error: ue } = await pub.auth.getUser(token);
  if (ue || !u.user) return new Response("অননুমোদিত প্রবেশ। অনুগ্রহ করে লগইন করুন।", { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response("ভুল বা ত্রুটিপূর্ণ অনুরোধ পাঠানো হয়েছে।", { status: 400 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const uid = u.user.id;
  const lastUserMsg = String(parsed.data.messages[parsed.data.messages.length - 1]?.content ?? "");
  const userCleanText = cleanSearchQuery(lastUserMsg);

  // ১. সমান্তরাল প্রি-ফেচিং পাইপলাইন (Parallel Pre-fetching for Maximum Speed)
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86400_000).toISOString();

  const [settingsAndKeys, roleData, hourlyCount, dailyCount] = await Promise.all([
    getCachedSettingsAndKeys(supabaseAdmin),
    supabaseAdmin.rpc("has_role", { _user_id: uid, _role: "admin" }),
    supabaseAdmin.from("chat_usage").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", hourAgo),
    supabaseAdmin.from("chat_usage").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", dayAgo),
  ]);

  const { s, keys } = settingsAndKeys;
  const isAdmin = Boolean(roleData.data);

  if (s && s.chat_enabled === false && !isAdmin) {
    return new Response("জনকল্যাণমূলক এই এআই সেবাটি এখন রক্ষণাবেক্ষণের জন্য সাময়িক স্থগিত আছে। কিছুক্ষণ পর আবার চেষ্টা করুন।", { status: 503 });
  }

  // ফেয়ার ইউসেজ লিমিটেশন (Fair Usage Policy)
  if (!isAdmin) {
    const hLimit = s?.hourly_limit ?? 35;
    const dLimit = s?.daily_limit ?? 200;
    if ((hourlyCount.count ?? 0) >= hLimit) {
      return new Response(`সার্ভারের সমতা রক্ষায় প্রতি ঘণ্টায় সর্বোচ্চ ${hLimit}টি প্রশ্ন করার সীমা নির্ধারিত। কিছুক্ষণ পর আবার চেষ্টা করুন।`, { status: 429 });
    }
    if ((dailyCount.count ?? 0) >= dLimit) {
      return new Response(`আজকের জন্য আপনার নির্ধারিত সেবা সীমা (${dLimit}টি প্রশ্ন) সম্পন্ন হয়েছে। ইনশাআল্লাহ আগামীকাল আবার ব্যবহার করতে পারবেন।`, { status: 429 });
    }
  }

  // ব্যবহার হিসেব রেকর্ড (Non-blocking)
  void supabaseAdmin.from("chat_usage").insert({ user_id: uid }).then(() => {});

  // ২. মেমোরি, ফতোয়া ভান্ডার ও লাইভ সার্চ একই সাথে অনুসন্ধান (Parallel Grounding)
  const isQuick = lastUserMsg.length < 500 && !/কোড|code|প্রোগ্রাম|ফতোয়া|মাসআলা|অংক|গণিত|ওয়েবসাইট|website/i.test(lastUserMsg);

  const memP = (async () => {
    try {
      const mem = await import("@/lib/memory.server");
      const [items, rec] = await Promise.all([
        mem.loadMemory(uid, 50),
        isQuick
          ? Promise.resolve({ data: null })
          : supabaseAdmin.from("messages").select("content,created_at").eq("user_id", uid).eq("role", "user").order("created_at", { ascending: false }).limit(10),
      ]);
      return { items, recent: rec.data };
    } catch {
      return { items: [] as { text: string }[], recent: null };
    }
  })();

  // ফতোয়া ভান্ডার অনুসন্ধান (RAG Integration)
  const fatwaP = isIslamicQuery(lastUserMsg)
    ? (async () => {
        try {
          const { findFatwas, fatwaPrompt } = await import("@/lib/fatwa.server");
          const matched = await findFatwas(userCleanText);
          return matched.length ? fatwaPrompt(matched) : "";
        } catch {
          return "";
        }
      })()
    : Promise.resolve("");

  // লাইভ ওয়েব অনুসন্ধান (Strict 2-second timeout)
  const searchP = requiresLiveSearch(userCleanText)
    ? Promise.race([
        webSearch(userCleanText).catch(() => ""),
        new Promise<string>((resolve) => setTimeout(() => resolve(""), 2000)),
      ])
    : Promise.resolve("");

  // লিংক পড়া (URL Reader)
  const linkedPagesP = s?.url_reader !== false && /https?:\/\//.test(lastUserMsg)
    ? readUrls(lastUserMsg)
    : Promise.resolve("");

  // তাৎক্ষণিক উত্তর বাইপাস (Zero-Latency Direct Facts: ঘড়ি ও মডেল পরিচিতি)
  const modelName = s?.model || "gemini-3.8-flash";
  const instantFact = directSessionFact(lastUserMsg, modelName);
  if (instantFact) {
    return stageStream([], async () => instantFact);
  }

  // ৩. মডেল নির্বাচন ও প্রোভাইডার কনফিগারেশন
  const provider = (s?.provider ?? "google") as Provider;
  let model = parsed.data.model && LOVABLE_MODELS.some((m) => m.id === parsed.data.model)
    ? parsed.data.model
    : (isQuick ? "gemini-3.5-flash-lite" : modelName);

  let url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
  let key = keys?.google_key?.trim() || process.env["GOOGLE_API_KEY"];

  if (provider === "openai") {
    url = "https://api.openai.com/v1/chat/completions";
    key = keys?.openai_key?.trim() || process.env["OPENAI_API_KEY"];
  } else if (provider === "lovable" || (!key && process.env["LOVABLE_API_KEY"])) {
    url = "https://ai.gateway.lovable.dev/v1/chat/completions";
    key = process.env["LOVABLE_API_KEY"];
    model = model.includes("/") ? model : "openai/gpt-6-astra";
  }

  if (!key) {
    return new Response("এআই ইঞ্জিন কনফিগারেশনে এপিআই কী অনুপস্থিত। অ্যাডমিন প্যানেলে কী সংরক্ষণ করুন।", { status: 503 });
  }

  // ৪. প্রম্পট অ্যাসেম্বলি
  let system = PERSONA + "\n\n" + BASE_PROMPT;
  if (s?.system_prompt?.trim()) {
    system += `\n\n=== প্রতিষ্ঠান নির্দেশিকা ===\n${s.system_prompt.trim()}`;
  }
  if (s?.admin_note?.trim()) {
    system += `\n\n=== অ্যাডমিনের সরাসরি নির্দেশনা (বাধ্যতামূলক) ===\n${s.admin_note.trim()}`;
  }

  system += `\n\n=== বর্তমান সময় ও তারিখ ===\n${clockContext()}`;

  // ফতোয়া ভান্ডারের দলীল যুক্ত করা
  const fatwaText = await fatwaP;
  if (fatwaText) {
    system += fatwaText;
  }

  // মেমোরি ও সাম্প্রতিক আলোচনা যুক্ত করা
  const { items: memItems, recent: recentMsgs } = await memP;
  if (memItems.length) {
    system += `\n\n=== ব্যবহারকারীর সংরক্ষিত তথ্য ও রুচি ===\n${memItems.map((m) => "- " + m.text).join("\n")}`;
  }
  if (recentMsgs?.length) {
    system += `\n\n=== পূর্ববর্তী আলোচনার ধারাবাহিকতা ===\n${[...recentMsgs].reverse().map((r) => "- " + String(r.content).slice(0, 180)).join("\n")}`;
  }

  // লাইভ সার্চের ফলাফল যুক্ত করা
  const searchResults = await searchP;
  const stages: string[] = ["think"];
  if (searchResults) {
    stages.push("search", "verify");
    system += `\n\n=== সর্বশেষ ইন্টারনেট অনুসন্ধানের তথ্য ===\n${searchResults}\n\nনির্দেশ: এই তথ্য ও তোমার বিশুদ্ধ জ্ঞানভাণ্ডারের সমন্বয়ে উত্তর দাও।`;
  }

  if (/ওয়েবসাইট|website|অ্যাপ|app|landing|html|কোড|code/i.test(lastUserMsg)) {
    stages.push("code");
  }

  // লিংক পড়া ফলাফল যুক্ত করা
  const webContent = await linkedPagesP;
  const textMsgs = parsed.data.messages.map((m) => ({ role: m.role, content: m.content }));
  if (webContent && textMsgs.length > 0) {
    const last = textMsgs[textMsgs.length - 1];
    if (last) {
      textMsgs[textMsgs.length - 1] = { role: last.role, content: `${last.content}\n\n=== সংযুক্ত ওয়েবপেজের তথ্য ===\n${webContent}` };
    }
  }

  // মাল্টি-ইমেজ অ্যাটাচমেন্ট (সর্বোচ্চ ৫টি ছবি)
  const imgsOf = (i: number) => {
    const m = parsed.data.messages[i];
    return [...(m?.images ?? []), ...(m?.image ? [m.image] : [])].slice(0, 5);
  };

  const msgs: { role: string; content: unknown }[] = textMsgs.map((m, i) => {
    const imgs = imgsOf(i);
    if (m.role !== "user" || !imgs.length) return m;
    return {
      role: m.role,
      content: [
        { type: "text", text: m.content || "এই ছবিগুলো বিশ্লেষণ করে উত্তর দিন।" },
        ...imgs.map((url) => ({ type: "image_url", image_url: { url } })),
      ],
    };
  });

  if (parsed.data.messages.some((_, i) => imgsOf(i).length)) {
    system += "\n\nব্যবহারকারী ছবি সংযুক্ত করেছেন। ছবিগুলো নিখুঁতভাবে দেখে বিস্তারিত বিশ্লেষণ ও ওসিয়ার (OCR) পাঠ প্রস্তুত করো।";
  }

  system += INTEGRITY;

  // ছবি তৈরির অনুরোধ শনাক্তকরণ
  if (!imgsOf(parsed.data.messages.length - 1).length && wantsImage(lastUserMsg) && process.env["LOVABLE_API_KEY"]) {
    return stageStream(["think", "image"], async () => {
      const img = await generateImage(lastUserMsg);
      return img
        ? `আপনার কাঙ্ক্ষিত ছবিটি প্রস্তুত করা হয়েছে:\n\n![তৈরি করা ছবি](${img})`
        : "এই মুহূর্তে ছবি তৈরিতে সাময়িক বিঘ্ন ঘটেছে। অনুগ্রহ করে আবার অনুরোধ করুন।";
    });
  }

  // ৫. ফলব্যাক কী পুল ও জিরো-ডাউনটাইম এক্সেকিউশন (Zero-Downtime Multi-Key Failover)
  type PoolKey = { name?: string; provider?: string; key?: string; base_url?: string; model?: string; active?: boolean };
  const pool = (Array.isArray((keys as { key_pool?: unknown })?.key_pool) ? (keys as { key_pool: PoolKey[] }).key_pool : [])
    .filter((p) => p && p.active !== false && p.key?.trim());

  const attempts: { url: string; key: string; model: string; label: string }[] = [{ url, key, model, label: "primary" }];

  // একই প্রোভাইডারের ব্যাকআপ কী পুল যুক্ত করা
  for (const p of pool) {
    if (p.provider === provider && p.key!.trim() !== key) {
      attempts.push({ url, key: p.key!.trim(), model, label: p.name || `${provider}-backup` });
    }
  }

  // কাস্টম এন্ডপয়েন্ট (Groq / DeepSeek ইত্যাদি) যুক্ত করা
  for (const p of pool) {
    if (p.provider === "custom" && p.base_url?.startsWith("https://")) {
      attempts.push({
        url: p.base_url.replace(/\/$/, "") + "/chat/completions",
        key: p.key!.trim(),
        model: p.model?.trim() || model,
        label: p.name || "custom-endpoint",
      });
    }
  }

  // জরুরি ব্যাকআপ হিসেবে Lovable Gateway যুক্ত করা
  if (provider !== "lovable" && process.env["LOVABLE_API_KEY"]) {
    attempts.push({
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      key: process.env["LOVABLE_API_KEY"],
      model: DEFAULT_MODELS.lovable,
      label: "lovable-emergency-backup",
    });
  }

  const requestBody: Record<string, unknown> = {
    model,
    stream: true,
    max_tokens: isQuick ? 4096 : 65536,
    messages: [{ role: "system", content: `${system}\n\n=== সত্যতা ও আচরণের ভিত্তি ===\n${evidencePolicy(model)}` }, ...msgs],
  };

  const hasImage = (requestBody["messages"] as any[]).some((m) => Array.isArray(m?.content));
  let res: Response = new Response("no attempt", { status: 500 });
  let lastErrorText = "";
  let lastStatus = 500;

  // অভেদ্য কী-রোটেশন লুপ (Break Bug Fixed)
  for (const a of attempts) {
    if (hasImage && a.label !== "primary" && !a.url.includes("generativelanguage") && !a.url.includes("openai")) {
      continue;
    }

    const ac = new AbortController();
    const timeoutDuration = isQuick ? 12000 : attempts.length > 1 ? 25000 : 50000;
    const timer = setTimeout(() => ac.abort(), timeoutDuration);

    try {
      res = await fetch(a.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${a.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          ...requestBody,
          model: a.model,
          messages: [{ role: "system", content: `${system}\n\n${evidencePolicy(a.model)}` }, ...msgs],
        }),
        signal: ac.signal,
      });

      clearTimeout(timer);

      if (res.ok && res.body) {
        break; // সফল হলে লুপ থেকে বের হবে
      }

      lastStatus = res.status;
      lastErrorText = (await res.text()).slice(0, 400);
      console.warn(`Key "${a.label}" unfulfilled (${res.status}): ${lastErrorText.slice(0, 150)}. Rotating to next key...`);
    } catch (err: any) {
      clearTimeout(timer);
      lastStatus = err?.name === "AbortError" ? 504 : 502;
      lastErrorText = String(err);
      console.warn(`Key "${a.label}" network exception. Rotating to next key...`);
    }
    // কোনো 'break' নেই! একটি ফেইল করলে স্বয়ংক্রিয়ভাবে পরবর্তী কী-তে যাবে
  }

  if (!res.ok || !res.body) {
    return new Response(friendlyError(lastStatus, lastErrorText), {
      status: lastStatus >= 500 || !lastStatus ? 502 : lastStatus,
    });
  }

  stages.push("write");
  return withStages(stages, res.body);
}

function friendlyError(status: number, text: string): string {
  if ([402, 429, 503].includes(status)) return serviceError(status, text);
  const t = text.toLowerCase();
  if (status === 402 || /credit|balance|billing|funds|out of credits/.test(t)) {
    return "এআই সেবার অ্যাকাউন্টে পর্যাপ্ত ব্যালান্স বা কোটা নেই। অ্যাডমিন প্যানেলে নতুন কী সংযুক্ত করুন।";
  }
  if (status === 429 || /rate.*limit|too many requests|resource_exhausted|quota/.test(t)) {
    return "সার্ভারে এই মুহূর্তে অতিরিক্ত অনুরোধের চাপ রয়েছে। অনুগ্রহ করে এক মিনিট পর আবার চেষ্টা করুন।";
  }
  if (status === 401 || status === 403 || /api key|unauthorized|permission/.test(t)) {
    return "এআই এপিআই কী যাচাইকরণে সমস্যা হয়েছে। অ্যাডমিন প্যানেলে সঠিক কী নিশ্চিত করুন।";
  }
  if (status >= 500) {
    return "এআই সেবাদাতা সার্ভারে সাময়িক বিভ্রাট চলছে। কিছুক্ষণ পর আবার চেষ্টা করার অনুরোধ করা হলো।";
  }
  return `অনুরোধটি সম্পন্ন করা যায়নি (স্ট্যাটাস: ${status})। কিছুক্ষণ পর পুনরায় চেষ্টা করুন।`;
}

function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return true;
  if (h === "metadata.google.internal" || h === "::1" || h === "::" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return true;
  }
  return /^\d+$/.test(h) || /^0x/i.test(h);
}

async function safeFetch(url: string): Promise<Response> {
  let current = url;
  for (let i = 0; i < 4; i++) {
    const u = new URL(current);
    if (!/^https?:$/.test(u.protocol) || isBlockedHost(u.hostname)) throw new Error("Blocked host");
    const r = await fetch(current, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (AlAhsanAI safe-reader)", Accept: "text/html,text/plain,*/*" },
      signal: AbortSignal.timeout(8000),
    });
    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.get("location");
      if (!loc) break;
      current = new URL(loc, current).href;
      continue;
    }
    return r;
  }
  throw new Error("Too many redirects");
}

async function readUrls(text: string): Promise<string> {
  const urls = text.match(/https?:\/\/[^\s<>"')]+/g) || [];
  if (!urls.length) return "";
  const out = await Promise.all(
    urls.slice(0, 2).map(async (u) => {
      try {
        const r = await safeFetch(u);
        if (!r.ok) return "";
        const html = await r.text();
        const clean = html
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 4000);
        return clean ? `[${u}]\n${clean}` : "";
      } catch {
        return "";
      }
    })
  );
  return out.filter(Boolean).join("\n\n");
}

const enc = new TextEncoder();
const sse = (o: unknown) => enc.encode(`data: ${JSON.stringify(o)}\n\n`);
const SSE_HEADERS = { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" };

function withStages(stages: string[], upstream: ReadableStream<Uint8Array>): Response {
  const r = upstream.getReader();
  let closed = false;
  const push = (c: ReadableStreamDefaultController<Uint8Array>, v: Uint8Array) => {
    if (closed) return;
    try { c.enqueue(v); } catch { closed = true; }
  };

  const body = new ReadableStream<Uint8Array>({
    async start(c) {
      for (const st of stages) push(c, sse({ stage: st }));
      try {
        while (!closed) {
          const { done, value } = await r.read();
          if (done) break;
          push(c, value);
        }
      } catch {
        push(c, sse({ error: "সংযোগ মাঝপথে বিচ্ছিন্ন হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।" }));
      }
      if (!closed) {
        closed = true;
        try { c.close(); } catch {}
      }
    },
    cancel() {
      closed = true;
      r.cancel().catch(() => {});
    },
  });
  return new Response(body, { headers: SSE_HEADERS });
}

function stageStream(stages: string[], work: () => Promise<string>): Response {
  const body = new ReadableStream<Uint8Array>({
    async start(c) {
      const push = (v: Uint8Array) => {
        try { c.enqueue(v); return true; } catch { return false; }
      };
      for (const st of stages) push(sse({ stage: st }));
      let text = "";
      try { text = await work(); } catch { text = "কাজটি সম্পন্ন করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।"; }
      if (push(sse({ choices: [{ delta: { content: text } }] }))) {
        push(enc.encode("data: [DONE]\n\n"));
      }
      try { c.close(); } catch {}
    },
  });
  return new Response(body, { headers: SSE_HEADERS });
}

function wantsImage(t: string): boolean {
  return (
    /(ছবি|চিত্র|লোগো|পোস্টার|ব্যানার|image|picture|photo|logo|poster|illustration|drawing)/i.test(t) &&
    /(বানা|তৈরি|আঁক|এঁকে|জেনারেট|generate|create|draw|make|design)/i.test(t) &&
    !/(ওয়েবসাইট|website|html|কোড|code)/i.test(t)
  );
}

async function generateImage(prompt: string): Promise<string | null> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai/gpt-image-2.5-sunburst", prompt: prompt.slice(0, 3000), size: "1024x1024", n: 1 }),
      signal: AbortSignal.timeout(90000),
    }).catch(() => null);

    if (r?.ok) {
      const j: any = await r.json().catch(() => null);
      const d = j?.data?.[0];
      if (d?.b64_json) return `data:image/png;base64,${d.b64_json}`;
      if (d?.url) return d.url;
    }
  }
  return null;
}

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

async function newsRss(q: string): Promise<string> {
  const todayOnly = /আজ|today/i.test(q);
  const query = q.replace(/আজকের|আজকে|খবর বলুন|খবর দাও|কী|কি|\?/g, " ").trim() || "বাংলাদেশ";
  const r = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent((query + " when:2d").slice(0, 150))}&hl=bn&gl=BD&ceid=BD:bn`, {
    headers: { "User-Agent": BROWSER_UA },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!r?.ok) return "";
  const xml = await r.text();
  return parseNewsRss(xml, new Date(), todayOnly);
}

async function tavilySearch(q: string): Promise<{ url: string; title: string; snip: string }[]> {
  const key = process.env["TAVILY_API_KEY"]?.trim();
  if (!key) return [];
  const r = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: key, query: q.slice(0, 300), max_results: 5, search_depth: "basic" }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!r?.ok) return [];
  const data = (await r.json().catch(() => null)) as { results?: { url: string; title: string; content: string }[] } | null;
  if (!data?.results?.length) return [];
  return data.results.map((it) => ({
    url: it.url,
    title: it.title || "",
    snip: it.content || "",
  }));
}

async function ddgHtml(q: string): Promise<string> {
  for (let i = 0; i < 2; i++) {
    const r = await fetch("https://html.duckduckgo.com/html/", {
      method: "POST",
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html", "Accept-Language": "bn-BD,bn;q=0.9,en;q=0.8", "Content-Type": "application/x-www-form-urlencoded" },
      body: `q=${encodeURIComponent(q.slice(0, 200))}&kl=bd-en`,
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    if (r?.ok) {
      const h = await r.text();
      if (/result__a/.test(h)) return h;
    }
    await new Promise((res) => setTimeout(res, 500));
  }
  return "";
}

async function bingSearch(q: string): Promise<{ url: string; title: string; snip: string }[]> {
  const r = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(q.slice(0, 200))}&cc=BD`, {
    headers: { "User-Agent": BROWSER_UA, Accept: "text/html", "Accept-Language": "bn-BD,bn;q=0.9,en;q=0.8" },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!r?.ok) return [];
  const html = await r.text();
  const strip = (x: string) => x.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/\s+/g, " ").trim();
  const out: { url: string; title: string; snip: string }[] = [];
  for (const block of html.split('<li class="b_algo"').slice(1)) {
    const a = /<h2[^>]*>\s*<a[^>]+href="(https?:[^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(block);
    if (!a) continue;
    const p = /<p[^>]*>([\s\S]*?)<\/p>/.exec(block);
    out.push({ url: a[1]!.replace(/&amp;/g, "&"), title: strip(a[2]!), snip: p ? strip(p[1]!) : "" });
    if (out.length >= 6) break;
  }
  return out;
}

async function webSearch(q: string): Promise<string> {
  if (/(খবর|সংবাদ|news)/i.test(q)) {
    const headlines = await newsRss(q);
    if (headlines) return headlines;
  }

  const tavily = await tavilySearch(q);
  if (tavily.length) {
    return tavily.map((o, i) => `[${i + 1}] ${o.title}\n${o.url}\n${o.snip}`).join("\n\n");
  }

  const html = await ddgHtml(q);
  if (!html) {
    const b = await bingSearch(q);
    return b.map((o, i) => `[${i + 1}] ${o.title}\n${o.url}\n${o.snip}`).join("\n\n");
  }

  const strip = (x: string) => x.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
  const out: { url: string; title: string; snip: string }[] = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(html)) && out.length < 6) {
    let u = m[1]!;
    const uddg = /uddg=([^&]+)/.exec(u);
    if (uddg) u = decodeURIComponent(uddg[1]!);
    if (!/^https?:/.test(u)) continue;
    out.push({ url: u, title: strip(m[2]!), snip: strip(m[3]!) });
  }

  return out.map((o, i) => `[${i + 1}] ${o.title}\n${o.url}\n${o.snip}`).join("\n\n");
}
