import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { DEFAULT_MODELS, CHAT_PICKER_MODELS, GROQ_MODELS, OPENROUTER_MODELS, type Provider } from "@/lib/models";
import { serviceError } from "@/lib/service-errors";

const Body = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(160000), // RAG ও বড় ডকুমেন্ট পড়ার জন্য বাড়ানো হয়েছে
        image: z
          .string()
          .regex(/^data:image\/(png|jpe?g|webp|gif);base64,/)
          .max(4_000_000)
          .optional(),
        images: z
          .array(z.string().regex(/^data:image\/(png|jpe?g|webp|gif);base64,/).max(2_500_000))
          .max(5)
          .optional(),
      })
    )
    .min(1)
    .max(60),
  model: z.string().max(80).optional(),
});

const ENGINEER_PROMPT = `## শীর্ষ সফটওয়্যার আর্কিটেক্ট ইঞ্জিন (Principal Systems Architect)
তুমি সিলিকন ভ্যালির একজন প্রিন্সিপাল সফটওয়্যার আর্কিটেক্ট ও টেকনিক্যাল লিড। অগভীর, অপেশাদার বা সাদামাটা কোনো উত্তর তুমি দেবে না। কোনো অপ্রয়োজনীয় অদৃশ্য মনোলোগ বা দীর্ঘ নীরবতা তৈরি না করে তাৎক্ষণিকভাবে সমাধান দেবে।
১. সিস্টেম বিশ্লেষণ: ব্যবহারকারীর সমস্যার মূল টেকনিক্যাল চ্যালেঞ্জ ও লক্ষ্য ২ লাইনে স্পষ্ট করবে। কোনো প্রযুক্তিগত অনুমান থাকলে তা "প্রযুক্তিগত অনুমান:" হিসেবে শুরুতেই জানাবে।
২. আর্কিটেকচার ব্লুপ্রিন্ট: ফাইল স্ট্রাকচার, ডেটা ফ্লো ও স্টেট ম্যানেজমেন্টের নিখুঁত আর্কিটেকচার রূপরেখা দেবে।
৩. প্রোডাকশন গ্রেড বাস্তবায়ন:
   - প্রতিটি ফাইলের নাম স্পষ্ট আপেক্ষিক পাথে দেবে (যেমন: \`src/components/Navbar.tsx\`) এবং তার নিচে সম্পূর্ণ কোড ব্লক দেবে।
   - কোডে কোনো প্রকার placeholder, "// বাকি কোড আগের মতো", "...", বা অসম্পূর্ণ ফাংশন কঠোরভাবে নিষিদ্ধ।
   - ইন্ডাস্ট্রি স্ট্যান্ডার্ড এরর হ্যান্ডলিং, টাইপ-সেফটি, ইনপুট স্যানিটাইজেশন এবং মেমোরি লিক প্রতিরোধ নিশ্চিত করবে।
৪. বাস্তবায়ন যাচাই: কোড লেখার সময়ই সিনট্যাক্স, টাইপ ও লজিক নির্ভুল রাখবে। কোডের নিচে "যাচাই ও নিশ্চয়তা:" অংশে সংক্ষেপে চেকলিস্ট দেবে।
৫. ডিপ্লয়মেন্ট কমান্ড: প্যাকেজ ইনস্টল, এনভায়রনমেন্ট ভ্যারিয়েবল এবং অ্যাপ্লিকেশন রান করার সঠিক কমান্ড দেবে।`;

// ফ্রন্টিয়ার এআই পারসোনা (রোবটিক সীমাবদ্ধতার অজুহাত সম্পূর্ণ নিষিদ্ধ)
const PERSONA = `## পরিচয় ও বুদ্ধিমত্তা
- তুমি "আল আহসান এআই" (Al Ahsan AI) — আল আহসান ফাউন্ডেশন বাংলাদেশ কর্তৃক তৈরি একটি উচ্চমানের, বিচক্ষণ ও নির্ভরযোগ্য সহকারী।
- তোমার ভাষা হবে সাবলীল, প্রাতিষ্ঠানিক, স্পষ্ট ও আন্তরিক বাংলা। কৃত্রিম বা যান্ত্রিক ভঙ্গি সম্পূর্ণ বর্জন করবে।
- অযথা তোষামোদ বা ভূমিকা ("চমৎকার প্রশ্ন করেছেন", "আমি একটি এআই মডেল হিসেবে...") পরিহার করে সরাসরি মূল বিষয়ে আলোকপাত করবে।
- ব্যবহারকারী সালাম দিলে সম্মান ও আন্তরিকতার সাথে উত্তর দেবে।
- অজানা বিষয়ে কাল্পনিক তথ্য না দিয়ে সততার সাথে নিজের সীমাবদ্ধতা স্বীকার করবে।
-আল আহসান এআই: মূল পরিচয় ও ১০টি সর্বোচ্চ নীতি
-তুমি "আল আহসান এআই" — সাধারণ কোনো চ্যাটবট না। তুমি একজন বাস্তব, বুদ্ধিমান, জবাবদিহিমূলক ইঞ্জিনিয়ার।

[নীতি ১] সাধারণ চ্যাটবট নয়, একজন বিজ্ঞ ইঞ্জিনিয়ার।
[নীতি ২] সত্য যাচাই ও ভুল/সঠিকের স্বাধীন বিচার।
[নীতি ৩] তথ্যের উৎস ও প্রমাণের উপর নির্ভর।
[নীতি ৪] পরীক্ষা, যাচাই, verification ছাড়া কোনো দাবি করবে না।
[নীতি ৫] কোনো অনুমান বা মনগড়া তথ্য নিষিদ্ধ।
[নীতি ৬] যুক্তি, বিশ্লেষণ ও বাস্তবতা।
[নীতি ৭] বুদ্ধিমত্তা + বিবেক + সংযম।
[নীতি ৮] প্রমাণহীন কোনো তথ্য দেবে না।
[নীতি ৯] অনুসন্ধান, যাচাই, রেফারেন্স সর্বদা থাকবে।
[নীতি ১০] সরাসরি, পরিষ্কার, চূড়ান্ত ও নির্ভরযোগ্য উত্তর।
`;

const BASE_PROMPT = `## উত্তরের মান ও উপস্থাপন
- ব্যবহারকারীর প্রশ্নের গভীরতা বুঝে যৌক্তিক, তথ্যসমৃদ্ধ ও সুশৃঙ্খল বিশ্লেষণ দেবে।
- জটিল বিষয় সহজে বোঝাতে প্রয়োজনানুসারে প্যারাগ্রাফ, বুলেট পয়েন্ট ও তুলনামূলক টেবিল ব্যবহার করবে।
- প্রোগ্রামিং, প্রযুক্তি বা গণিতের সমস্যায় কার্যকর ও আধুনিক সমাধান দেবে।
- ইসলামি প্রশ্নে কুরআন ও সহিহ হাদিসের আলোকে প্রামাণিক ও ভারসাম্যপূর্ণ উত্তর দেবে।
- বাংলাদেশের প্রেক্ষাপট (আইন, সংস্কৃতি, অর্থনীতি, মুদ্রা ৳) প্রাসঙ্গিকভাবে বিবেচনা করবে।`;

// ওয়েবসাইট ও ওয়েব অ্যাপ তৈরির নির্দেশনা
const SITE_BUILDER_PROMPT = `## ওয়েবসাইট ও অ্যাপ ডেভেলপমেন্ট
ব্যবহারকারী পূর্ণাঙ্গ ওয়েবসাইট বা ওয়েব অ্যাপ্লিকেশন চাইলে:
১. একটি স্বয়ংসম্পূর্ণ সিঙ্গেল-ফাইল HTML কোড (\`\`\`html ব্লকে) প্রদান করবে।
২. আধুনিক রেসপনসিভ ডিজাইন (Tailwind CSS, সুন্দর ফন্ট ও আইকন) নিশ্চিত করবে।
৩. কোনো অসম্পূর্ণ কোড বা প্লেসহোল্ডার ("// বাকি অংশ...") রাখবে না; প্রতিটি বাটন ও ইন্টারঅ্যাকশন যেন বাস্তবসম্মতভাবে কাজ করে।`;

const INTEGRITY = `\n\n## সততা ও নিরাপত্তা
- নিশ্চিত না হলে কোনো রেফারেন্স, হাদিস বা সংখ্যা কল্পনা করবে না।
- পাসওয়ার্ড, গোপন এপিআই কি বা ব্যক্তিগত সংবেদনশীল তথ্য কখনো চাইবে না বা প্রকাশ করবে না।
- প্রয়োজন হলে উত্তরের শেষে প্রাসঙ্গিক ১ থেকে ৩টি বুদ্ধিদীপ্ত পরবর্তী অনুসন্ধানের পরামর্শ দিতে পারো:
[[প্রশ্ন: প্রথম প্রস্তাবনা]]
[[প্রশ্ন: দ্বিতীয় প্রস্তাবনা]]
[[প্রশ্ন: তৃতীয় প্রস্তাবনা]]`;
const ISLAMIC_GUARD = `\n\n## ইসলামিক জ্ঞান ও সততা গার্ডরেল (কঠোর)
- [#21] কোনো হাদিস, আয়াত, কিতাবের নাম বা নম্বর কখনো বানাবে না। নিশ্চিত না হলে স্পষ্ট বলবে: "এই বর্ণনার নির্ভরযোগ্য সূত্র আমি নিশ্চিত করতে পারছি না।"
- [#22] কুরআন, সহিহ বুখারি, সহিহ মুসলিম ও অন্যান্য প্রসিদ্ধ সুনান গ্রন্থ এবং স্বীকৃত ফিকহ গ্রন্থকে অগ্রাধিকার দেবে; দুর্বল (যঈফ) বর্ণনা হলে তা উল্লেখ করবে।
- [#23] মতভেদপূর্ণ বিষয়ে প্রধান মাযহাবগুলোর মত ভারসাম্যপূর্ণভাবে তুলে ধরবে; একটি মতকে একমাত্র সত্য বলে চাপিয়ে দেবে না।
- [#24] তালাক, উত্তরাধিকার বণ্টন, ব্যক্তিগত জটিল মাসআলা বা স্পর্শকাতর ফতোয়ায় সাধারণ জ্ঞান দেবে, তবে চূড়ান্ত সিদ্ধান্তের জন্য অভিজ্ঞ মুফতির পরামর্শ নিতে বলবে।
- [#25] ব্যবহারকারী সালাম দিলে উত্তর শুরু করবে "ওয়ালাইকুমুস সালাম ওয়া রাহমাতুল্লাহ" দিয়ে; সালাম না দিলে নিজে থেকে প্রতিবার সালাম দেবে না।
- [#26] নামাজের ওয়াক্ত বা কিবলার দিক অনুমান করে মিনিট/ডিগ্রি বলবে না; অ্যাপের "সালাত" পাতায় অবস্থানভিত্তিক হিসাব দেখতে বলবে, অথবা অনুসন্ধানে পাওয়া নির্দিষ্ট তথ্য উৎসসহ দেবে।
- [#27] শিরক, বিদআত ও কুসংস্কারের (তাবিজ-ভাগ্যগণনা ইত্যাদি) পক্ষে কিছু বলবে না; দলিলসহ বিনয়ের সাথে সতর্ক করবে।
- [#28] আয়াত উদ্ধৃত করলে মূল আরবি, বাংলা অনুবাদ এবং সূরা:আয়াত নম্বর দেবে — শুধু তখনই, যখন নিশ্চিত।
- [#29] আরবি পরিভাষা (যেমন সালাত, যাকাত, সাওম) সঠিক বানানে লিখবে, প্রয়োজনে প্রথমবার বন্ধনীতে অর্থ দেবে।
- [#30] ভাষা হবে বিনয়ী, প্রজ্ঞাপূর্ণ ও সম্মানজনক; কাউকে কাফির/ফাসিক বলে আক্রমণ করবে না।`;

const GROUNDING_RULES = `\n\n## তথ্য যাচাই ও সততা (কঠোর)
- [#12] উত্তরের প্রতিটি তথ্যভিত্তিক দাবি নিচের "অনুসন্ধানের উৎস" অংশ বা তোমার নিশ্চিত জ্ঞানের ওপর দাঁড়াবে; উৎসের সাথে না মিললে সেই দাবি দেবে না।
- [#16] ব্যবহারকারীর প্রশ্নে কোনো ভুল ধারণা বা ভুয়া তথ্য থাকলে উত্তরের শুরুতেই বিনয়ের সাথে "সংশোধন:" লিখে তা ধরিয়ে দেবে।
- [#17] উৎসে তথ্য না থাকলে এবং তুমি নিশ্চিত না হলে অনুমান করবে না; স্পষ্ট লিখবে: "এ বিষয়ে নির্ভরযোগ্য তথ্য পাওয়া যায়নি।"
- [#20][#48] উৎস ব্যবহার করলে বাক্যের শেষে [১], [২] এভাবে ফুটনোট দেবে, এবং উত্তরের শেষে (ফলো-আপ প্রশ্নের আগে) "### সূত্র" শিরোনামে নম্বরসহ শিরোনাম ও লিংক দেবে। উৎসে নেই এমন লিংক বানাবে না।`;

const DOCUMENT_RAG_RULES = `\n\n## ফাইল ও ডকুমেন্ট বিশ্লেষণ গার্ডরেল (RAG & Multi-Document Analysis)
- [#50] ব্যবহারকারী কোনো ফাইল, বই, নথি, পিডিএফ বা নোট সংযুক্ত করলে তার বিষয়বস্তু সর্বোচ্চ অগ্রাধিকার পাবে।
- [#51] উত্তরের প্রতিটি পয়েন্ট প্রদত্ত ডকুমেন্টের তথ্য থেকে নির্ভুলভাবে তুলে ধরবে এবং রেফারেন্স হিসেবে [ডকুমেন্ট: ফাইলের নাম, পৃষ্ঠা: X] উল্লেখ করবে।
- [#52] ফাইলে নেই এমন কোনো কথা বা তথ্য নিজের পক্ষ থেকে বানাবে না। যদি কোনো প্রশ্নের উত্তর ডকুমেন্টে না থাকে, তবে বিনয়ের সাথে স্পষ্ট বলবে: "সংযুক্ত নথিতে এ বিষয়ে কোনো তথ্য পাওয়া যায়নি।"
- [#53] একাধিক নথি সংযুক্ত থাকলে পারস্পরিক তুলনা, বিষয়ভিত্তিক সারাংশ ও যৌক্তিক সমন্বয় করে স্বয়ংসম্পূর্ণ সমাধান দেবে।`;

const CODE_RULES = `\n\n## কোডিং ও অ্যাপ বিল্ডার নিয়ম
- [#31] সম্পূর্ণ কোড দেবে; "// বাকি কোড", "...", "TODO" জাতীয় অসম্পূর্ণ অংশ নিষিদ্ধ।
- [#32] একাধিক ফাইল হলে প্রতিটি কোড ব্লকের আগের লাইনে আপেক্ষিক পাথ (যেমন src/App.tsx) লিখবে।
- [#33] একক পেজ ওয়েবসাইট চাইলে HTML+CSS+JS একটি পূর্ণ \`\`\`html ব্লকে দেবে, যাতে সরাসরি প্রিভিউ চলে।
- [#34] TypeScript-এ সঠিক টাইপ, সব import ও বন্ধনী মিলিয়ে সিনট্যাক্স-নির্ভুল কোড দেবে।
- [#35] প্রয়োজনীয় ইনস্টল, টেস্ট ও ডিপ্লয় কমান্ড আলাদা bash ব্লকে দেবে।
- [#36] ব্যবহারকারী বিদ্যমান কোড দিলে শুধু প্রয়োজনীয় অংশ বদলাবে, বাকি হুবহু রাখবে।
- [#37] গোপন কী কোডে হার্ডকোড করবে না; .env / environment variable ব্যবহার দেখাবে।
- [#38] UI কোড মোবাইল-প্রথম ও রেসপনসিভ হবে।
- [#39] শুধু স্থিতিশীল, প্রচলিত লাইব্রেরি সংস্করণ ব্যবহার করবে; অস্তিত্বহীন প্যাকেজ বা API বানাবে না।
- [#40] মাল্টি-ফাইল প্রজেক্টে পাথ-চিহ্নিত ব্লক দেবে, যাতে অ্যাপের "প্রজেক্ট ফাইল" ও ZIP ডাউনলোড কাজ করে।`;

const STYLE_RULES = `\n\n## উত্তরের ধরন
- [#43] ছোট/সাধারণ প্রশ্নে সরাসরি ১–৩ বাক্যে উত্তর দেবে; অপ্রয়োজনীয় ভূমিকা দেবে না।
- [#45] চাটুকারিতা বর্জন: "চমৎকার প্রশ্ন" জাতীয় প্রশংসা দিয়ে শুরু করবে না; ব্যবহারকারী ভুল হলে সম্মানের সাথে সত্যটা বলবে।
- [#46] ছবি/ডকুমেন্ট দেওয়া হলে প্রথমে লেখাগুলো হুবহু পাঠোদ্ধার (OCR) করবে, তারপর বিশ্লেষণ; ছবিতে যা নেই তা বানাবে না।
- [#47]  উত্তরে কোনো ইমোজি বা সাজসজ্জার চিহ্ন (যেমন ✅ ❌ 🔍 🚀 ✨ ⭐ 👉) ব্যবহার করবে না। প্রয়োজনে সাধারণ তালিকা বা সংখ্যা ব্যবহার করবে।
- [#48]হেডলাইন নিয়ম: শুধুমাত্র সত্যিকারের গুরুত্বপূর্ণ মূল বিষয়গুলোর জন্য "### " দিয়ে ছোট, স্পষ্ট হেডলাইন দেবে (এগুলো ফাউন্ডেশনের অফিসিয়াল রঙে দেখায়)
- [#49]ব্যবহারকারী ভুল বললে তোষামোদ না করে ভদ্রভাবে সঠিক তথ্য দেবে।`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async (ctx) => {
        try { return await handleChat(ctx.request); } catch (e) {
          console.error("chat failed", e);
          return new Response("উত্তর তৈরি করা যায়নি। একটু পরে আবার চেষ্টা করুন।", { status: 503 });
        }
      },
    },
  },
});
// সার্ভার মেমোরি ক্যাশ (৬০ সেকেন্ডের জন্য ai_settings ও ai_keys সংরক্ষণ)
let cachedSettings: { data: any; time: number } | null = null;
let cachedKeys: { data: any; time: number } | null = null;
async function getCachedSettingsAndKeys(supabaseAdmin: any) {
  const now = Date.now();
  const needSettings = !cachedSettings || now - cachedSettings.time > 5_000;
  const needKeys = !cachedKeys || now - cachedKeys.time > 5_000;
  const [sRes, kRes] = await Promise.all([
    needSettings ? supabaseAdmin.from("ai_settings").select("*").eq("id", 1).maybeSingle() : Promise.resolve({ data: cachedSettings!.data }),
    needKeys ? supabaseAdmin.from("ai_keys").select("*").eq("id", 1).maybeSingle() : Promise.resolve({ data: cachedKeys!.data }),
  ]);

  if (needSettings && sRes.data) cachedSettings = { data: sRes.data, time: now };
  if (needKeys && kRes.data) cachedKeys = { data: kRes.data, time: now };

  return { s: sRes.data ?? cachedSettings?.data, keys: kRes.data ?? cachedKeys?.data };
}

async function handleChat(request: Request): Promise<Response> {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });
        const pub = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: u, error: ue } = await pub.auth.getUser(token);
        if (ue || !u.user) return new Response("Unauthorized", { status: 401 });

        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Invalid input", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const uid = u.user.id;
                // মেমোরি লোড: ছোট প্রশ্নে অতিরিক্ত ১৫টি পুরোনো মেসেজ কুয়েরি স্কিপ করে সময় বাঁচানো
        const lastMsgText = String(parsed.data.messages[parsed.data.messages.length - 1]?.content ?? "");
        const isQuickCheck = lastMsgText.length < 600 && !/কোড|code|প্রোগ্রাম|ফতোয়া|মাসআলা|অংক|গণিত|ওয়েবসাইট|website/i.test(lastMsgText);

        const memP = (async () => {
          const mem = await import("@/lib/memory.server");
          const [items, rec] = await Promise.all([
            mem.loadMemory(uid, 60),
            isQuickCheck
              ? Promise.resolve({ data: null })
              : supabaseAdmin.from("messages").select("content,created_at").eq("user_id", uid).eq("role", "user").order("created_at", { ascending: false }).limit(15),
          ]);
          return { items, recent: rec.data };
        })().catch((e) => { console.error("memory load failed", e); return { items: [] as { text: string }[], recent: null }; });
        // Begin local URL extraction now; fetch only after settings permit URL reading.
        const linkedText = /https?:\/\//.test(lastMsgText) ? lastMsgText : "";
        // দ্রুততার জন্য সব প্রস্তুতি একসাথে (সমান্তরালে)
        const hourAgo = new Date(Date.now() - 3600_000).toISOString();
        const dayAgo = new Date(Date.now() - 86400_000).toISOString();
                const [{ s, keys }, { data: isAdmin }, { count: h }, { count: d }] = await Promise.all([
          getCachedSettingsAndKeys(supabaseAdmin),
          supabaseAdmin.rpc("has_role", { _user_id: uid, _role: "admin" }),
          supabaseAdmin.from("chat_usage").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", hourAgo),
          supabaseAdmin.from("chat_usage").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", dayAgo),
        ]);
        if (s && s.chat_enabled === false && !isAdmin)
          return new Response("চ্যাট সাময়িকভাবে বন্ধ আছে। একটু পরে আবার চেষ্টা করুন।", { status: 503 });
        if (!isAdmin) {
          if ((h ?? 0) >= (s?.hourly_limit ?? 30))
            return new Response(`এক ঘণ্টায় সর্বোচ্চ ${s?.hourly_limit ?? 30}টি প্রশ্ন করা যায়। কিছুক্ষণ পর আবার চেষ্টা করুন।`, { status: 429 });
          if ((d ?? 0) >= (s?.daily_limit ?? 150))
            return new Response(`আজকের সীমা (${s?.daily_limit ?? 150}টি প্রশ্ন) শেষ। আগামীকাল আবার চেষ্টা করুন।`, { status: 429 });
        }
        void supabaseAdmin.from("chat_usage").insert({ user_id: uid }).then(() => {});
        const linkedPagesP = s?.url_reader !== false && linkedText ? readUrls(linkedText) : Promise.resolve("");

        const provider = ((s?.provider && (s.provider === "google" || s.provider === "groq" || s.provider === "openrouter" || s.provider === "openai"))
          ? s.provider
          : "google") as Provider;
        const stored = (s?.model || "").trim();
        const retired = /^gemini-1\.|^gemini-2\.|^gpt-3|^o1-|^gemini-pro$|^gemini-flash-latest$/i.test(stored);
        const baseModel = !stored || retired ? DEFAULT_MODELS[provider] : stored;
        const lastText = String(parsed.data.messages[parsed.data.messages.length - 1]?.content ?? "");

        // চ্যাটবক্সে ব্যবহারকারী নির্দিষ্ট কোনো মডেল বেছে নিলে (শুধু অনুমোদিত তালিকা থেকে)
        const picked = parsed.data.model && CHAT_PICKER_MODELS.some((m) => m.id === parsed.data.model) ? parsed.data.model : null;
        let model = picked ?? baseModel;

        type PoolKey = { name?: string; provider?: string; key?: string; base_url?: string; model?: string; active?: boolean };
        const rawPool = (Array.isArray((keys as { key_pool?: unknown })?.key_pool) ? (keys as { key_pool: PoolKey[] }).key_pool : [])
          .filter((p) => p && p.active !== false && p.key?.trim());

        // API keys & Endpoints - অনুমোদিত ৪টি মূল প্রোভাইডার
        let url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
        let key = keys?.google_key?.trim() || rawPool.find((p) => p.provider === "google" && p.active !== false)?.key?.trim() || process.env["GOOGLE_API_KEY"];

        if (provider === "google") {
          url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
          key = keys?.google_key?.trim() || rawPool.find((p) => p.provider === "google" && p.active !== false)?.key?.trim() || process.env["GOOGLE_API_KEY"];
          if (!model || !model.startsWith("gemini-")) model = "gemini-3.8-flash";
        } else if (provider === "groq") {
          url = "https://api.groq.com/openai/v1/chat/completions";
          key = rawPool.find((p) => p.provider === "groq" && p.active !== false)?.key?.trim() || process.env["GROQ_API_KEY"];
          if (!GROQ_MODELS.some((entry) => entry.id === model)) model = DEFAULT_MODELS.groq;
        } else if (provider === "openrouter") {
          url = "https://openrouter.ai/api/v1/chat/completions";
          key = rawPool.find((p) => p.provider === "openrouter" && p.active !== false)?.key?.trim() || process.env["OPENROUTER_API_KEY"];
          if (!OPENROUTER_MODELS.some((entry) => entry.id === model)) model = DEFAULT_MODELS.openrouter;
        } else if (provider === "openai") {
          url = "https://api.openai.com/v1/chat/completions";
          key = keys?.openai_key?.trim() || rawPool.find((p) => p.provider === "openai" && p.active !== false)?.key?.trim() || process.env["OPENAI_API_KEY"];
          if (!model || model.startsWith("gemini-") || model.startsWith("llama-")) model = "gpt-6-astra";
        }

        // Admin-only: answer provider/model status from server-side settings without exposing keys.
        if (isModelStatusQuestion(lastText)) {
          if (!isAdmin) return stageStream(["think"], async () => "কোন AI provider বা model ব্যবহার হচ্ছে, এই তথ্য শুধু অ্যাডমিন দেখতে পারেন।");
          const providerNames: Record<string, string> = { google: "Google Gemini", groq: "Groq", openrouter: "OpenRouter", openai: "OpenAI" };
          const activeSavedKey = rawPool.some((entry) => entry.provider === provider && entry.active !== false && Boolean(entry.key?.trim()));
          const hasConfiguredKey = provider === "google"
            ? Boolean(keys?.google_key?.trim() || activeSavedKey || process.env["GOOGLE_API_KEY"])
            : provider === "openai"
            ? Boolean(keys?.openai_key?.trim() || activeSavedKey || process.env["OPENAI_API_KEY"])
            : Boolean(activeSavedKey || process.env[`${provider.toUpperCase()}_API_KEY`]);
          const status = `অ্যাডমিন সেটিংস অনুযায়ী প্রধান provider: ${providerNames[provider] ?? provider}; নির্বাচিত model: ${model}. সংরক্ষিত/কনফিগার করা key: ${hasConfiguredKey ? "আছে" : "পাওয়া যায়নি"}। কোটা বা সংযোগ সমস্যা হলে সক্রিয় ব্যাকআপ কীতে স্বয়ংক্রিয় failover হবে। কোনো API key এখানে দেখানো হয়নি।`;
          return stageStream(["think"], async () => status);
        }

        if (!key) return new Response("নির্বাচিত প্রোভাইডারের API Key সেট করা নেই। অ্যাডমিন প্যানেলে সঠিক Key বসান।", { status: 503 });

        // Merge Prompts properly so BASE_PROMPT is NEVER lost
        let system = PERSONA + "\n\n" + BASE_PROMPT;
        if (s?.system_prompt?.trim()) {
          system += `\n\n=== অতিরিক্ত সিস্টেম নির্দেশনা ===\n${s.system_prompt.trim()}`;
        }
        if (s?.site_builder === false) system += "\n\nএখন ওয়েবসাইট তৈরির সুবিধা বন্ধ আছে।";
        
        const textMsgs = parsed.data.messages.map((m) => ({ role: m.role, content: m.content }));
        // Independent search and memory preparation run concurrently; preserve search coverage and timeout.
        const searchText = String(parsed.data.messages[parsed.data.messages.length - 1]?.content ?? "");
        const searchP = needsSearch(searchText) ? Promise.race([
          webSearch(searchText).catch(() => ""),
          new Promise<string>((resolve) => setTimeout(() => resolve(""), 6000)),
        ]) : null;
        if (s?.url_reader !== false) {
          const last = textMsgs[textMsgs.length - 1];
          if (last && /https?:\/\//.test(last.content)) {
            const web = await linkedPagesP;
            if (web) textMsgs[textMsgs.length - 1] = { role: last.role, content: `${last.content}\n\n=== ওয়েব পেজের লেখা ===\n${web}` };
          }
        }

        // Attach images (up to 5 per message)
        const imgsOf = (i: number) => {
          const m = parsed.data.messages[i];
          return [...(m?.images ?? []), ...(m?.image ? [m.image] : [])].slice(0, 5);
        };
        const msgs: { role: string; content: unknown }[] = textMsgs.map((m, i) => {
          const imgs = imgsOf(i);
          if (m.role !== "user" || !imgs.length) return m;
          return { role: m.role, content: [{ type: "text", text: m.content || "এই ছবিগুলো বিশ্লেষণ করুন।" }, ...imgs.map((url) => ({ type: "image_url", image_url: { url } }))] };
        });

        if (parsed.data.messages.some((_, i) => imgsOf(i).length))
          system += "\n\nব্যবহারকারী এক বা একাধিক ছবি পাঠিয়েছেন। প্রতিটি ছবি মনোযোগ দিয়ে দেখে বিস্তারিত বর্ণনা, লেখা থাকলে হুবহু পাঠ (OCR) ও বিশ্লেষণ দাও। ওয়েবসাইট তৈরির অনুরোধ হলে ছবিগুলোকে ডিজাইন/তথ্যের রেফারেন্স হিসেবে মেনে চলবে এবং ছবিতে থাকা নাম, ঠিকানা, ফোন, পণ্য, দাম হুবহু ব্যবহার করবে।";

        if (s?.admin_note?.trim()) {
          system += `\n\n=== অ্যাডমিনের নির্দেশনা (সর্বোচ্চ অগ্রাধিকার — অবশ্যই মেনে চলবে) ===\n${s.admin_note.trim()}`;
        }
        system += INTEGRITY;

        // ডকুমেন্ট / RAG বিশ্লেষণ নির্দেশনা যুক্ত করা
        const hasAttachedDocs = parsed.data.messages.some((m) => typeof m.content === "string" && m.content.includes("=== সংযুক্ত ফাইল:"));
        if (hasAttachedDocs) {
          system += DOCUMENT_RAG_RULES;
        }

        // Current Bangladesh date/time so the AI always knows "today"
        const now = new Date();
        const bdDate = new Intl.DateTimeFormat("bn-BD", { timeZone: "Asia/Dhaka", weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(now);
        system += `\n\n=== বর্তমান সময় (সার্ভার ঘড়ি, নির্ভুল) ===\nএখন বাংলাদেশ সময়: ${bdDate} (ISO ${now.toISOString()})। তারিখ/সময় জিজ্ঞেস করলে এটাই বলবে; কখনো বলবে না যে তোমার ঘড়ি বা ইন্টারনেট নেই। তোমার সরাসরি ওয়েব অনুসন্ধান ও লিংক পড়ার ক্ষমতা আছে।`;
        system += `\n\n=== চার্ট নির্দেশনা ===\nযখন উত্তরে তুলনামূলক সংখ্যা, পরিসংখ্যান, বছরভিত্তিক পরিবর্তন বা শতাংশ থাকে, তখন একটি চার্ট যুক্ত করবে। ফরম্যাট ঠিক এরকম (\`\`\`chart কোড ব্লকে বৈধ JSON):\n\`\`\`chart\n{"type":"bar","title":"শিরোনাম","data":[{"name":"ক","value":10},{"name":"খ","value":20}]}\n\`\`\`\ntype হতে পারে "bar", "line" বা "pie"। শুধু বাস্তব/যাচাইকৃত সংখ্যা ব্যবহার করবে, কাল্পনিক সংখ্যা নয়।`;

        // Per-user long-term memory (database) + recent talk — আগেই সমান্তরালে লোড শুরু হয়েছে
        {
          const { items, recent } = await memP;
          if (items.length)
            system += `\n\n=== এই ব্যবহারকারী সম্পর্কে সংরক্ষিত স্মৃতি (সব চ্যাটে প্রযোজ্য, অবশ্যই মনে রাখবে) ===\n${items.map((m) => "- " + m.text).join("\n")}`;
          if (recent?.length)
            system += `\n\n=== এই ব্যবহারকারীর আগের চ্যাটগুলোতে সাম্প্রতিক কথা (প্রসঙ্গ মনে রাখতে ব্যবহার করবে) ===\n${[...recent].reverse().map((r) => "- " + String(r.content).slice(0, 200).replace(/\s+/g, " ")).join("\n")}`;
        }

        const lastUser = String(parsed.data.messages[parsed.data.messages.length - 1]?.content ?? "");
        const lastImg = imgsOf(parsed.data.messages.length - 1)[0];
        const stages: string[] = ["think"];

        // Image generation request
        if (!lastImg && wantsImage(lastUser) && process.env["LOVABLE_API_KEY"]) {
          return stageStream(["think", "image"], async () => {
            const img = await generateImage(lastUser);
            return img
              ? `ছবি তৈরি হয়েছে:\n\n![তৈরি করা ছবি](${img})`
              : "দুঃখিত, এই মুহূর্তে ছবি তৈরি করা যায়নি। একটু পরে আবার চেষ্টা করুন বা বর্ণনা একটু বদলে দিন।";
          });
        }

        // Live web search for online/current questions
        if (needsSearch(lastUser)) {
          stages.push("search");
          const found = await searchP;
          if (found) stages.push("verify");
          system += found
            ? `\n\n=== সর্বশেষ ওয়েব অনুসন্ধানের ফলাফল (${new Date().toISOString().slice(0, 10)}) ===\n${found}\n\nনির্দেশ: শুধু এই ফলাফলের ভিত্তিতে উত্তর দেবে, উত্তরের শেষে "সূত্র:" শিরোনামে ব্যবহৃত লিংকগুলো তালিকা করবে। ফলাফলে তথ্য না থাকলে স্পষ্ট বলবে যে নিশ্চিত তথ্য পাওয়া যায়নি — অনুমান করবে না।`
            : "\n\nব্যবহারকারী সাম্প্রতিক তথ্য চেয়েছেন কিন্তু ওয়েব অনুসন্ধান এখন কাজ করেনি। তথ্য পুরোনো হতে পারে তা স্পষ্ট জানাবে, অনুমান করবে না।";

        }
        if (/ওয়েবসাইট|website|ওয়েব সাইট|অ্যাপ|app|landing|পেজ বানা|html/i.test(lastUser)) stages.push("code");
        if (/নামাজ|নামায|কিবলা|কেবলা|মসজিদ|সেহরি|ইফতার|অবস্থান|কাছাকাছি|qibla|mosque|prayer time|near me/i.test(lastUser)) {
          stages.unshift("geo");
          system += `\n\nব্যবহারকারী অবস্থানভিত্তিক তথ্য চেয়েছেন। নির্দেশ: অ্যাপের "নামাজ ও কিবলা" পাতা (/salat) খুললে জিপিএস দিয়ে তাঁর সঠিক নামাজের সময়, সেহরি-ইফতার, কিবলার দিক ও নিকটস্থ মসজিদ দেখা যাবে — এটি বিনয়ের সাথে জানাবে। অবস্থান না জেনে নির্দিষ্ট সময় বা দূরত্ব অনুমান করবে না।`;
        }

        system += isAdmin
          ? `\n\n=== সেশন তথ্য (সার্ভার-যাচাইকৃত) ===\nএই ব্যবহারকারী তোমার অ্যাডমিন (${u.user.email})।${u.user.email === "alahsanfoundation.info@gmail.com" ? " তিনি মোঃ শামীম আহসান — প্রতিষ্ঠাতা, আল আহসান ফাউন্ডেশন বাংলাদেশ।" : ""} তাকে চিনে সম্মানের সাথে কথা বলবে এবং তার কমান্ড সর্বোচ্চ অগ্রাধিকারে পালন করবে।`
          : `\n\n=== সেশন তথ্য ===\nএই ব্যবহারকারী সাধারণ ইউজার, অ্যাডমিন নয়।`;

                const body: Record<string, unknown> = {
          model,
          stream: true,
          max_tokens: 65536,
                  // সাধারণ প্রশ্নে দ্রুত উত্তর শুরু, ওয়েবসাইট তৈরিতে পূর্ণাঙ্গ সাইট
          messages: [{ role: "system", content: system }, ...msgs],
        };

                // অ্যাডমিন প্যানেল থেকে চিন্তার গতি (Thinking Speed / Reasoning Effort) কার্যকর
        const eff = s?.reasoning_effort || "low";

        const attempts: { url: string; key: string; model: string; label: string; provider: string }[] = [{ url, key: key || "", model, label: "primary", provider }];
        // একই প্রোভাইডারের অন্যান্য ব্যাকআপ কী
        for (const p of rawPool) {
          if (p.provider === provider && p.key?.trim() && p.key.trim() !== key) {
            attempts.push({ url, key: p.key.trim(), model: p.model?.trim() || model, label: p.name || provider, provider });
          }
        }
        // অন্যান্য অনুমোদিত প্রোভাইডারের সক্রিয় ব্যাকআপ কী (Failover)
        for (const p of rawPool) {
          if (p.provider === "groq" && provider !== "groq" && p.key?.trim()) {
            attempts.push({ url: "https://api.groq.com/openai/v1/chat/completions", key: p.key.trim(), model: p.model?.trim() || "llama-3.3-70b-versatile", label: p.name || "groq", provider: "groq" });
          } else if (p.provider === "openrouter" && provider !== "openrouter" && p.key?.trim()) {
            attempts.push({ url: "https://openrouter.ai/api/v1/chat/completions", key: p.key.trim(), model: p.model?.trim() || "openrouter/free", label: p.name || "openrouter", provider: "openrouter" });
          } else if (p.provider === "openai" && provider !== "openai" && p.key?.trim()) {
            attempts.push({ url: "https://api.openai.com/v1/chat/completions", key: p.key.trim(), model: p.model?.trim() || "gpt-6-astra", label: p.name || "openai", provider: "openai" });
          } else if (p.provider === "google" && provider !== "google" && p.key?.trim()) {
            attempts.push({ url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", key: p.key.trim(), model: p.model?.trim() || "gemini-3.8-flash", label: p.name || "google", provider: "google" });
          }
        }

        const hasImage = (body["messages"] as any[]).some((m) => Array.isArray(m?.content));
        let res: Response = new Response("no attempt", { status: 500 });
        let realErr: { status: number; text: string } | null = null;

        const requestStartedAt = Date.now();
        for (const a of attempts) {
          if (hasImage && a.label !== "primary" && !a.url.includes("generativelanguage.googleapis.com") && !a.url.includes("openai.com")) continue;
          // Failover must stay bounded: a slow provider should not multiply 20s waits across keys.
          const ac = new AbortController();
          const remainingBudget = 12000 - (Date.now() - requestStartedAt);
          if (remainingBudget <= 0) break;
          const perAttemptTimeout = Math.min(a.label === "primary" ? 7000 : 3500, remainingBudget);
          const timer = setTimeout(() => ac.abort(), perAttemptTimeout);
          // Provider-specific payload: avoid OpenAI-only params on Gemini, Groq, and OpenRouter
          const attemptIsOpenAI = a.url.includes("api.openai.com");
          const attemptIsGroqOSS = a.url.includes("api.groq.com") && a.model.startsWith("openai/gpt-oss-");
          const attemptIsReasoning = (attemptIsOpenAI && (/^(o1|o3|o4)/i.test(a.model) || /^gpt-6/i.test(a.model))) || attemptIsGroqOSS;
          let attemptModel = a.model;
          if (a.provider === "openai" && (!/^gpt-|^o[134]/i.test(attemptModel))) attemptModel = "gpt-6-astra";
          if (a.provider === "google" && !/^gemini-/.test(attemptModel)) attemptModel = "gemini-3.8-flash";
          const attemptBody: Record<string, unknown> = {
            model: attemptModel,
            stream: true,
            messages: body["messages"],
            // OpenAI reasoning models use max_completion_tokens; ordinary models use max_tokens.
            // Do not send reasoning_effort to non-reasoning models (frequent HTTP 400 cause).
            ...(attemptIsReasoning
              ? { max_completion_tokens: 8192, ...(eff !== "none" ? { reasoning_effort: eff === "xhigh" ? "high" : eff } : {}) }
              : { max_tokens: 8192 }),
          };
          const headers: Record<string, string> = { Authorization: `Bearer ${a.key}`, "Content-Type": "application/json" };
          if (a.url.includes("openrouter.ai")) {
            headers["HTTP-Referer"] = "https://alahsan-ai.lovable.app";
            headers["X-Title"] = "Al Ahsan AI";
          }
          res = await fetch(a.url, {
            method: "POST",
            headers,
            body: JSON.stringify(attemptBody),
            signal: ac.signal,
          }).catch((e) => new Response(String(e?.name === "AbortError" ? "timeout" : e), { status: e?.name === "AbortError" ? 504 : 502 }));
          clearTimeout(timer);
          if (res.ok && res.body) break;
          const t = (await res.text()).slice(0, 500);
          realErr ??= { status: res.status, text: t };
          console.error(`Key "${a.label}" failed [${res.status}]: ${t.slice(0, 300)}`);
                    // A failed backup key/provider (including 402 balance, 429 quota, or 5xx)
          // must not prevent trying the remaining independent backup providers.
        }
                // গুগল বা ওপেনএআই-এর সব কী কোটা শেষ (৪২৯) বা অফলাইন হলেও যাতে চ্যাট উত্তর দেওয়া বন্ধ না করে
        if ((!res.ok || !res.body) && process.env["LOVABLE_API_KEY"] && Date.now() - requestStartedAt < 12000) {
          const first = (model.includes("/") ? model : `${provider}/${model}`).replace(/^google\/gemini-(1|2)\.\d.*$/, "google/gemini-3.1-pro-preview");
          const chain = [...new Set([first, "google/gemini-3.8-flash", "google/gemini-3.1-flash-lite"].filter(Boolean))].slice(0, 2);
          for (const gwModel of chain) {
            const remaining = 12000 - (Date.now() - requestStartedAt);
            if (remaining <= 0) break;
            const g = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`, "Content-Type": "application/json" },
              body: JSON.stringify({ ...body, model: gwModel }),
              signal: AbortSignal.timeout(Math.min(5000, remaining)),
            }).catch(() => null);
            if (g?.ok && g.body) { res = g; break; }
            await g?.text().catch(() => "");
          }
        }

        if (!res.ok || !res.body) {
          const err = realErr ?? { status: res.status, text: await res.text().catch(() => "") };
          return new Response(friendlyError(err.status, err.text), { status: err.status >= 500 || !err.status ? 502 : err.status });
        }

        if (realErr) stages.push("fallback");
        stages.push("write");
        return withStages(stages, res.body);
}

function toClaudeMessages(messages: { role: string; content: unknown }[]) {
  return messages.filter((m) => m.role === "user" || m.role === "assistant").map((m) => {
    if (typeof m.content === "string") return { role: m.role, content: m.content };
    const blocks: any[] = Array.isArray(m.content) ? m.content.flatMap((part: any): any[] => {
      if (part?.type === "text") return [{ type: "text", text: String(part.text ?? "") }];
      const dataUrl = part?.image_url?.url;
      const match = typeof dataUrl === "string" && dataUrl.match(/^data:(image\/(?:jpeg|png|gif|webp));base64,([A-Za-z0-9+/=]+)$/i);
      return match ? [{ type: "image", source: { type: "base64", media_type: match[1], data: match[2] } }] : [];
    }) : [{ type: "text", text: String(m.content ?? "") }];
    return { role: m.role, content: blocks.length ? blocks : [{ type: "text", text: "[ছবির বিষয়বস্তু এই মডেলে পাঠানো যায়নি]" }] };
  });
}

function adaptClaudeStream(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let ended = false;
  const chunk = (content: string) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (!ended) {
          const boundary = buffer.search(/\r?\n\r?\n/);
          if (boundary >= 0) {
            const block = buffer.slice(0, boundary);
            const separator = buffer.slice(boundary).match(/^\r?\n\r?\n/)?.[0] ?? "\n\n";
            buffer = buffer.slice(boundary + separator.length);
            let event = "";
            const data: string[] = [];
            for (const line of block.split(/\r?\n/)) {
              if (line.startsWith("event:")) event = line.slice(6).trim();
              else if (line.startsWith("data:")) data.push(line.slice(5).trim());
            }
            if (!data.length) continue;
            try {
              const item = JSON.parse(data.join("\n"));
              if (event === "content_block_delta" && item?.delta?.type === "text_delta" && item.delta.text) {
                controller.enqueue(encoder.encode(chunk(item.delta.text)));
                return;
              }
              if (event === "message_stop") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                ended = true;
                controller.close();
                return;
              }
              if (event === "error" || item?.type === "error") {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: { status: 502, message: "Claude stream-এ সমস্যা হয়েছে। আবার চেষ্টা করুন।" } })}\n\n`));
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                ended = true;
                controller.close();
                return;
              }
            } catch { /* ignore malformed/non-JSON event data */ }
            continue;
          }
          const { value, done } = await reader.read();
          buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
          if (done) {
            ended = true;
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }
        }
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel(reason) { ended = true; await reader.cancel(reason).catch(() => {}); },
  });
}

function pick(a: string[]): string {
  return a[Math.floor(Math.random() * a.length)] ?? a[0] ?? "";
}

function isModelStatusQuestion(text: string): boolean {
  return /(কোন|কি|কী|which|what|বর্তমানে|এখন).{0,50}(মডেল|model|provider|প্রোভাইডার|ইঞ্জিন|এপিআই)/i.test(text)
    || /(মডেল|model|provider|প্রোভাইডার|ইঞ্জিন|এপিআই).{0,50}(কোন|কি|কী|চলছে|ব্যবহার|বর্তমানে|এখন)/i.test(text);
}

function friendlyError(status: number, text: string): string {
  if ([402, 429, 503].includes(status)) return serviceError(status, text);
  const t = text.toLowerCase();
  const billing = status === 402 || /insufficient[_ ]?(credit|balance|funds)|billing|payment required|credit balance|out of credits/.test(t) && !/rate|per minute|requests per/.test(t);
  if (billing) return "এআই সেবার অ্যাকাউন্টে ব্যালান্স বা বিলিং সমস্যার কথা জানিয়েছে। অ্যাডমিন প্যানেলে কী-টি যাচাই করুন বা অন্য কী যোগ করুন।";
  if (status === 429 || /rate.?limit|too many requests|resource_exhausted|quota/.test(t))
    return serviceError(429, text);
  if (status === 401 || status === 403 || /api key|permission|unauthori[sz]ed|invalid.*key/.test(t))
    return "এআই কী গ্রহণ করা হয়নি (কী ভুল বা অনুমতি নেই)। অ্যাডমিন প্যানেলে কী যাচাই করুন।";
  if (status === 404 || /model.*(not found|no longer|deprecated)|model_not_found/.test(t))
    return "নির্বাচিত এআই মডেলটি আর পাওয়া যাচ্ছে না। অ্যাডমিন প্যানেল থেকে সচল মডেল বেছে নিন।";
  if (status === 504 || /timeout/.test(t)) return pick(["উত্তর আসতে বেশি সময় লাগছিল, তাই থেমে গেছে। আবার পাঠান।", "সংযোগ সময়মতো সাড়া দেয়নি। আরেকবার চেষ্টা করুন।"]);
  if (status === 400) return "অনুরোধটি এআই সেবা গ্রহণ করেনি (সম্ভবত ছবি বা লেখা খুব বড়)। ছোট করে আবার পাঠান।";
  if (status >= 500) return pick(["এআই সেবার সার্ভারে সাময়িক সমস্যা হচ্ছে। একটু পরে আবার চেষ্টা করুন।", "ওপাশের সার্ভার এখন ঠিকমতো সাড়া দিচ্ছে না, কিছুক্ষণ পর আবার পাঠান।"]);
  return `উত্তর আনা যায়নি (কোড ${status})। একটু পরে আবার চেষ্টা করুন।`;
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
  if (/^\d+$/.test(h) || /^0x/i.test(h)) return true;
  return false;
}

async function safeFetch(url: string): Promise<Response> {
  let current = url;
  for (let i = 0; i < 4; i++) {
    const u = new URL(current);
    if (!/^https?:$/.test(u.protocol) || isBlockedHost(u.hostname)) throw new Error("blocked");
    const r = await fetch(current, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (AlAhsanAI reader)", Accept: "text/html,text/plain,*/*" },
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
  throw new Error("too many redirects");
}

async function readUrls(text: string): Promise<string> {
  const urls = text.match(/https?:\/\/[^\s<>"')]+/g) || [];
  if (!urls.length) return "";
  const out = await Promise.all(urls.slice(0, 2).map(async (u) => {
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
    } catch { return ""; }
  }));
  return out.filter(Boolean).join("\n\n");
}

const enc = new TextEncoder();
const sse = (o: unknown) => enc.encode(`data: ${JSON.stringify(o)}\n\n`);
const SSE_HEADERS = { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" };

function withStages(stages: string[], upstream: ReadableStream<Uint8Array>): Response {
  const r = upstream.getReader();
  let closed = false;
  // ব্যবহারকারী পাতা বন্ধ/থামালে আর লিখতে গেলে "aborted" ক্র্যাশ হতো — নিরাপদ লেখা
  const push = (c: ReadableStreamDefaultController<Uint8Array>, v: Uint8Array) => {
    if (closed) return;
    try { c.enqueue(v); } catch { closed = true; }
  };
  const body = new ReadableStream<Uint8Array>({
    async start(c) {
      for (const st of stages) push(c, sse({ stage: st }));
      let lastDataAt = Date.now();
      let readPromise = r.read();
      try {
        while (!closed) {
          let heartbeatTimer: ReturnType<typeof setTimeout> | undefined;
          const next = await Promise.race([
            readPromise.then((result) => ({ kind: "read" as const, result })),
            new Promise<{ kind: "heartbeat" }>((resolve) => { heartbeatTimer = setTimeout(() => resolve({ kind: "heartbeat" }), 12000); }),
          ]);
          if (heartbeatTimer) clearTimeout(heartbeatTimer);
          if (next.kind === "heartbeat") {
            if (Date.now() - lastDataAt >= 60000) {
              push(c, sse({ error: { status: 504, message: "এআই সেবা ৬০ সেকেন্ড ধরে নতুন উত্তর পাঠায়নি; সংযোগ থামানো হয়েছে।" } }));
              push(c, enc.encode("data: [DONE]\n\n"));
              await r.cancel().catch(() => {});
              break;
            }
            push(c, enc.encode(": keep-alive\n\n"));
            continue;
          }
          if (next.result.done) break;
          lastDataAt = Date.now();
          push(c, next.result.value);
          readPromise = r.read();
        }
      } catch {
        push(c, sse({ error: { status: 502, message: "সংযোগ মাঝপথে বিচ্ছিন্ন হয়েছে। আবার চেষ্টা করুন।" } }));
        push(c, enc.encode("data: [DONE]\n\n"));
      }
      if (!closed) { closed = true; try { c.close(); } catch { /* already closed */ } }
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
      const push = (v: Uint8Array) => { try { c.enqueue(v); return true; } catch { return false; } };
      for (const st of stages) push(sse({ stage: st }));
      let text = "";
      try { text = await work(); } catch { text = "কাজটি সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।"; }
      if (push(sse({ choices: [{ delta: { content: text } }] }))) push(enc.encode("data: [DONE]\n\n"));
      try { c.close(); } catch { /* client already left */ }
    },
  });
  return new Response(body, { headers: SSE_HEADERS });
}

function wantsImage(t: string): boolean {
  return /(ছবি|চিত্র|লোগো|পোস্টার|ব্যানার|image|picture|photo|logo|poster|illustration|drawing)/i.test(t)
    && /(বানা|তৈরি|আঁক|এঁকে|জেনারেট|generate|create|draw|make|design)/i.test(t)
    && !/(ওয়েবসাইট|website|html|কোড|code)/i.test(t);
}

async function generateImage(prompt: string): Promise<string | null> {
  const key = process.env["LOVABLE_API_KEY"]!;
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
    } else if (r) {
      console.error("image gen failed", r.status, (await r.text()).slice(0, 300));
      if (r.status !== 429 && r.status < 500) break;
    }
  }
  return null;
}

function needsSearch(t: string): boolean {
  if (/https?:\/\//.test(t)) return false;
  if (/=== সংযুক্ত ফাইল:/.test(t)) return false;
  // Location / time-of-day questions are answered from server clock & location guidance, not web search
  if (/(কোন জায়গায়|কোথায় আছি|আমার অবস্থান|where am i|কয়টা বাজে|কত তারিখ|কি বার|কী বার)/i.test(t)) return false;
  // ছোট সাধারণ কথায় (হাই, কেমন আছো, এখন কী করছ) সার্চ নয় — শুধু স্পষ্ট লাইভ-তথ্যের প্রশ্নে
  if (t.trim().length < 12) return false;
  return /(সর্বশেষ|সাম্প্রতিক|খবর|সংবাদ|দাম কত|বাজার দর|রেট|আবহাওয়া|ফলাফল|স্কোর|নির্বাচন|latest|news|price|weather|score|সার্চ|খুঁজে|অনুসন্ধান|search|আজকের (খবর|দাম|আবহাওয়া|খেলা|রেট))/i.test(t);
}

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
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
    await new Promise((res) => setTimeout(res, 600));
  }
  return "";
}

async function bingSearch(q: string): Promise<{ url: string; title: string; snip: string }[]> {
  const r = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(q.slice(0, 200))}&cc=BD`, { headers: { "User-Agent": BROWSER_UA, Accept: "text/html", "Accept-Language": "bn-BD,bn;q=0.9,en;q=0.8" }, signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!r?.ok) return [];
  const html = await r.text();
  const strip = (x: string) => x.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&nbsp;|&ensp;/g, " ").replace(/\s+/g, " ").trim();
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

async function newsRss(q: string): Promise<string> {
  const r = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q.slice(0, 150))}&hl=bn&gl=BD&ceid=BD:bn`, { headers: { "User-Agent": BROWSER_UA }, signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!r?.ok) return "";
  const xml = await r.text();
  const items = xml.split("<item>").slice(1, 9).map((it) => {
    const g = (t: string) => (new RegExp(`<${t}>([\\s\\S]*?)</${t}>`).exec(it)?.[1] ?? "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    return `- ${g("title")} (${g("pubDate")})\n  ${g("link")}`;
  });
  return items.length ? `=== সর্বশেষ সংবাদ শিরোনাম (Google News) ===\n${items.join("\n")}` : "";
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

async function webSearch(q: string): Promise<string> {
  const news = /(খবর|সংবাদ|news|আজকে?র?|today|সর্বশেষ|latest)/i.test(q) ? newsRss(q.replace(/(আজকের|আজকে|কী|কি|\?)/g, " ").trim() || "বাংলাদেশ") : Promise.resolve("");
  const tavily = await tavilySearch(q);
  if (tavily.length) {
    const n = await news;
    return [n, tavily.map((o, i) => `[${i + 1}] ${o.title}\n${o.url}\n${o.snip}`).join("\n\n")].filter(Boolean).join("\n\n");
  }
  const html = await ddgHtml(q);
  if (!html) {
    const b = await bingSearch(q);
    const n = await news;
    if (!b.length) return n;
    const top = await readUrls(b.slice(0, 2).map((o) => o.url).join(" ")).catch(() => "");
    return [n, b.map((o, i) => `[${i + 1}] ${o.title}\n${o.url}\n${o.snip}`).join("\n\n"), top ? `--- শীর্ষ পেজের লেখা ---\n${top}` : ""].filter(Boolean).join("\n\n");
  }
  const strip = (x: string) => x.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
  const out: { url: string; title: string; snip: string }[] = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 6) {
    let url = m[1]!;
    const uddg = /uddg=([^&]+)/.exec(url);
    if (uddg) url = decodeURIComponent(uddg[1]!);
    if (!/^https?:/.test(url)) continue;
    out.push({ url, title: strip(m[2]!), snip: strip(m[3]!) });
  }
  if (!out.length) return await news;
  const top = await readUrls(out.slice(0, 2).map((o) => o.url).join(" ")).catch(() => "");
  const n = await news;
  return (n ? n + "\n\n" : "") + out.map((o, i) => `[${i + 1}] ${o.title}\n${o.url}\n${o.snip}`).join("\n\n") + (top ? `\n\n--- শীর্ষ পেজের লেখা ---\n${top}` : "");
}
