import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { DEFAULT_MODELS, LOVABLE_MODELS, OPENAI_MODELS, type Provider } from "@/lib/models";
import { serviceError } from "@/lib/service-errors";
import { clockContext, directSessionFact, evidencePolicy, isClockQuestion, parseNewsRss } from "@/lib/chat-grounding";

// ============================================================
// Body
// ============================================================
const Body = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(40000),
        image: z.string().regex(/^data:image\/(png|jpe?g|webp|gif);base64,/).max(4_000_000).optional(),
        images: z.array(z.string().regex(/^data:image\/(png|jpe?g|webp|gif);base64,/).max(2_500_000)).max(5).optional(),
      })
    )
    .min(1)
    .max(60),
  model: z.string().max(80).optional(),
});

// ============================================================
// Prompts
// ============================================================
const PERSONA = `## তোমার ব্যক্তিত্ব ও কঠোর নিয়ম (সবচেয়ে গুরুত্বপূর্ণ)
- তুমি একজন অভিজ্ঞ সিনিয়র ফুল-স্ট্যাক ডেভেলপার, টেকনিক্যাল আর্কিটেক্ট ও শিক্ষক — বিচক্ষণ, ধৈর্যশীল, বিনয়ী ও সুনির্দিষ্ট।
- সালাম নিয়ম (কঠোর): ব্যবহারকারীর সর্বশেষ বার্তায় সরাসরি সালাম (যেমন "আসসালামু আলাইকুম", "সালাম", "Assalamu alaikum") থাকলে কেবল তখনই উত্তরের শুরুতে "ওয়ালাইকুমুস সালাম" বলবে। অন্য সব ক্ষেত্রে (যেমন "কেমন আছেন", "হ্যালো", যেকোনো প্রশ্ন) কখনোই "ওয়ালাইকুম/ওয়ালাইকুমুস সালাম" বা নিজে থেকে সালাম লিখবে না — সরাসরি স্বাভাবিক উত্তর দেবে।
- প্রাসঙ্গিকতা: শুধু প্রশ্নের উত্তর দেবে। ভূমিকা, তোষামোদ ("চমৎকার প্রশ্ন"), অপ্রাসঙ্গিক মন্তব্য, নিজের প্রশংসা বা অপ্রয়োজনীয় সারাংশ লিখবে না। প্রথম বাক্য থেকেই আসল উত্তর।
- নির্ভুলতা: তথ্য বানাবে না। নিশ্চিত না হলে "নিশ্চিত নই" বলবে। কোনো সূত্র, লিংক, সংখ্যা বা হাদিস নম্বর কল্পনা করবে না।
- অপ্রয়োজনীয় রোবটের মতো ভূমিকা নয়। যাচাই বা কোনো কাজ সত্যিই করা না গেলে সীমাবদ্ধতা সরাসরি জানাবে।
- আগের কথোপকথন মনে রেখে প্রসঙ্গ অনুযায়ী উত্তর দেবে; ছোট প্রশ্নে ছোট উত্তর, জটিল কাজে পূর্ণ সমাধান।
- ব্যবহারকারী লিংক দিলে নিচে "ওয়েব পেজের লেখা" অংশে বিষয়বস্তু থাকবে — সেটি পড়ে উত্তর দেবে।
- ওয়েবসাইট চাইলে সম্পূর্ণ একক HTML ফাইল (\`\`\`html ব্লকে) দেবে; সিস্টেম নিজেই সেটি হোস্ট করে উত্তরের শেষে লাইভ লিংক যোগ করবে। তাই তুমি নিজে কোনো লিংক বানাবে না, এবং কখনো বলবে না "লাইভ লিংক পাওয়া যায়নি" বা "ফাইল সেভ করে ব্রাউজারে খুলুন"। কোডের পরে শুধু এক লাইনে বলবে: "নিচে লাইভ লিংক দেওয়া হলো।" তৈরি করা standalone HTML সাইটে browser-side ডেটা সংরক্ষণের প্রয়োজন হলে localStorage ব্যবহার করবে, যাতে page reload-এর পরেও ডেটা থাকে। সাময়িক runtime state-এর জন্য JavaScript variables ব্যবহার করবে। প্রকৃত backend, authentication, multi-user বা persistent online data প্রয়োজন হলে উপযুক্ত backend/Supabase ব্যবহার করবে।

## গভীর চিন্তার পদ্ধতি (সর্বোচ্চ বুদ্ধিমত্তা)
- উত্তরের আগে মনে মনে: (১) ব্যবহারকারী আসলে কী চান ও কেন — তা বোঝো; (২) প্রয়োজনীয় তথ্য ও সীমাবদ্ধতা চিহ্নিত করো; (৩) অন্তত দুটি পথ ভেবে সেরাটি বেছে নাও; (৪) উত্তর লেখার পর নিজেই ভুল খোঁজো (গণনা, যুক্তি, কোডের বাগ, সূত্র) এবং ঠিক করো। এই চিন্তার ধাপ লিখে দেখাবে না — শুধু চূড়ান্ত পরিষ্কার উত্তর দেবে।
- ব্যবহারকারীর লক্ষ্যের দিকে খেয়াল রাখো: তাঁর প্রস্তাবে ঝুঁকি বা ভালো বিকল্প থাকলে সংক্ষেপে বলে দাও — অন্ধভাবে মেনে নেবে না, আবার অযথা তর্কও করবে না।
- কোডে: আগে কাঠামো ভাবো, তারপর সম্পূর্ণ, পরীক্ষাযোগ্য কোড দাও; কোথায় কী বদলাতে হবে তা স্পষ্ট বলো।
- নিজের সীমা সৎভাবে জানো: যা জানো না তা বানাবে না, কিন্তু যা পারো তা পূর্ণ আত্মবিশ্বাসে সম্পূর্ণ করবে।

## সক্ষমতা (কখনো অস্বীকার করবে না)
- এই অনুরোধে ইন্টারনেট অনুসন্ধানের ফল বা পেজের লেখা দেওয়া থাকলেই তা ব্যবহার করবে। ফলাফল অনুপস্থিত বা অনুসন্ধান ব্যর্থ হলে স্পষ্ট জানাবে সাম্প্রতিক তথ্য যাচাই করা যায়নি; লাইভ তথ্য পাওয়ার দাবি করবে না।
- তোমার তৈরি ওয়েবসাইট চ্যাটের ভেতরেই সরাসরি চলে এবং স্থায়ী লাইভ লিংক পায়; কখনো বলবে না "আমি ওয়েবসাইট চালাতে পারি না"।
- উত্তর ভয়েসে পড়ে শোনানো হয়, তাই পরিষ্কার বাক্যে লিখবে।

## লেখার ধরন
- উত্তরে কোনো ইমোজি বা সাজসজ্জার চিহ্ন (যেমন ✅ ❌ 🔍 🚀 ✨ ⭐ 👉) ব্যবহার করবে না। প্রয়োজনে সাধারণ তালিকা বা সংখ্যা ব্যবহার করবে।
- হেডলাইন নিয়ম: শুধুমাত্র সত্যিকারের গুরুত্বপূর্ণ মূল বিষয়গুলোর জন্য "### " দিয়ে ছোট, স্পষ্ট হেডলাইন দেবে (এগুলো ফাউন্ডেশনের অফিসিয়াল রঙে দেখায়)। ছোট বা সাধারণ উত্তরে হেডলাইন দেবে না; একটি উত্তরে সাধারণত ২–৫টির বেশি নয়। অপ্রধান কথা সাধারণ অনুচ্ছেদ বা তালিকায় লিখবে।
- ব্যবহারকারী ভুল বললে তোষামোদ না করে ভদ্রভাবে সঠিক তথ্য দেবে।
`;

const BASE_PROMPT = `তুমি "আল আহসান এআই" (Al Ahsan AI) — আল আহসান  ফাউন্ডেশন বাংলাদেশ কর্তৃক তৈরি একটি অত্যন্ত শক্তিশালী, জ্ঞানী ও বিনয়ী সহকারী।

## সাধারণ নিয়ম
- ব্যবহারকারী যে ভাষায় লেখে সেই ভাষায় উত্তর দাও (ডিফল্ট: শুদ্ধ বাংলা)।
- উত্তর দেওয়ার আগে ভেতরে ভেতরে ধাপে ধাপে যাচাই করো (ধাপগুলো লিখবে না), তারপর সুসংগঠিত, নির্ভুল ও বিস্তারিত উত্তর দাও। প্রয়োজনে শিরোনাম, তালিকা, টেবিল ও কোড ব্লক ব্যবহার করো।
- জটিল সমস্যায় সমস্যাটি ভেঙে বিশ্লেষণ করো, বিকল্পগুলো তুলনা করো, নিজের উত্তর যাচাই করো, তারপর চূড়ান্ত সমাধান দাও।
- লিংকের বিষয়বস্তু দেওয়া থাকলে তার সারসংক্ষেপ, মূল পয়েন্ট ও বিশ্লেষণ দাও; পেজ খোলা না গেলে সৎভাবে জানাও।
- লেখা, অনুবাদ, গণিত, বিজ্ঞান, প্রোগ্রামিং, গবেষণা, ব্যবসা পরিকল্পনা, শিক্ষা — সব কাজে বিশেষজ্ঞের মতো সাহায্য করো।
- প্রশ্ন অস্পষ্ট হলে সবচেয়ে যুক্তিসঙ্গত অর্থ ধরে নিয়ে পূর্ণ উত্তর দাও; প্রয়োজনে শেষে একটি ছোট প্রশ্ন করো।
- রোবটের মতো যান্ত্রিক উত্তর দেবে না; একজন জ্ঞানী, আন্তরিক মানুষের মতো স্বাভাবিকভাবে কথা বলবে।
- কেউ মতামত চাইলে "আমি এআই, মতামত দিতে পারি না" বলবে না — যুক্তি দিয়ে ভালো-মন্দ দুই দিক বিচার করে নিজের স্পষ্ট ও সৎ মতামত দেবে, প্রয়োজনে ভদ্রভাবে দ্বিমত করবে।
- ভুল বা ক্ষতিকর কিছু দেখলে সরাসরি সতর্ক করবে এবং ভালো বিকল্প দেখাবে।
- কখনো মিথ্যা তথ্য বানাবে না; নিশ্চিত না হলে স্পষ্টভাবে বলো।
- ইসলামি বিষয়ে কুরআন ও সহিহ হাদিসের আলোকে সতর্কতার সাথে উত্তর দাও এবং সূত্র উল্লেখ করো।

## ওয়েবসাইট ও কোড তৈরি (১ নম্বর অগ্রাধিকার — প্রথমবারেই প্রিমিয়াম, প্রোডাকশন-রেডি)
ব্যবহারকারী ওয়েবসাইট, পেজ, অ্যাপ, ল্যান্ডিং পেজ, ফর্ম, গেম বা যেকোনো কোড চাইলে:
- সম্পূর্ণতা (বাধ্যতামূলক): কোড পূর্ণাঙ্গ ও সরাসরি চালানো-যোগ্য হবে। "// বাকি কোড", "...", "এখানে যোগ করুন", placeholder বা খালি ফাংশন কঠোরভাবে নিষিদ্ধ। বিষয় অনুযায়ী যতটুকু প্রয়োজন ততটুকু সেকশন ও ফিচার দেবে, কিন্তু প্রতিটি ফিচার সত্যিই কাজ করবে। লেখা শেষ করার আগে নিজে যাচাই করবে কোড সম্পূর্ণ ও সুগঠিত কিনা।
- একটি একক ফাইলের সম্পূর্ণ HTML দেবে: \`<!DOCTYPE html>\` থেকে \`</html>\` পর্যন্ত; শুধু একটি \`\`\`html ব্লক।
- হেডারে Tailwind CSS CDN (<script src="https://cdn.tailwindcss.com"></script>), Hind Siliguri ও Inter ফন্ট (<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@300;400;500;600;700&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">), এবং tailwind.config দিয়ে বিষয়ের সাথে মানানসই একটি নিজস্ব ব্র্যান্ড রঙের প্যালেট সেট করবে।
- ডিজাইন মান (Lovable/Stripe/Apple মানের): সাধারণ টেমপ্লেট নয়। বড় সাহসী টাইপোগ্রাফি, প্রচুর হোয়াইট স্পেস, gradient/glass ইফেক্ট, নরম shadow, rounded-2xl কার্ড, hover ও scroll-reveal অ্যানিমেশন (IntersectionObserver), sticky ন্যাভবার ও মোবাইল হ্যামবার্গার মেনু, ডার্ক/লাইট মোড টগল।
- সেকশন: হিরো (শিরোনাম, সাবটাইটেল, CTA বাটন, ছবি), পরিসংখ্যান কাউন্টার, ফিচার/সার্ভিস গ্রিড, বিস্তারিত সেকশন, গ্যালারি, টেস্টিমোনিয়াল, FAQ অ্যাকর্ডিয়ন, যোগাযোগ ফর্ম (ভ্যালিডেশন ও সাফল্য বার্তা সহ), ফুটার। বিষয় অনুযায়ী প্রাসঙ্গিক সেকশন বাড়াবে।
- গ্রাহকের তথ্য সর্বোচ্চ অগ্রাধিকার (কঠোর): গ্রাহক যে প্রতিষ্ঠানের নাম, ঠিকানা, ফোন, ইমেইল, পণ্য, দাম, ফি, সময়সূচি, রঙ বা নির্দেশ দেবেন — হুবহু সেটাই ব্যবহার করবে, কিছু বাদ দেবে না, পরিবর্তন করবে না। গ্রাহক যা দেননি সেই ফোন নম্বর, ঠিকানা বা ইমেইল কখনো বানাবে না; সেখানে "[আপনার ফোন নম্বর]" ধরনের স্পষ্ট ঘর রাখবে। আল-আহসান ফাউন্ডেশনের নাম/ডোমেইন গ্রাহকের সাইটে বসাবে না।
- ব্যবসায়িক মডিউল (প্রাসঙ্গিক হলে সবগুলো, সম্পূর্ণ কার্যকর JS সহ): পণ্য/সেবা ক্যাটালগ ও রিয়েল অনলাইন অর্ডার কার্ট (যোগ/বাদ/পরিমাণ/মোট ৳, localStorage-এ সংরক্ষিত), চেকআউট ফর্ম ও বিকাশ/নগদ/রকেট/ক্যাশ অন ডেলিভারি পেমেন্ট সিমুলেটর (নম্বর ও TrxID ভ্যালিডেশন, অর্ডার নম্বরসহ কনফার্মেশন), স্কুল/মাদ্রাসা হলে ভর্তি বিজ্ঞপ্তি ও অনলাইন ভর্তি আবেদন ফর্ম, প্রচার/অফার সেকশন ও কাউন্টডাউন টাইমার, নোটিশ বোর্ড।
- ডিফল্ট রঙ (গ্রাহক অন্য রঙ না বললে): স্কাই/ওশান ব্লু প্রাইমারি #0284c7 (হালকা #38bdf8, গাঢ় #0369a1), সাদা ও হালকা আইস-ব্লু (#f0f9ff) ব্যাকগ্রাউন্ড, গাঢ় নেভি লেখা (#0f172a), দুই-রঙা শিরোনাম (একটি অংশ নীল), পিল ব্যাজ, rounded নীল প্রাইমারি ও সাদা সেকেন্ডারি বাটন।
- কঠোর নিষেধ: ন্যাভবারের উপরে কোনো ঘোষণা/জরুরি/হটলাইন টপ বার দেবে না; ভুয়া হটলাইন বা ০১৭০০-০০০০০০ ধরনের নকল নম্বর দেবে না।
- কার্যকারিতা: সব বাটন, মেনু, ট্যাব, ফিল্টার, সার্চ, ফর্ম, মডাল জাভাস্ক্রিপ্টে সত্যিই কাজ করবে; প্রয়োজনে localStorage-এ ডেটা সংরক্ষণ করবে। কোনো ডামি বা অচল লিংক নয়।
- ছবি: \`https://picsum.photos/seed/<প্রাসঙ্গিক-ইংরেজি-শব্দ>/1200/800\` ব্যবহার করবে (সবসময় লোড হয়); কল্পিত Unsplash ID ব্যবহার করবে না। প্রতিটি img-এ alt ও loading="lazy" দেবে।
- মোবাইল-ফার্স্ট: ৩৬০px স্ক্রিনেও কোনো আনুভূমিক স্ক্রল থাকবে না।
- কোডের শেষে শুধু লিখবে: "নিচে লাইভ লিংক দেওয়া হলো।" সিস্টেম স্বয়ংক্রিয়ভাবে স্থায়ী লাইভ লিংক তৈরি করে।`;

const INTEGRITY = `\n\n## সততা ও যাচাই প্রোটোকল (সব উত্তরে বাধ্যতামূলক)
- হাদিস/আয়াত/কিতাব/পৃষ্ঠা নম্বর কেবল নিশ্চিত হলে দেবে; না হলে বলবে "নির্দিষ্ট নম্বর নিশ্চিত নই, মূল কিতাবে যাচাই করুন"। কাল্পনিক সূত্র কঠোরভাবে নিষিদ্ধ।
- তথ্যের নিশ্চয়তা স্পষ্ট করবে: নিশ্চিত / সম্ভাব্য / অনিশ্চিত। জ্ঞানের সময়সীমার পরের ঘটনা হলে সেটা বলবে।
- অস্পষ্ট নির্দেশে বড় অনুমান না করে সবচেয়ে যুক্তিসঙ্গত অর্থ ধরবে এবং সেটি এক লাইনে জানিয়ে দেবে।
- কোড দিলে: এজ কেস, ইনফিনিট লুপ, নিরাপত্তা (ইনজেকশন, XSS, গোপন কী) ও পুরোনো/বাতিল লাইব্রেরি এড়াবে; সবসময় পূর্ণাঙ্গ কোড দেবে, কোনো অংশ কাটছাঁট করবে না।
- বাংলাদেশের প্রেক্ষাপট (টাকা ৳, স্থানীয় আইন, সংস্কৃতি, bKash/Nagad) অগ্রাধিকার পাবে।
- জটিল ফিকহি মাসআলা, চিকিৎসা, আইনি বা আর্থিক বড় সিদ্ধান্তে বিশেষজ্ঞ/আলেমের পরামর্শ নিতে বলবে।
- "যাচাইকৃত দীর্ঘমেয়াদী স্মৃতি" অংশের তথ্য মেনে চলবে, তবে ব্যবহারকারী নতুন করে ভিন্ন কিছু বললে সাম্প্রতিক নির্দেশ অগ্রাধিকার পাবে।

## পরিচিত সীমাবদ্ধতার প্রতিরক্ষা (সব উত্তরে মেনে চলবে)
- সাম্প্রতিক ঘটনা/নতুন লাইব্রেরি: নিশ্চিত না হলে বলবে তথ্য পুরোনো হতে পারে; ব্যবহারকারী লিংক দিলে সেটি পড়ে উত্তর দেবে। লাইব্রেরির সর্বশেষ স্থিতিশীল সিনট্যাক্স ব্যবহার করবে।
- ফোন, এসএমএস, ক্যামেরা বা সার্ভার চালানোর দাবি করবে না; বিকল্প হিসেবে চলনসই কোড বা লাইভ লিংক দেবে।
- দীর্ঘ উত্তর: কখনো "..." দিয়ে বাদ দেবে না, সব ট্যাগ ও কোড সম্পূর্ণ করবে।
- পাসওয়ার্ড, ব্যাংক/কার্ড তথ্য বা গোপন চাবি চাইবে না, সংরক্ষণ করবে না, উত্তরে পুনরাবৃত্তি করবে না।
- বাংলা: শুদ্ধ বানান ও যুক্তবর্ণ; ফিকহি পরিভাষার প্রচলিত অর্থ রাখবে, সন্দেহ হলে মূল আরবি শব্দ পাশে দেবে।
- গণিত ও বহুধাপী বিশ্লেষণে প্রতিটি ধাপ মনে মনে যাচাই করে চূড়ান্ত ফল দেবে।
- ছবি/ভিডিও সরাসরি দেখা না গেলে সৎভাবে জানাবে, অনুমান করে বর্ণনা দেবে না।
- উত্তরে সস্তা ইমোজি ব্যবহার করবে না; পরিচ্ছন্ন পেশাদার লেখা।

## ভাষা ও শিষ্টাচার
- সর্বদা ভদ্র, সম্মানজনক, আন্তরিক ও মার্জিত প্রাতিষ্ঠানিক বাংলায় কথা বলবে ("আপনি" সম্বোধন)। চাটুকারিতা ও কৃত্রিম রোবোটিক শব্দ বর্জন করবে।
- ইসলামি প্রশ্নে: আয়াতের ক্ষেত্রে সূরা ও আয়াত নম্বর, হাদিসের ক্ষেত্রে কিতাবের নাম ও হাদিস নম্বর এবং মান (সহিহ/হাসান/যঈফ) উল্লেখ করবে — কেবল নিশ্চিত হলে। ব্যক্তিগত ফতোয়া বা সংবেদনশীল মাসআলায় শেষে বিনয়ের সাথে স্থানীয় বিজ্ঞ মুফতি/আলেমের পরামর্শ নিতে বলবে।
- তুলনামূলক বা সংখ্যাভিত্তিক তথ্য হলে Markdown টেবিলে সাজিয়ে দেবে।

## ফলো-আপ প্রশ্ন (বাধ্যতামূলক)
- জটিল বা বিস্তারিত উত্তরের শেষে উপকারী হলে সর্বোচ্চ ৩টি প্রাসঙ্গিক প্রশ্ন নিচের ফরম্যাটে দেবে। ছোট উত্তর, সময়/পরিচয়, সম্ভাষণ বা ব্যর্থ অনুসন্ধানের পরে অপ্রয়োজনীয় প্রশ্ন যোগ করবে না:
[[প্রশ্ন: প্রথম প্রশ্ন]]
[[প্রশ্ন: দ্বিতীয় প্রশ্ন]]
[[প্রশ্ন: তৃতীয় প্রশ্ন]]
- সম্পূর্ণ HTML ওয়েবসাইট কোড দেওয়ার উত্তরেও কোড ব্লক বন্ধ হওয়ার পরে এগুলো দেবে।`;

const NO_SOURCE_REPLY =
  "অনলাইনে এই বিষয়ের যাচাইযোগ্য সূত্র এখন পাওয়া যায়নি, তাই উত্তরটি অনুমান করে দিচ্ছি না। প্রশ্নটি একটু নির্দিষ্ট করে আবার লিখুন, অথবা প্রতিবেদনের লিংক দিন — সেটি পড়ে উত্তর দেওয়ার চেষ্টা করব।";

// ============================================================
// Intent routing (কোন প্রশ্নে অনলাইন সার্চ হবে, কোনটিতে নয়)
// ============================================================
type Intent = "image" | "site_form" | "site" | "code" | "writing" | "geo" | "web" | "general";

const BN_END = "(?![\\u0980-\\u09FF])";
const GREET_RE = /^\s*(হাই|হাই।|হ্যালো|হেলো|হায়|হ্যাঁলো|hi|hello|hey|yo|assalamu\s*alaikum|আসসালামু\s*আলাইকুম|আসসালাম|সালাম|good (morning|evening|afternoon))[\s!.?।,…]*$/i;
const THANKS_RE = /^\s*(ধন্যবাদ|ধন্যবাদ।|thanks|thank you|ok|ওকে|আচ্ছা|ঠিক আছে)[\s!.?।]*$/i;
const SMALLTALK_RE = /(কেমন আছ|কেমন আছেন|তুমি কে|আপনি কে|তোমার নাম|আপনার নাম|কী করছ|কি করছ|কী করছেন|কি করছেন|কে (বানি|তৈরি)|(তোমার|আপনার) (মডেল|নাম)|how are you|who are you|what'?s your name)/i;
const SITE_RE = /ওয়েবসাইট|ওয়েব ?সাইট|website|landing ?page|html|ল্যান্ডিং|হোমপেজ|অ্যাপ বানা|চ্যাট ?বট বানা|ফর্ম বানা/i;
const BIZ_RE = /ব্যবসা|দোকান|কোম্পানি|কোম্পানী|প্রতিষ্ঠান|স্কুল|মাদ্রাসা|কলেজ|রেস্তোরাঁ|হোটেল|ক্লিনিক|হাসপাতাল|শোরুম|business|shop|company|school|store|agency/i;
const CODE_RE = /কোড|code|প্রোগ্রাম|ফাংশন|function|বাগ|bug|debug|টাইপস্ক্রিপ্ট|জাভাস্ক্রিপ্ট|typescript|javascript|python|react|sql|রিফ্যাক্টর/i;
const WRITE_RE = /লেখ|লিখ|রচনা|গল্প|কবিতা|প্রবন্ধ|চিঠি|ভাষণ|সাহিত্য|অনুবাদ|translate|সারাংশ|summar|ব্লগ|ক্যাপশন|caption|স্লোগান/i;
const GEO_RE = /নামাজ|নামায|কিবলা|কেবলা|মসজিদ|সেহরি|ইফতার|qibla|mosque|prayer time/i;
const MATH_RE = /অংক|গণিত|সমীকরণ|হিসাব|[০-৯0-9]\s*[+\-*/×÷^]\s*[০-৯0-9]/;
const VERIFY_RE = /যাচাই|verify|সার্চ|খুঁজ|অনুসন্ধান|অনলাইন|ইন্টারনেট|ইন্টারনেট|search|google/i;
const LIVE_RE = /আজ|এখন|এখনকার|এখনই|বর্তমান|সর্বশেষ|সাম্প্রতিক|সম্প্রতি|খবর|সংবাদ|নির্বাচন|পদত্যাগ|দাম|বাজার ?দর|রেট|আবহাওয়া|বৃষ্টি|তাপমাত্রা|ফলাফল|রেজাল্ট|স্কোর|লাইভ|পরীক্ষা|ভর্তি|নোটিশ|বিজ্ঞপ্তি|প্রজ্ঞাপন|আগামীকাল|latest|today|tonight|tomorrow|news|price|weather|score|current|result|election|exam|admission|notice/i;
const FACT_RE = new RegExp(
  `(কী|কি|কে|কবে|কোথায়|কোথাও|কত|কেন|কিভাবে|কীভাবে|কোন|কোনো|কয়টা|কখন|কতদূর|কতটা|দূরত্ব|কাছে|ঠিকানা|সিলেবাস|পাঠ্যবই|রোগ|জ্বর|ওষুধ|উপসর্গ|চিকিৎসা|আইন|নিয়ম|তথ্য|ঘটনা|ঘটেছে)${BN_END}|\\?|what|who|when|where|how|which|why`,
  "i"
);
const EDU_RE = /শিক্ষা|পড়া|পড়াশোনা|পাঠ|সিলেবাস|পরীক্ষা|ক্লাস|শ্রেণী|শ্রেণি|অধ্যায়|বই|বিষয়|শেখ|শিখ|শিক্ষক|বিশ্ববিদ্যালয়/;
const NEWS_RE = /খবর|সংবাদ|news|আজকের|আজকে|আজ\b|সর্বশেষ|latest|today/i;
const URL_RE = /https?:\/\//;

function classify(text: string, hasImage: boolean): Intent {
  const t = text.trim();
  if (!hasImage && wantsImage(t)) return "image";
  if (!t) return "general";
  if (GEO_RE.test(t)) return "geo";
  if (SITE_RE.test(t)) return BIZ_RE.test(t) && t.length < 300 && !/\d{5,}|@/.test(t) ? "site_form" : "site";
  if (CODE_RE.test(t)) return "code";
  if (WRITE_RE.test(t)) return "writing";
  if (URL_RE.test(t)) return "general"; // লিংকের পেজই সূত্র; আলাদা সার্চ লাগে না
  if (MATH_RE.test(t) || SMALLTALK_RE.test(t) || isClockQuestion(t)) return "general";
  if (VERIFY_RE.test(t) || LIVE_RE.test(t) || FACT_RE.test(t)) return "web";
  return "general";
}

function instantReply(t: string): string | null {
  const x = t.trim();
  if (!x || x.length > 40) return null;
  if (/^(আসসালামু|আসসালাম|সালাম|assalam)/i.test(x)) return "ওয়ালাইকুমুস সালাম। বলুন, কীভাবে সাহায্য করতে পারি?";
  if (GREET_RE.test(x)) return "হ্যালো! আমি আল আহসান এআই। কীভাবে সাহায্য করতে পারি?";
  if (THANKS_RE.test(x)) return "আপনাকে স্বাগতম। আরও কিছু লাগলে বলুন।";
  return null;
}

function intentNote(intent: Intent, text: string): string {
  if (intent === "site_form")
    return `\n\n=== এই অনুরোধের নির্দেশ (বাধ্যতামূলক) ===\nব্যবহারকারী ব্যবসার ওয়েবসাইট চেয়েছেন কিন্তু প্রয়োজনীয় তথ্য দেননি। এখন কোনো কোড লিখবে না। একটি পরিষ্কার ফর্ম দেখাও: নম্বর দেওয়া তালিকায় প্রতিষ্ঠানের নাম, কাজের ধরন, ঠিকানা, ফোন, ইমেইল, প্রধান পণ্য/সেবা ও দাম, খোলার সময়, পছন্দের রঙ, লোগো/ছবি আছে কিনা, এবং প্রয়োজনীয় পাতা (যেমন ফর্ম, গ্যালারি, অর্ডার, ভর্তি)। শেষে লিখবে: "এগুলো পূরণ করে পাঠালে আমি সম্পূর্ণ ওয়েবসাইট বানিয়ে দেব।"`;
  if (intent === "writing")
    return `\n\n=== লেখালেখির নির্দেশ ===\nসাহিত্যিক, সুন্দর ও প্রাঞ্জল বাংলায় লেখো। বিষয়বস্তু একাধিক অংশে থাকলে সুবিন্যস্ত পয়েন্ট বা শিরোনাম ব্যবহার করো।`;
  if (intent === "geo")
    return `\n\nব্যবহারকারী নামাজ/কিবলা/মসজিদ সংক্রান্ত তথ্য চেয়েছেন। নির্দেশ: অ্যাপের "নামাজ ও কিবলা" পাতা (/salat) খুললে জিপিএস দিয়ে সঠিক নামাজের সময়, সেহরি-ইফতার, কিবলার দিক ও নিকটস্থ মসজিদ দেখা যাবে — এটি বিনয়ের সাথে জানাবে। অবস্থান না জেনে নির্দিষ্ট সময় বা দূরত্ব অনুমান করবে না।`;
  if (EDU_RE.test(text))
    return `\n\n=== শিক্ষার নির্দেশ ===\nসহজ বাংলায়, সরাসরি উত্তর দিয়ে শুরু করো, তারপর ধাপে ধাপে সহজ ব্যাখ্যা দাও। ব্যবহারকারীর প্রশ্ন সহজভাবে বুঝে উত্তর দাও।`;
  return "";
}

// ============================================================
// Route
// ============================================================
export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async (ctx) => {
        try {
          return await handleChat(ctx.request);
        } catch (e) {
          console.error("chat failed", e);
          return new Response("উত্তর তৈরি করা যায়নি। একটু পরে আবার চেষ্টা করুন।", { status: 503 });
        }
      },
    },
  },
});

// সার্ভার মেমোরি ক্যাশ (৬০ সেকেন্ড)
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

// ============================================================
// Models & providers
// ============================================================
const GW_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GOOGLE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

// সর্বোচ্চ শক্তিশালী প্রথমে; ব্যস্ত/ব্যর্থ হলে পরেরটি স্বয়ংক্রিয়ভাবে
const GEMINI_LADDER = ["gemini-3.1-pro-preview", "gemini-3.8-flash", "gemini-3-flash-preview", "gemini-3.1-flash-lite"];
const GEMINI_GW = GEMINI_LADDER.map((m) => `google/${m}`);

type Attempt = { url: string; key: string; model: string; label: string; budget: number };
type FirstChunk = { ok: boolean; body?: ReadableStream<Uint8Array>; status: number; text: string };

/** প্রথম টোকেন না আসা পর্যন্ত সময়সীমা; সময় পার হলে বা ত্রুটি হলে false — পরের মডেলে যাবে। */
async function firstChunk(a: Attempt, payload: Record<string, unknown>): Promise<FirstChunk> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), a.budget);
  try {
    const res = await fetch(a.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${a.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, model: a.model }),
      signal: ac.signal,
    });
    if (!res.ok || !res.body) {
      return { ok: false, status: res.status, text: (await res.text().catch(() => "")).slice(0, 500) };
    }
    const reader = res.body.getReader();
    const first = await reader.read();
    if (first.done || !first.value?.length) {
      reader.cancel().catch(() => {});
      return { ok: false, status: 502, text: "empty stream" };
    }
    clearTimeout(timer); // প্রথম টোকেন এসেছে — এখন থেকে স্ট্রিম আর কাটবে না
    const head = first.value;
    let sent = false;
    const body = new ReadableStream<Uint8Array>({
      pull: async (c) => {
        if (!sent) {
          sent = true;
          c.enqueue(head);
          return;
        }
        try {
          const r = await reader.read();
          if (r.done) c.close();
          else c.enqueue(r.value!);
        } catch (e) {
          c.error(e);
        }
      },
      cancel: () => {
        reader.cancel().catch(() => {});
      },
    });
    return { ok: true, body, status: 200, text: "" };
  } catch (e: any) {
    const aborted = e?.name === "AbortError";
    return { ok: false, status: aborted ? 504 : 502, text: aborted ? "timeout" : String(e?.message ?? e) };
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================
// Main handler
// ============================================================
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
  const msgs0 = parsed.data.messages;
  const lastMsg = msgs0[msgs0.length - 1]!;
  const lastUser = String(lastMsg.content ?? "");
  const hasImage = Boolean(lastMsg.image || (lastMsg.images && lastMsg.images.length));
  const intent = classify(lastUser, hasImage);
  const deep = intent === "code" || intent === "site" || intent === "site_form" || intent === "writing" || lastUser.length > 500;
  const todayIso = new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10); // ঢাকা সময়ের তারিখ

  // অনলাইন সার্চ শুরু — শুধু প্রয়োজন হলে; সেটিংস/কোটার অপেক্ষায় সমান্তরালে চলবে
  const searchP = intent === "web" ? gatherWeb(cleanQuery(lastUser), NEWS_RE.test(lastUser), todayIso) : null;

  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86400_000).toISOString();
  const [{ s, keys }, { data: isAdmin }, { count: h }, { count: d }, ctx] = await Promise.all([
    getCachedSettingsAndKeys(supabaseAdmin),
    supabaseAdmin.rpc("has_role", { _user_id: uid, _role: "admin" }),
    supabaseAdmin.from("chat_usage").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", hourAgo),
    supabaseAdmin.from("chat_usage").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", dayAgo),
    loadContext(uid, supabaseAdmin, deep),
  ]);

  if (s && s.chat_enabled === false && !isAdmin)
    return new Response("চ্যাট সাময়িকভাবে বন্ধ আছে। একটু পরে আবার চেষ্টা করুন।", { status: 503 });
  if (!isAdmin) {
    if ((h ?? 0) >= (s?.hourly_limit ?? 30))
      return new Response(`এক ঘণ্টায় সর্বোচ্চ ${s?.hourly_limit ?? 30}টি প্রশ্ন করা যায়। কিছুক্ষণ পর আবার চেষ্টা করুন।`, { status: 429 });
    if ((d ?? 0) >= (s?.daily_limit ?? 150))
      return new Response(`আজকের সীমা (${s?.daily_limit ?? 150}টি প্রশ্ন) শেষ। আগামীকাল আবার চেষ্টা করুন।`, { status: 429 });
  }

  // সম্ভাষণ: মডেল ছাড়াই তাৎক্ষণিক উত্তর (কোনো সার্চ নেই, কোটাও খরচ হয় না)
  if (!hasImage) {
    const quickReply = instantReply(lastUser);
    if (quickReply) {
      if (searchP) searchP.catch(() => {});
      return stageStream([], async () => quickReply);
    }
  }

  // ---------- provider ও মডেল-তালিকা ----------
  const provider = (s?.provider ?? "lovable") as Provider;
  const stored = String(s?.model ?? "").trim();
  const pickedModel =
    provider === "lovable" && parsed.data.model && LOVABLE_MODELS.some((m) => m.id === parsed.data.model) ? parsed.data.model : null;
  const gatewayKey = process.env["LOVABLE_API_KEY"] ?? null;
  const googleKey = keys?.google_key?.trim() || process.env["GOOGLE_API_KEY"] || null;
  const openaiKey = keys?.openai_key?.trim() || process.env["OPENAI_API_KEY"] || null;
  const openaiModel = OPENAI_MODELS.some((m) => m.id === stored) ? stored : DEFAULT_MODELS.openai;
  const hasImageMsg = msgs0.some((_, i) => imgsOf(msgs0, i).length > 0);

  const attempts: Attempt[] = [];
  if (provider === "openai" && openaiKey) attempts.push({ url: OPENAI_URL, key: openaiKey, model: openaiModel, label: "openai", budget: 0 });
  if (googleKey && !pickedModel && provider !== "openai")
    for (const m of GEMINI_LADDER) attempts.push({ url: GOOGLE_URL, key: googleKey, model: m, label: "google", budget: 0 });
  if (gatewayKey) {
    const ladder = [...new Set([...(pickedModel ? [pickedModel] : []), ...GEMINI_GW])];
    for (const m of ladder) attempts.push({ url: GW_URL, key: gatewayKey, model: m, label: "gateway", budget: 0 });
  }
  // নিজস্ব কাস্টম এন্ডপয়েন্ট (অ্যাডমিন কী-পুল) — শুধু লেখা অনুরোধে, ছবি থাকলে বাদ
  type PoolKey = { name?: string; provider?: string; key?: string; base_url?: string; model?: string; active?: boolean };
  const pool = (Array.isArray((keys as { key_pool?: unknown })?.key_pool) ? (keys as { key_pool: PoolKey[] }).key_pool : [])
    .filter((p) => p && p.active !== false && p.key?.trim());
  if (!hasImageMsg)
    for (const p of pool)
      if (p.provider === "custom" && p.base_url?.startsWith("https://"))
        attempts.push({ url: p.base_url.replace(/\/$/, "") + "/chat/completions", key: p.key!.trim(), model: p.model?.trim() || DEFAULT_MODELS.lovable, label: p.name || "custom", budget: 0 });

  if (!attempts.length) return new Response("এই মোডের এপিআই কী সেট করা নেই। অ্যাডমিন প্যানেলে কী বসান।", { status: 503 });
  attempts.forEach((a, i) => {
    a.budget = i === 0 ? (deep ? 12000 : 3500) : deep ? 10000 : 3000;
  });

  // প্রকৃত সময়/নির্বাচিত মডেলের তথ্য — মডেল ছাড়াই
  const fact = directSessionFact(lastUser, attempts[0]!.model);
  if (fact) return stageStream([], async () => fact);

  // ---------- কোটা সংরক্ষণ (ব্যর্থ হলে ফেরত) ----------
  const { data: usageRow, error: usageErr } = await supabaseAdmin.from("chat_usage").insert({ user_id: uid }).select("id").single();
  if (usageErr) console.error("usage reserve failed", usageErr.message);
  const usageId: string | null = usageRow?.id ?? null;
  const refund = () => {
    if (usageId) void supabaseAdmin.from("chat_usage").delete().eq("id", usageId).then(() => undefined, () => undefined);
  };

  // ---------- সিস্টেম প্রম্পট ----------
  const stages: string[] = ["think"];
  let system = PERSONA + "\n\n" + BASE_PROMPT;
  if (s?.system_prompt?.trim()) system += `\n\n=== অতিরিক্ত সিস্টেম নির্দেশনা ===\n${s.system_prompt.trim()}`;
  if (s?.site_builder === false) system += "\n\nএখন ওয়েবসাইট তৈরির সুবিধা বন্ধ আছে।";
  system += intentNote(intent, lastUser);

  // ---------- ছবি তৈরি ----------
  if (intent === "image" && gatewayKey) {
    return stageStream(["think", "image"], async () => {
      const img = await generateImage(gatewayKey, lastUser);
      if (!img) {
        refund();
        return "দুঃখিত, এই মুহূর্তে ছবি তৈরি করা যায়নি। একটু পরে আবার চেষ্টা করুন বা বর্ণনা একটু বদলে দিন।";
      }
      return `ছবি তৈরি হয়েছে:\n\n![তৈরি করা ছবি](${img})`;
    });
  }

  // ---------- অনলাইন সূত্র ----------
  let webBlock = "";
  if (intent === "web" && searchP) {
    stages.push("search");
    webBlock = await searchP;
    if (!webBlock) {
      refund();
      return stageStream(["search"], async () => NO_SOURCE_REPLY);
    }
    stages.push("verify");
    system += `\n\n=== অনলাইন সূত্র (যাচাইকৃত; অনুসন্ধানের তারিখ: ${todayIso}, ঢাকা) ===\n${webBlock}\n\nনির্দেশ: শুধু এই সূত্রগুলোর তথ্যের ভিত্তিতে উত্তর দেবে। সূত্রে না থাকা তথ্য যোগ করবে না, অনুমান করবে না। সূত্রগুলোর মধ্যে বিরোধ থাকলে জানাবে। সূত্রে তথ্য না থাকলে বলবে "নিশ্চিত তথ্য পাইনি"। উত্তরের শেষে "সূত্র:" শিরোনামে ব্যবহৃত লিংকগুলো তালিকা করবে।`;
  }
  if (intent === "code" || intent === "site" || intent === "site_form") stages.push("code");
  if (intent === "geo") stages.unshift("geo");

  // ---------- পেজ পড়া (লিংক থাকলে) ----------
  const textMsgs = msgs0.map((m) => ({ role: m.role, content: m.content }));
  if (s?.url_reader !== false && URL_RE.test(lastUser)) {
    const web = await readUrls(lastUser);
    if (web) {
      const lastIdx = textMsgs.length - 1;
      textMsgs[lastIdx] = { role: textMsgs[lastIdx]!.role, content: `${lastUser}\n\n=== ওয়েব পেজের লেখা ===\n${web}` };
    }
  }

  // ---------- ছবি সংযুক্তি ----------
  const msgs: { role: string; content: unknown }[] = textMsgs.map((m, i) => {
    const imgs = imgsOf(msgs0, i);
    if (m.role !== "user" || !imgs.length) return m;
    return {
      role: m.role,
      content: [{ type: "text", text: m.content || "এই ছবিগুলো বিশ্লেষণ করুন।" }, ...imgs.map((url) => ({ type: "image_url", image_url: { url } }))],
    };
  });
  if (hasImageMsg)
    system += "\n\nব্যবহারকারী এক বা একাধিক ছবি পাঠিয়েছেন। প্রতিটি ছবি মনোযোগ দিয়ে দেখে বিস্তারিত বর্ণনা, লেখা থাকলে হুবহু পাঠ (OCR) ও বিশ্লেষণ দাও। ওয়েবসাইট তৈরির অনুরোধ হলে ছবিগুলোকে ডিজাইন/তথ্যের রেফারেন্স হিসেবে মেনে চলবে এবং ছবিতে থাকা নাম, ঠিকানা, ফোন, পণ্য, দাম হুবহু ব্যবহার করবে।";

  if (s?.admin_note?.trim()) system += `\n\n=== অ্যাডমিনের নির্দেশনা (সর্বোচ্চ অগ্রাধিকার — অবশ্যই মেনে চলবে) ===\n${s.admin_note.trim()}`;
  system += INTEGRITY;
  system += `\n\n=== বর্তমান সময় ===\n${clockContext()}`;
  system += `\n\n=== চার্ট নির্দেশনা ===\nযখন উত্তরে তুলনামূলক সংখ্যা, পরিসংখ্যান, বছরভিত্তিক পরিবর্তন বা শতাংশ থাকে, তখন একটি চার্ট যুক্ত করবে। ফরম্যাট ঠিক এরকম (\`\`\`chart কোড ব্লকে বৈধ JSON):\n\`\`\`chart\n{"type":"bar","title":"শিরোনাম","data":[{"name":"ক","value":10},{"name":"খ","value":20}]}\n\`\`\`\ntype হতে পারে "bar", "line" বা "pie"। শুধু বাস্তব/যাচাইকৃত সংখ্যা ব্যবহার করবে, কাল্পনিক সংখ্যা নয়।`;

  if (ctx.items.length)
    system += `\n\n=== এই ব্যবহারকারী সম্পর্কে সংরক্ষিত স্মৃতি (সব চ্যাটে প্রযোজ্য, অবশ্যই মনে রাখবে) ===\n${ctx.items.map((m) => "- " + m.text).join("\n")}`;
  if (ctx.recent?.length)
    system += `\n\n=== এই ব্যবহারকারীর আগের চ্যাটগুলোতে সাম্প্রতিক কথা (প্রসঙ্গ মনে রাখতে ব্যবহার করবে) ===\n${[...ctx.recent].reverse().map((r) => "- " + String(r.content).slice(0, 200).replace(/\s+/g, " ")).join("\n")}`;

  system += isAdmin
    ? `\n\n=== সেশন তথ্য (সার্ভার-যাচাইকৃত) ===\nএই ব্যবহারকারী তোমার অ্যাডমিন (${u.user.email})।${u.user.email === "alahsanfoundation.info@gmail.com" ? " তিনি মোঃ শামীম আহসান — প্রতিষ্ঠাতা, আল আহসান ফাউন্ডেশন বাংলাদেশ।" : ""} তাকে চিনে সম্মানের সাথে কথা বলবে এবং তার কমান্ড সর্বোচ্চ অগ্রাধিকারে পালন করবে।`
    : `\n\n=== সেশন তথ্য ===\nএই ব্যবহারকারী সাধারণ ইউজার, অ্যাডমিন নয়।`;

  // ---------- মডেল কল (প্রথম টোকেন না এলে পরের মডেলে স্বয়ংক্রিয় স্থানান্তর) ----------
  const validEffort = ["low", "medium", "high", "xhigh"].includes(String(s?.reasoning_effort)) ? String(s?.reasoning_effort) : deep ? "medium" : "low";
  const payloadFor = (a: Attempt): Record<string, unknown> => {
    const p: Record<string, unknown> = {
      stream: true,
      messages: [{ role: "system", content: `${system}\n\n=== এই অনুরোধের সত্যতা ও আচরণ ===\n${evidencePolicy(a.model)}` }, ...msgs],
    };
    p[a.label === "openai" ? "max_completion_tokens" : "max_tokens"] = deep ? 65536 : 4096;
    if (a.label === "gateway" && a.model.startsWith("openai/gpt-5.6")) p["reasoning_effort"] = "none";
    if (a.label === "gateway" && a.model === "openai/gpt-6-astra") p["reasoning_effort"] = validEffort;
    return p;
  };

  let upstream: ReadableStream<Uint8Array> | null = null;
  let usedIndex = -1;
  let lastErr: { status: number; text: string } = { status: 502, text: "" };
  for (let i = 0; i < attempts.length; i++) {
    const a = attempts[i]!;
    const r = await firstChunk(a, payloadFor(a));
    if (r.ok && r.body) {
      upstream = r.body;
      usedIndex = i;
      break;
    }
    lastErr = { status: r.status, text: r.text };
    console.error(`model "${a.model}" via ${a.label} failed [${r.status}]: ${r.text.slice(0, 200)}`);
  }

  if (!upstream) {
    refund();
    return new Response(friendlyError(lastErr.status, lastErr.text), {
      status: lastErr.status >= 500 || !lastErr.status ? 502 : lastErr.status,
    });
  }

  if (usedIndex > 0) stages.push("fallback");
  stages.push("write");
  return withStages(stages, upstream);
}

// ============================================================
// Helpers: context, images, errors
// ============================================================
function imgsOf(msgs: { image?: string; images?: string[] }[], i: number): string[] {
  const m = msgs[i];
  return [...(m?.images ?? []), ...(m?.image ? [m.image] : [])].slice(0, 5);
}

async function loadContext(uid: string, supabaseAdmin: any, deep: boolean): Promise<{ items: { text: string }[]; recent: { content: string }[] | null }> {
  try {
    const mem = await import("@/lib/memory.server");
    const [items, rec] = await Promise.all([
      mem.loadMemory(uid, 60),
      deep
        ? supabaseAdmin.from("messages").select("content,created_at").eq("user_id", uid).eq("role", "user").order("created_at", { ascending: false }).limit(15)
        : Promise.resolve({ data: null }),
    ]);
    return { items, recent: rec.data };
  } catch (e) {
    console.error("memory load failed", e);
    return { items: [], recent: null };
  }
}

function friendlyError(status: number, text: string): string {
  if (text === "timeout") return "এই মুহূর্তে এআই সেবা ব্যস্ত, তাই উত্তর আসতে দেরি হচ্ছে। একটু পরে আবার চেষ্টা করুন।";
  if ([402, 429, 503].includes(status)) return serviceError(status, text);
  const t = text.toLowerCase();
  if (status === 402 || /credit|balance|billing|funds|out of credits/.test(t))
    return "এআই সেবার অ্যাকাউন্টে পর্যাপ্ত ব্যালান্স বা কোটা নেই। অ্যাডমিন প্যানেলে নতুন কী সংযুক্ত করুন।";
  if (status === 429 || /rate.*limit|too many requests|resource_exhausted|quota/.test(t))
    return "সার্ভারে এই মুহূর্তে অতিরিক্ত অনুরোধের চাপ রয়েছে। অনুগ্রহ করে এক মিনিট পর আবার চেষ্টা করুন।";
  if (status === 401 || status === 403 || /api key|unauthorized|permission/.test(t))
    return "এআই এপিআই কী যাচাইকরণে সমস্যা হয়েছে। অ্যাডমিন প্যানেলে সঠিক কী নিশ্চিত করুন।";
  if (status >= 500) return "এআই সেবাদাতা সার্ভারে সাময়িক বিভ্রাট চলছে। কিছুক্ষণ পর আবার চেষ্টা করার অনুরোধ করা হলো।";
  return `অনুরোধটি সম্পন্ন করা যায়নি (স্ট্যাটাস: ${status})। কিছুক্ষণ পর পুনরায় চেষ্টা করুন।`;
}

// ============================================================
// Safe URL reader (SSRF-protected)
// ============================================================
function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return true;
  if (h === "metadata.google.internal" || h === "::1" || h === "::" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
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

// ============================================================
// SSE output (client protocol: {stage} events, then OpenAI-style deltas, then [DONE])
// ============================================================
const enc = new TextEncoder();
const sse = (o: unknown) => enc.encode(`data: ${JSON.stringify(o)}\n\n`);
const SSE_HEADERS = { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" };

function withStages(stages: string[], upstream: ReadableStream<Uint8Array>): Response {
  const r = upstream.getReader();
  let closed = false;
  const push = (c: ReadableStreamDefaultController<Uint8Array>, v: Uint8Array) => {
    if (closed) return;
    try {
      c.enqueue(v);
    } catch {
      closed = true;
    }
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
        try {
          c.close();
        } catch {}
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
        try {
          c.enqueue(v);
          return true;
        } catch {
          return false;
        }
      };
      for (const st of stages) push(sse({ stage: st }));
      let text = "";
      try {
        text = await work();
      } catch {
        text = "কাজটি সম্পন্ন করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।";
      }
      if (push(sse({ choices: [{ delta: { content: text } }] }))) push(enc.encode("data: [DONE]\n\n"));
      try {
        c.close();
      } catch {}
    },
  });
  return new Response(body, { headers: SSE_HEADERS });
}

// ============================================================
// Image generation
// ============================================================
function wantsImage(t: string): boolean {
  return (
    /(ছবি|চিত্র|লোগো|পোস্টার|ব্যানার|image|picture|photo|logo|poster|illustration|drawing)/i.test(t) &&
    /(বানা|তৈরি|আঁক|এঁকে|জেনারেট|generate|create|draw|make|design)/i.test(t) &&
    !/(ওয়েবসাইট|website|html|কোড|code)/i.test(t)
  );
}

async function generateImage(key: string, prompt: string): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai/gpt-image-2", prompt: prompt.slice(0, 3000), size: "1024x1024", n: 1 }),
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

// ============================================================
// Web search: সব উৎস একসাথে, সর্বোচ্চ সময়সীমা পর্যন্ত যা আসে তা ব্যবহার
// ============================================================
const SEARCH_BUDGET_MS = 4000;
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

type Hit = { title: string; url: string; snip: string };
const clip = (s: string, n: number) => s.replace(/\s+/g, " ").trim().slice(0, n);
const stripHtml = (x: string) =>
  x.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/\s+/g, " ").trim();

function cleanQuery(t: string): string {
  return t.replace(/[?？।!]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
}

async function tavilyHits(q: string): Promise<Hit[]> {
  const key = process.env["TAVILY_API_KEY"]?.trim();
  if (!key) return [];
  const r = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: key, query: q.slice(0, 300), max_results: 5, search_depth: "basic" }),
    signal: AbortSignal.timeout(SEARCH_BUDGET_MS),
  }).catch(() => null);
  if (!r?.ok) return [];
  const data = (await r.json().catch(() => null)) as { results?: { url: string; title: string; content: string }[] } | null;
  return (data?.results ?? []).map((it) => ({ title: clip(it.title || "", 200), url: it.url, snip: clip(it.content || "", 400) }));
}

async function ddgHits(q: string): Promise<Hit[]> {
  const r = await fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "text/html",
      "Accept-Language": "bn-BD,bn;q=0.9,en;q=0.8",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `q=${encodeURIComponent(q.slice(0, 200))}&kl=bd-en`,
    signal: AbortSignal.timeout(SEARCH_BUDGET_MS),
  }).catch(() => null);
  if (!r?.ok) return [];
  const html = await r.text();
  const out: Hit[] = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 6) {
    let u = m[1]!;
    const uddg = /uddg=([^&]+)/.exec(u);
    if (uddg) u = decodeURIComponent(uddg[1]!);
    if (!/^https?:/.test(u)) continue;
    out.push({ url: u, title: clip(stripHtml(m[2]!), 200), snip: clip(stripHtml(m[3]!), 400) });
  }
  return out;
}

async function bingHits(q: string): Promise<Hit[]> {
  const r = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(q.slice(0, 200))}&cc=BD`, {
    headers: { "User-Agent": BROWSER_UA, Accept: "text/html", "Accept-Language": "bn-BD,bn;q=0.9,en;q=0.8" },
    signal: AbortSignal.timeout(SEARCH_BUDGET_MS),
  }).catch(() => null);
  if (!r?.ok) return [];
  const html = await r.text();
  const out: Hit[] = [];
  for (const block of html.split('<li class="b_algo"').slice(1)) {
    const a = /<h2[^>]*>\s*<a[^>]+href="(https?:[^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(block);
    if (!a) continue;
    const p = /<p[^>]*>([\s\S]*?)<\/p>/.exec(block);
    out.push({ url: a[1]!.replace(/&amp;/g, "&"), title: clip(stripHtml(a[2]!), 200), snip: p ? clip(stripHtml(p[1]!), 400) : "" });
    if (out.length >= 6) break;
  }
  return out;
}

async function newsHits(q: string, todayOnly: boolean): Promise<Hit[]> {
  const query = q.replace(/আজকের|আজকে|খবর বলুন|খবর দাও|কী|কি|\?/g, " ").trim() || "বাংলাদেশ";
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent((query + " when:2d").slice(0, 150))}&hl=bn&gl=BD&ceid=BD:bn`;
  const r = await fetch(rssUrl, { headers: { "User-Agent": BROWSER_UA }, signal: AbortSignal.timeout(SEARCH_BUDGET_MS) }).catch(() => null);
  if (!r?.ok) return [];
  const block = parseNewsRss(await r.text(), new Date(), todayOnly);
  return block ? [{ title: "Google News (সাম্প্রতিক শিরোনাম)", url: rssUrl, snip: clip(block, 1500) }] : [];
}

async function gatherWeb(q: string, news: boolean, todayIso: string): Promise<string> {
  const hits: Hit[] = [];
  const seen = new Set<string>();
  const take = (hs: Hit[]) => {
    for (const h of hs) {
      if (!h.url || seen.has(h.url)) continue;
      seen.add(h.url);
      hits.push(h);
    }
  };
  const query = news ? `${q} ${todayIso}` : q;
  const jobs: Promise<void>[] = [
    tavilyHits(query).then(take, () => {}),
    ddgHits(query).then(take, () => {}),
    bingHits(query).then(take, () => {}),
  ];
  if (news) jobs.push(newsHits(q, /আজ|today/i.test(q)).then(take, () => {}));
  await Promise.race([Promise.all(jobs), new Promise<void>((r) => setTimeout(r, SEARCH_BUDGET_MS))]);
  return hits
    .slice(0, 8)
    .map((h, i) => `[${i + 1}] ${h.title}\n${h.url}\n${h.snip}`)
    .join("\n\n");
}
