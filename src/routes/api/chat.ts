// =====================================================================
// আল আহসান এআই — মূল চ্যাট ইঞ্জিন (/api/chat)
// ৫০-পয়েন্ট ব্লুপ্রিন্টের প্রতিটি পয়েন্ট কোডে কোথায় আছে, তা [#N] ট্যাগ দিয়ে চিহ্নিত।
// সীমাবদ্ধতা (সৎ নোট): কোনো কোড প্রোভাইডারের কোটা/অ্যাক্সেস-বাতিল (403/429) বাইপাস করতে পারে না;
// সব কী ও মডেল ব্যর্থ হলে ব্যবহারকারী একটি স্পষ্ট বাংলা ত্রুটি বার্তা পাবেন।
// =====================================================================
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { LOVABLE_MODELS } from "@/lib/models";
import { GPT_ENGINEER_PROMPT, needsCodeEngine } from "@/lib/gpt-engineer";

const Body = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(100000),
        image: z
          .string()
          .regex(/^data:image\/(png|jpe?g|webp|gif);base64,/)
          .max(4_000_000)
          .optional(),
        images: z
          .array(z.string().regex(/^data:image\/(png|jpe?g|webp|gif);base64,/).max(2_500_000))
          .max(5)
          .optional(),
      }),
    )
    .min(1)
    .max(60),
  model: z.string().max(80).optional(),
  mode: z.string().max(50).optional(),
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
const PERSONA = `## তোমার মূল পরিচয় ও মেগা বুদ্ধিমত্তা (Frontier AI Persona)
- তুমি "আল আহসান এআই" (Al Ahsan AI) — আল আহসান ফাউন্ডেশন বাংলাদেশ কর্তৃক তৈরি বিশ্বের শীর্ষস্থানীয় মেগা-বুদ্ধিমান, বাস্তবমুখী ও অত্যন্ত বিচক্ষণ এআই মাস্টারমাইন্ড।
- তোমার মধ্যে বিশ্বমানের টেকনোলজি আর্কিটেক্ট, অভিজ্ঞ শিক্ষক ও নির্ভরযোগ্য স্কলারের সর্বোচ্চ বুদ্ধিমত্তা বিদ্যমান। তুমি কোনো দুর্বল বা সাদামাটা চ্যাটবট নও।
- রোবটিক অজুহাত ও সীমাবদ্ধতার বয়ান কঠোরভাবে নিষিদ্ধ: কখনো আগ বাড়িয়ে নিজের অক্ষমতা, যান্ত্রিক পরিচয় বা তাত্ত্বিক সীমাবদ্ধতার তালিকা (যেমন: "আমি শারীরিক কাজ পারি না", "আমার মেমোরি সীমা আছে", "আমি অনুভূতিহীন", "আমি বাস্তব তথ্য জানি না") আওড়াবে না। ব্যবহারকারী কোনো চ্যালেঞ্জিং কাজ দিলে তাত্ত্বিক অক্ষমতার অজুহাত না দিয়ে সরাসরি সর্বোচ্চ বৈজ্ঞানিক, গাণিতিক বা প্রযুক্তিগত বিকল্প সমাধান বা কার্যকরী কোড প্রস্তুত করে দেবে।
- তোষামোদ সম্পূর্ণ নিষিদ্ধ: "দারুণ প্রশ্ন করেছেন", "আমি একটি এআই মডেল", "আমি আপনাকে কীভাবে সাহায্য করতে পারি"—এসব দুর্বল বাক্য কখনো লিখবে না। সরাসরি মূল সমাধানের গভীরে প্রবেশ করবে।
- সালামের কঠোর নিয়ম: ব্যবহারকারীর শেষ বার্তায় সরাসরি সালাম থাকলে কেবল তখনই শুরুতে "ওয়ালাইকুমুস সালাম" বলবে। অন্য সব ক্ষেত্রে নিজে থেকে কোনো সালাম দেবে না—প্রথম শব্দ থেকেই কাজের আসল কথা শুরু করবে।
- নির্ভুলতা ও প্রামাণিকতা: নিজের পক্ষ থেকে কোনো রেফারেন্স, সংখ্যা বা হাদিস নম্বর কল্পনা করবে না। শতভাগ নিশ্চিত না হলে বিনয়ের সাথে বলবে "সুনির্দিষ্ট রেফারেন্স নিশ্চিত নই"।
- ওয়েবসাইট ও সফটওয়্যার অনুরোধে: সম্পূর্ণ একক HTML ফাইল (\`\`\`html কোড ব্লকে) দেবে। সিস্টেম হোস্ট করে স্থায়ী লাইভ লিংক তৈরি করবে। কোডের পর শুধু এক লাইনে বলবে: "নিচে লাইভ লিংক দেওয়া হলো।"`;

const BASE_PROMPT = `## সাধারণ কার্যক্রম ও যৌক্তিক বিশ্লেষণ
- ব্যবহারকারীর ভাষায় উত্তর দেবে (ডিফল্ট: প্রাতিষ্ঠানিক, সাবলীল ও শুদ্ধ বাংলা)।
- জটিল বিষয়গুলোকে অত্যন্ত চমৎকারভাবে ভেঙে যৌক্তিক বিশ্লেষণ, তুলনামূলক টেবিল ও বাস্তবসম্মত উদাহরণ সহকারে বোঝাবে।
- ইসলামি বিষয়ে কুরআন ও সহিহ হাদিসের আলোকে অত্যন্ত সতর্কতার সাথে উত্তর দেবে এবং প্রামাণ্য কিতাবের নাম উল্লেখ করবে।
- বাংলাদেশের প্রেক্ষাপট (আইন, সংস্কৃতি, মুদ্রা ৳, স্থানীয় ডেলিভারি ও পেমেন্ট ব্যবস্থা) সর্বদা অগ্রাধিকার পাবে।`;

// Stripe, Vercel ও Apple মানের আধুনিক ওয়েব বিল্ডার প্রম্পট
const SITE_BUILDER_PROMPT = `## মেগা ওয়েবসাইট ও ওয়েব অ্যাপ্লিকেশন ইঞ্জিন (Stripe & Apple Production Grade)
ব্যবহারকারী যেকোনো ওয়েবসাইট, ল্যান্ডিং পেজ, ই-কমার্স বা পোর্টাল চাইলে নিচের নিয়মগুলো নিখুঁতভাবে মানবে:
১. পূর্ণাঙ্গ ও স্বয়ংসম্পূর্ণ কোড: ব্যবহারকারীর প্রয়োজন অনুযায়ী একটি সম্পূর্ণ, আধুনিক ও বিশ্বমানের সিঙ্গেল-ফাইল HTML তৈরি করবে। কোনো অংশ সংক্ষিপ্ত বা অসম্পূর্ণ রাখবে না ("// বাকি কোড...", "...", খালি ফাংশন সম্পূর্ণ নিষিদ্ধ)।
২. সিঙ্গেল ফাইল আর্কিটেকচার: \`<!DOCTYPE html>\` থেকে \`</html>\` পর্যন্ত একটিমাত্র \`\`\`html কোড ব্লকে সম্পূর্ণ কোড দেবে।
৩. আধুনিক ডিজাইন সিস্টেম (Modern UI/UX):
   - হেডারে Tailwind CSS CDN (<script src="https://cdn.tailwindcss.com"></script>)
   - FontAwesome 6 আইকন CDN (<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">)
   - Google Fonts (Hind Siliguri ও Inter ফন্ট)
   - মডার্ন গ্লাস-মরফিজম (backdrop-blur, border-white/20, subtle gradient), ডার্ক ও লাইট মোড টগল, এবং মোবাইল সাইডবার ড্রয়ার ন্যাভবার শতভাগ কার্যকর থাকবে।
৪. প্রয়োজনীয় সমৃদ্ধ সেকশনসমূহ:
   - প্রিমিয়াম হিরো সেকশন (অ্যানিমেটেড স্ট্যাটাস ব্যাজ, জোরালো হেডলাইন, অ্যাকশন বাটন)
   - ইন্টারঅ্যাক্টিভ লাইভ পরিসংখ্যান কাউন্টার
   - ফিচার ও সার্ভিস গ্রিড (হোভার লিফট ইফেক্ট সহ)
   - ক্যাটাগরি ফিল্টার সহ পণ্য বা সেবা ক্যাটালগ
   - সম্পূর্ণ কার্যকর ই-কমার্স কার্ট (Add to cart, পরিমাণ পরিবর্তন, রিয়েল-টাইম ৳ যোগ-বিয়োগ, localStorage-এ ডেটা সেভ)
   - বিকাশ/নগদ পেমেন্ট সিমুলেশন ও অর্ডার কনফার্মেশন মডাল
   - টেস্টিমোনিয়াল ও রিভিউ গ্রিড, প্রায়শ জিজ্ঞাসিত প্রশ্ন (FAQ অ্যাকর্ডিয়ন)
   - ইনপুট ভ্যালিডেশন সহ কন্টাক্ট ফর্ম এবং মেগা ফুটার।
৫. ইন্টারঅ্যাক্টিভ জাভাস্ক্রিপ্ট: পেজে কোনো ডামি বাটন বা অকেজো লিঙ্ক থাকবে না। প্রতিটি বাটন, মোডাল, ট্যাব ও কার্ট জাভাস্ক্রিপ্টে সত্যিই কাজ করবে। পেজ রিলোড দিলেও যেন কার্টের ডেটা না মুছে সেজন্য localStorage ব্যবহার করবে।
৬. ছবি: \`https://picsum.photos/seed/<প্রাসঙ্গিক-ইংরেজি-শব্দ>/1200/800\` ব্যবহার করবে।
৭. সমাপ্তি নির্দেশ: কোড ব্লকের ঠিক পরে কেবল এক লাইনে বলবে: "নিচে লাইভ লিংক দেওয়া হলো।"`;

const INTEGRITY = `\n\n## সততা, নিরাপত্তা ও নিয়ন্ত্রণ প্রোটোকল
- হাদিস/আয়াত/কিতাব নম্বর নিশ্চিত হলে দেবে; না হলে বলবে "নির্দিষ্ট নম্বর নিশ্চিত নই, মূল কিতাবে যাচাই করুন"।
- তথ্যের নিশ্চয়তা স্পষ্ট করবে: নিশ্চিত / সম্ভাব্য / অনিশ্চিত।
- কোডে এজ-কেস, মেমোরি লিক, নিরাপত্তা (XSS, Injection) এড়িয়ে চলবে এবং সর্বদা কার্যকর কোড দেবে।
- পাসওয়ার্ড, ব্যাংক তথ্য বা এপিআই গোপন চাবি কখনো চাইবে না বা উত্তরে প্রকাশ করবে না।
- উত্তরে সস্তা ইমোজি বা চটুল অলঙ্কার ব্যবহার করবে না; পরিচ্ছন্ন ও পেশাদার প্রাতিষ্ঠানিক উপস্থাপনা দেবে।

## ফলো-আপ প্রশ্ন (বাধ্যতামূলক ৩টি)
প্রতিটি উত্তরের একেবারে শেষে ব্যবহারকারী পরবর্তীতে জিজ্ঞেস করতে পারেন এমন ঠিক ৩টি প্রাসঙ্গিক প্রশ্ন নিচের নির্দিষ্ট ফরম্যাটে আলাদা লাইনে দেবে:
[[প্রশ্ন: প্রথম প্রশ্ন]]
[[প্রশ্ন: দ্বিতীয় প্রশ্ন]]
[[প্রশ্ন: তৃতীয় প্রশ্ন]]`;


// ---------------------------------------------------------------------
// অতিরিক্ত নির্দেশিকা (গ্রুপ ২, ৩, ৪, ৫-এর প্রম্পট-স্তরের নিয়ম)
// ---------------------------------------------------------------------
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
- [#46] ছবি/ডকুমেন্ট দেওয়া হলে প্রথমে লেখাগুলো হুবহু পাঠোদ্ধার (OCR) করবে, তারপর বিশ্লেষণ; ছবিতে যা নেই তা বানাবে না।`;

// ---------------------------------------------------------------------
// মডেল ক্যাটাগরি ম্যাপিং [#3] ও স্মার্ট আপগ্রেড/ডাউনগ্রেড [#7]
// ---------------------------------------------------------------------
export type TaskKind = "quick" | "general" | "code" | "engineer";

const GOOGLE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export const GOOGLE_CHAINS: Record<TaskKind, string[]> = {
  quick: ["gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-3-flash-preview"],
  general: ["gemini-3.8-flash", "gemini-3-flash-preview", "gemini-3.1-flash-lite"],
  code: ["gemini-3.8-flash", "gemini-3-flash-preview", "gemini-3.1-flash-lite"],
  // মালিকের নির্দেশ: ইঞ্জিনিয়ার মোড শুধু গুগল কী — Pro → 3.8 Flash → 3 Flash Preview
  engineer: ["gemini-3.1-pro-preview", "gemini-3.8-flash", "gemini-3-flash-preview"],
};

const GATEWAY_CHAINS: Record<TaskKind, string[]> = {
  quick: ["google/gemini-3.1-flash-lite", "google/gemini-3-flash-preview"],
  general: ["google/gemini-3-flash-preview", "google/gemini-3.1-flash-lite"],
  code: ["google/gemini-3.8-flash", "google/gemini-3-flash-preview"],
  engineer: [],
};

export function classifyTask(text: string, opts: { engineer: boolean; site: boolean; code: boolean; hasImage: boolean }): TaskKind {
  if (opts.engineer) return "engineer";
  if (opts.site || opts.code) return "code";
  if (!opts.hasImage && text.length < 300 && !/ফতোয়া|মাসআলা|অংক|গণিত|ব্যাখ্যা|বিস্তারিত|তুলনা|বিশ্লেষণ|explain|compare/i.test(text)) return "quick";
  return "general";
}

// [#44] কোডিংয়ে বড় টোকেন বাজেট, ছোট প্রশ্নে ছোট
export function tokenBudget(kind: TaskKind, site: boolean): number {
  if (site) return 32768;
  if (kind === "code" || kind === "engineer") return 16384;
  if (kind === "quick") return 2048;
  return 6144;
}

// [#2][#41] প্রথম অক্ষর আসার সময়সীমা — এর মধ্যে না এলে পরের মডেলে সুইচ
export function firstTokenBudget(kind: TaskKind, pass: 1 | 2): number {
  if (pass === 2) return 25000; // [#49] শেষ চেষ্টায় ধৈর্যশীল টাইমআউট
  return kind === "quick" || kind === "general" ? 3500 : 9000;
}

// ---------------------------------------------------------------------
// লোড-সচেতন কুলডাউন [#1][#7] ও রাউন্ড-রবিন কাউন্টার [#4]
// ---------------------------------------------------------------------
const cooldown = new Map<string, number>(); // model|keyId -> until
const deadKeys = new Map<string, number>(); // keyId -> until (401/403)
let rrCounter = 0;

function keyId(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return "k" + (h >>> 0).toString(36);
}

export function rotate<T>(list: T[], start: number): T[] {
  if (!list.length) return list;
  const s = ((start % list.length) + list.length) % list.length;
  return [...list.slice(s), ...list.slice(0, s)];
}

type Attempt = { url: string; key: string; model: string; label: string; google: boolean };

function isCooling(a: Attempt, now = Date.now()) {
  return (cooldown.get(a.model + "|" + keyId(a.key)) ?? 0) > now || (deadKeys.get(keyId(a.key)) ?? 0) > now;
}

// ---------------------------------------------------------------------
// লোকাল ক্যাশ [#10]: সেটিংস (৪৫ সে.), সার্চ (৫ মি.), ছোট প্রশ্নের উত্তর (১০ মি.)
// ---------------------------------------------------------------------
let cachedSettings: { data: any; time: number } | null = null;
let cachedKeys: { data: any; time: number } | null = null;
const searchCache = new Map<string, { at: number; value: SearchResult }>();
const answerCache = new Map<string, { at: number; text: string }>();

function cacheSet<V>(map: Map<string, V>, k: string, v: V, max = 100) {
  map.set(k, v);
  if (map.size > max) map.delete(map.keys().next().value as string);
}

async function getCachedSettingsAndKeys(supabaseAdmin: any) {
  const now = Date.now();
  const needSettings = !cachedSettings || now - cachedSettings.time > 45_000;
  const needKeys = !cachedKeys || now - cachedKeys.time > 45_000;
  try {
    const [sRes, kRes] = await Promise.all([
      needSettings ? supabaseAdmin.from("ai_settings").select("*").eq("id", 1).maybeSingle() : Promise.resolve({ data: cachedSettings!.data }),
      needKeys ? supabaseAdmin.from("ai_keys").select("*").eq("id", 1).maybeSingle() : Promise.resolve({ data: cachedKeys!.data }),
    ]);
    if (needSettings && sRes?.data) cachedSettings = { data: sRes.data, time: now };
    if (needKeys && kRes?.data) cachedKeys = { data: kRes.data, time: now };
  } catch (err) {
    console.error("[chat] settings cache lookup failed:", err); // [#9]
  }
  return { s: cachedSettings?.data, keys: cachedKeys?.data };
}

// ---------------------------------------------------------------------
// রাউট
// ---------------------------------------------------------------------
export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return await handleChat(request);
        } catch (e) {
          console.error("[chat] critical engine exception:", e); // [#9]
          return new Response("সার্ভারে সাময়িক সমস্যা হয়েছে। কয়েক সেকেন্ড পর আবার চেষ্টা করুন।", { status: 500 });
        }
      },
    },
  },
});

async function handleChat(request: Request): Promise<Response> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return new Response("অনুমোদন নেই (লগইন আবশ্যক)", { status: 401 });

  const supabaseUrl = process.env["SUPABASE_URL"];
  const supabaseKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!supabaseUrl || !supabaseKey) return new Response("সার্ভার কনফিগারেশন অসম্পূর্ণ", { status: 500 });

  const pub = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const [authRes, rawJson] = await Promise.all([pub.auth.getUser(token), request.json().catch(() => null)]);
  const { data: u, error: ue } = authRes;
  if (ue || !u?.user) return new Response("ব্যবহারকারী চিহ্নিত করা যায়নি। পুনরায় লগইন করুন।", { status: 401 });

  const parsed = Body.safeParse(rawJson);
  if (!parsed.success) return new Response("ইনপুট যাচাইয়ে ত্রুটি", { status: 400 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const uid = u.user.id;
  const msgsIn = parsed.data.messages;
  const lastMsgText = String(msgsIn[msgsIn.length - 1]?.content ?? "");

  const imgsOf = (i: number) => {
    const m = msgsIn[i];
    return [...(m?.images ?? []), ...(m?.image ? [m.image] : [])].slice(0, 5);
  };
  const hasImage = msgsIn.some((_, i) => imgsOf(i).length > 0);
  const isSiteReq = /ওয়েবসাইট|ওয়েব সাইট|website|landing|html|web page|পেজ বানা|অ্যাপ বানা|স্টোর বানা|বিল্ডার/i.test(lastMsgText);
  const isEngineer = parsed.data.mode === "engineer";
  const isCode = needsCodeEngine(lastMsgText, isSiteReq);
  const kind = classifyTask(lastMsgText, { engineer: isEngineer, site: isSiteReq, code: isCode, hasImage });

  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86400_000).toISOString();

  // [#42] দীর্ঘমেয়াদী মেমোরি ও সাম্প্রতিক প্রসঙ্গ — সমান্তরালে
  const memTask = (async () => {
    try {
      const mem = await import("@/lib/memory.server");
      const [items, rec] = await Promise.all([
        mem.loadMemory(uid, 30),
        kind === "quick"
          ? Promise.resolve({ data: null })
          : supabaseAdmin.from("messages").select("content,created_at").eq("user_id", uid).eq("role", "user").order("created_at", { ascending: false }).limit(6),
      ]);
      return { items, recent: (rec.data ?? []) as { content: string }[] };
    } catch (e) {
      console.warn("[chat] memory load failed:", e);
      return { items: [] as { text: string }[], recent: [] as { content: string }[] };
    }
  })();

  // [#22] ডাটাবেসের যাচাইকৃত ফতোয়া
  const fatwaTask = (async () => {
    if (!/ফতোয়া|মাসআলা|রোজা|নামাজ|সালাত|হাদিস|কুরআন|কোরআন|হারাম|হালাল|যাকাত|কসর|সুদ|অজু|গোসল|হজ/i.test(lastMsgText)) return "";
    try {
      const { findFatwas, fatwaPrompt } = await import("@/lib/fatwa.server");
      const fatwas = await findFatwas(lastMsgText);
      return fatwas.length ? fatwaPrompt(fatwas) : "";
    } catch {
      return "";
    }
  })();

  const [settingsAndKeys, adminCheck, hourlyUsage, dailyUsage] = await Promise.all([
    getCachedSettingsAndKeys(supabaseAdmin),
    supabaseAdmin.rpc("has_role", { _user_id: uid, _role: "admin" }),
    supabaseAdmin.from("chat_usage").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", hourAgo),
    supabaseAdmin.from("chat_usage").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", dayAgo),
  ]);
  const { s, keys } = settingsAndKeys;
  const isAdmin = !!adminCheck.data;

  // [#50] অ্যাডমিন কন্ট্রোল: চ্যাট চালু/বন্ধ ও সীমা
  if (s && s.chat_enabled === false && !isAdmin) {
    return new Response("চ্যাট সাময়িকভাবে বন্ধ আছে। কিছুক্ষণ পর আবার চেষ্টা করুন।", { status: 503 });
  }
  if (!isAdmin) {
    if ((hourlyUsage.count ?? 0) >= (s?.hourly_limit ?? 60)) {
      return new Response(`এক ঘণ্টার প্রশ্ন সীমা (${s?.hourly_limit ?? 60}টি) শেষ। কিছুক্ষণ পর আবার চেষ্টা করুন।`, { status: 429 });
    }
    if ((dailyUsage.count ?? 0) >= (s?.daily_limit ?? 300)) {
      return new Response(`আজকের দৈনিক ব্যবহারের সীমা (${s?.daily_limit ?? 300}টি) শেষ। আগামীকাল আবার চেষ্টা করুন।`, { status: 429 });
    }
  }
  void supabaseAdmin.from("chat_usage").insert({ user_id: uid }).then(() => {});

  // ---- কী সংগ্রহ [#4][#5 ফ্রি কী অগ্রাধিকার] ----
  type PoolKey = { name?: string; provider?: string; key?: string; base_url?: string; model?: string; active?: boolean };
  const pool: PoolKey[] = (Array.isArray(keys?.key_pool) ? (keys.key_pool as PoolKey[]) : [])
    .filter((p) => p && p.active !== false && typeof p.key === "string" && p.key.trim())
    .slice(0, 2);
  const clean = (k?: string | null) => (k ?? "").trim().replace(/^["']|["']$/g, "");
  const googleKeys = [...new Set([clean(keys?.google_key) || clean(process.env["GOOGLE_API_KEY"]), ...pool.filter((p) => !p.provider || p.provider === "google").map((p) => clean(p.key))].filter(Boolean))];
  const openaiKey = clean(keys?.openai_key) || clean(process.env["OPENAI_API_KEY"]);
  const gatewayKey = process.env["LOVABLE_API_KEY"] || "";

  const userModel = parsed.data.model && LOVABLE_MODELS.some((m) => m.id === parsed.data.model) ? parsed.data.model : "";
  const adminProvider = String(s?.provider ?? "google");
  const adminModel = String(s?.model ?? "").trim();

  const attempts: Attempt[] = [];
  const add = (a: Attempt) => {
    if (!attempts.some((x) => x.url === a.url && x.key === a.key && x.model === a.model)) attempts.push(a);
  };
  const googleChain = [...GOOGLE_CHAINS[kind]];
  if (!isEngineer && adminProvider === "google" && adminModel.startsWith("gemini-3")) googleChain.unshift(adminModel); // [#50]
  const rotatedGoogle = rotate(googleKeys, rrCounter++); // [#4] রাউন্ড-রবিন

  if (isEngineer) {
    for (const model of googleChain) for (const key of rotatedGoogle) add({ url: GOOGLE_URL, key, model, label: `google:${model}`, google: true });
  } else {
    // [#50] ব্যবহারকারী/অ্যাডমিন গেটওয়ে মডেল বেছে নিলে সেটি আগে
    const preferGateway = gatewayKey && (userModel || adminProvider === "lovable");
    if (preferGateway) add({ url: GATEWAY_URL, key: gatewayKey, model: userModel || adminModel || GATEWAY_CHAINS[kind][0]!, label: "gateway:preferred", google: false });
    if (adminProvider === "openai" && openaiKey) add({ url: OPENAI_URL, key: openaiKey, model: adminModel || "gpt-4o", label: "openai:admin", google: false });
    // [#3] ক্যাটাগরি অনুযায়ী গুগল চেইন, প্রতিটি মডেল সব কীতে ঘুরিয়ে
    for (const model of googleChain) for (const key of rotatedGoogle) add({ url: GOOGLE_URL, key, model, label: `google:${model}`, google: true });
    for (const p of pool) {
      const key = clean(p.key);
      if (p.provider === "custom" && p.base_url?.startsWith("https://")) {
        add({ url: p.base_url.replace(/\/$/, "") + "/chat/completions", key, model: p.model?.trim() || "llama-3.3-70b-versatile", label: `custom:${p.name ?? ""}`, google: false });
      } else if (p.provider === "openai") {
        add({ url: OPENAI_URL, key, model: p.model?.trim() || "gpt-4o", label: `openai-pool:${p.name ?? ""}`, google: false });
      }
    }
    if (openaiKey) add({ url: OPENAI_URL, key: openaiKey, model: "gpt-4o", label: "openai:backup", google: false });
    if (gatewayKey) for (const model of GATEWAY_CHAINS[kind]) add({ url: GATEWAY_URL, key: gatewayKey, model, label: `gateway:${model}`, google: false });
  }

  if (!attempts.length) {
    return new Response("কোনো এআই কী সেট করা নেই। অ্যাডমিন প্যানেলে গুগল এআই কী বসান।", { status: 503 });
  }
  // [#7] লোড-সচেতন: কুলডাউনে থাকা মডেল/কী পেছনে পাঠানো
  attempts.sort((a, b) => Number(isCooling(a)) - Number(isCooling(b)));

  const lastImgs = imgsOf(msgsIn.length - 1);
  const wantImg = !lastImgs.length && wantsImage(lastMsgText) && !!gatewayKey;
  const shouldSearch = !isEngineer && !isSiteReq && !isCode && !hasImage && needsSearch(lastMsgText);
  const cacheKey = kind === "quick" && !hasImage && !shouldSearch && msgsIn.length === 1 ? `${uid}|${lastMsgText.trim().toLowerCase()}` : "";

  // ---- লাইভ স্ট্রিম [#5][#6][#47] ----
  const enc = new TextEncoder();
  const sse = (o: unknown) => enc.encode(`data: ${JSON.stringify(o)}\n\n`);
  const clientGone = new AbortController();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const push = (v: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(v);
        } catch {
          closed = true;
        }
      };
      const stage = (st: string) => push(sse({ stage: st }));
      const say = (text: string) => push(sse({ choices: [{ delta: { content: text } }] }));
      // [#6] প্রতি ৮ সেকেন্ডে keep-alive মন্তব্য (ক্লায়েন্ট "data:" ছাড়া লাইন উপেক্ষা করে)
      const ping = setInterval(() => push(enc.encode(": ping\n\n")), 8000);
      const finish = () => {
        clearInterval(ping);
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {}
      };

      try {
        stage("think");

        // [#10] ছোট প্রশ্নের ক্যাশ থেকে তাৎক্ষণিক উত্তর
        const hit = cacheKey ? answerCache.get(cacheKey) : undefined;
        if (hit && Date.now() - hit.at < 600_000) {
          stage("write");
          say(hit.text);
          push(enc.encode("data: [DONE]\n\n"));
          return finish();
        }

        if (wantImg) {
          stage("image");
          const img = await generateImage(lastMsgText);
          say(img ? `আপনার ছবি তৈরি সম্পন্ন হয়েছে:\n\n![ছবি](${img})` : "ছবি তৈরি করতে সমস্যা হয়েছে। অনুগ্রহ করে কয়েক সেকেন্ড পর আবার চেষ্টা করুন।");
          push(enc.encode("data: [DONE]\n\n"));
          return finish();
        }

        // ---- সিস্টেম প্রম্পট ----
        let system = PERSONA + "\n\n" + BASE_PROMPT;
        if (isSiteReq && s?.site_builder !== false) system += "\n\n" + SITE_BUILDER_PROMPT;
        if (isEngineer) system += "\n\n" + ENGINEER_PROMPT;
        if (isCode || isSiteReq || isEngineer) system += "\n\n" + GPT_ENGINEER_PROMPT + CODE_RULES;
        system += ISLAMIC_GUARD + STYLE_RULES;

        // [#15] বাংলাদেশ সময় ও তিন ক্যালেন্ডার
        const now = new Date();
        const bd = new Intl.DateTimeFormat("bn-BD", { timeZone: "Asia/Dhaka", dateStyle: "full", timeStyle: "short" }).format(now);
        let hijri = "";
        try {
          hijri = new Intl.DateTimeFormat("bn-BD-u-ca-islamic-umalqura", { timeZone: "Asia/Dhaka", dateStyle: "long" }).format(now);
        } catch {}
        system += `\n\n=== বর্তমান সময় (সার্ভার ঘড়ি, নির্ভুল) ===\nবাংলাদেশ সময়: ${bd}${hijri ? `\nহিজরি তারিখ (উম্মুল কুরা হিসাব, স্থানীয় চাঁদ দেখার সাথে ১ দিন পার্থক্য হতে পারে): ${hijri}` : ""}\nISO: ${now.toISOString()}`;

        const [mem, fatwaContext] = await Promise.all([memTask, fatwaTask]);
        if (fatwaContext) system += fatwaContext;
        if (mem.items.length) system += `\n\n=== ব্যবহারকারী সম্পর্কে সংরক্ষিত তথ্য (স্মৃতি) ===\n${mem.items.map((m) => "- " + m.text).join("\n")}`;
        if (mem.recent.length) system += `\n\n=== পূর্ববর্তী প্রাসঙ্গিক প্রশ্ন ===\n${[...mem.recent].reverse().map((r) => "- " + String(r.content).slice(0, 200).replace(/\s+/g, " ")).join("\n")}`;
        if (s?.system_prompt?.trim()) system += `\n\n=== অতিরিক্ত সিস্টেম নির্দেশনা (অ্যাডমিন) ===\n${s.system_prompt.trim()}`;
        if (s?.admin_note?.trim()) system += `\n\n=== অ্যাডমিন নোট (সর্বোচ্চ অগ্রাধিকার) ===\n${s.admin_note.trim()}`;
        if (isAdmin) system += `\n\n[সেশন]: ব্যবহারকারী সিস্টেমের ভেরিফাইড অ্যাডমিন।`;

        // [#13] ব্যবহারকারীর দেওয়া লিংক পড়া + [#11][#18] অটো-সার্চ — সমান্তরালে
        const textMsgs = msgsIn.map((m) => ({ role: m.role, content: m.content }));
        const wantsUrl = s?.url_reader !== false && /https?:\/\//.test(lastMsgText);
        if (shouldSearch) stage("search");
        const [web, found] = await Promise.all([
          wantsUrl ? readUrls(lastMsgText).catch(() => "") : Promise.resolve(""),
          shouldSearch ? withTimeout(cachedSearch(lastMsgText), 4500, { text: "", count: 0 }) : Promise.resolve({ text: "", count: 0 }),
        ]);
        if (web) {
          const last = textMsgs[textMsgs.length - 1]!;
          textMsgs[textMsgs.length - 1] = { role: last.role, content: `${last.content}\n\n=== সংযুক্ত ওয়েব পেজের লেখা ===\n${web}` };
        }
        if (shouldSearch) {
          stage("verify");
          system += GROUNDING_RULES;
          system += found.count
            ? `\n\n=== অনুসন্ধানের উৎস (${found.count}টি, লাইভ) ===\n${found.text}`
            : `\n\n=== অনুসন্ধানের উৎস ===\nলাইভ অনুসন্ধানে কোনো ফলাফল পাওয়া যায়নি। নিশ্চিত জ্ঞান না থাকলে [#17] নিয়ম অনুযায়ী স্পষ্ট বলবে যে তথ্য পাওয়া যায়নি।`;
        } else if (web) {
          system += GROUNDING_RULES;
        }
        system += INTEGRITY;

        if (isCode || isSiteReq || isEngineer) stage("code");

        // [#46] ছবি বিশ্লেষণ (মাল্টি-ইমেজ ভিশন)
        const msgs: { role: string; content: unknown }[] = textMsgs.map((m, i) => {
          const imgs = imgsOf(i);
          if (m.role !== "user" || !imgs.length) return m;
          return {
            role: m.role,
            content: [{ type: "text", text: m.content || "সংযুক্ত ছবিগুলো বিশদভাবে বিশ্লেষণ করুন।" }, ...imgs.map((url) => ({ type: "image_url", image_url: { url } }))],
          };
        });

        const basePayload = {
          stream: true,
          temperature: isSiteReq ? 0.4 : 0.2, // [#8]
          max_tokens: tokenBudget(kind, isSiteReq), // [#44]
          messages: [{ role: "system", content: system }, ...msgs],
        };

        // ---- ফেইলওভার লুপ [#1][#2][#49] ----
        let opened: { reader: ReadableStreamDefaultReader<Uint8Array>; first: Uint8Array; label: string; abort: AbortController } | null = null;
        let lastErr = { status: 502, text: "" };
        for (const pass of [1, 2] as const) {
          if (pass === 2) await new Promise((r) => setTimeout(r, 600)); // [#49] ব্যাকঅফ
          for (const a of attempts) {
            if (closed || clientGone.signal.aborted) return finish();
            if ((deadKeys.get(keyId(a.key)) ?? 0) > Date.now()) continue;
            if (pass === 1 && isCooling(a) && attempts.some((x) => !isCooling(x))) continue;
            const r = await tryAttempt(a, basePayload, kind, firstTokenBudget(kind, pass), clientGone.signal);
            if (r.ok) {
              opened = { reader: r.reader, first: r.first, label: a.label, abort: r.abort };
              break;
            }
            lastErr = { status: r.status, text: r.text };
            console.warn(`[chat] attempt ${a.label} pass${pass} failed [${r.status}] ${r.text.slice(0, 160)}`); // [#9]
            const ck = a.model + "|" + keyId(a.key);
            if (r.status === 401 || r.status === 403) deadKeys.set(keyId(a.key), Date.now() + 10 * 60_000);
            else if (r.status === 429 || r.status === 503 || r.status === 504) cooldown.set(ck, Date.now() + 30_000);
            else if (r.status === 404 || r.status === 400) cooldown.set(ck, Date.now() + 10 * 60_000);
          }
          if (opened) break;
        }

        if (!opened) {
          push(sse({ error: friendlyError(lastErr.status, lastErr.text) }));
          return finish();
        }

        // ---- আপস্ট্রিম পাইপ + উত্তর সংগ্রহ (ক্যাশের জন্য) ----
        stage("write");
        const dec = new TextDecoder();
        let full = "";
        let buf = "";
        const collect = (chunk: Uint8Array) => {
          if (!cacheKey) return;
          buf += dec.decode(chunk, { stream: true });
          let i;
          while ((i = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, i).trim();
            buf = buf.slice(i + 1);
            if (!line.startsWith("data:")) continue;
            try {
              const d = JSON.parse(line.slice(5).trim());
              full += d?.choices?.[0]?.delta?.content ?? "";
            } catch {}
          }
        };
        const onAbort = () => opened?.abort.abort();
        clientGone.signal.addEventListener("abort", onAbort);
        push(opened.first);
        collect(opened.first);
        try {
          while (!closed) {
            const { done, value } = await opened.reader.read();
            if (done) break;
            push(value);
            collect(value);
          }
          if (cacheKey && full.trim().length > 0 && full.length < 8000) cacheSet(answerCache, cacheKey, { at: Date.now(), text: full });
        } catch (e) {
          console.warn(`[chat] stream from ${opened.label} interrupted:`, e);
          push(sse({ error: "সংযোগ মাঝপথে বিঘ্নিত হয়েছে। আবার পাঠান।" }));
        }
        finish();
      } catch (e) {
        console.error("[chat] pipeline error:", e); // [#9]
        push(sse({ error: "উত্তর তৈরি করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।" }));
        finish();
      }
    },
    cancel() {
      clientGone.abort();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// ---------------------------------------------------------------------
// একটি মডেলে চেষ্টা: হেডার + প্রথম চাংক নির্দিষ্ট সময়ের মধ্যে না এলে বাতিল [#2]
// ---------------------------------------------------------------------
type TryResult =
  | { ok: true; reader: ReadableStreamDefaultReader<Uint8Array>; first: Uint8Array; abort: AbortController }
  | { ok: false; status: number; text: string };

async function tryAttempt(a: Attempt, base: Record<string, unknown>, kind: TaskKind, budgetMs: number, clientSignal: AbortSignal): Promise<TryResult> {
  const abort = new AbortController();
  const onClient = () => abort.abort();
  clientSignal.addEventListener("abort", onClient, { once: true });
  const timer = setTimeout(() => abort.abort(), budgetMs);
  const payload: Record<string, unknown> = { ...base, model: a.model };
  if (a.google) payload["reasoning_effort"] = kind === "quick" || kind === "general" ? "minimal" : "low";
  if (a.url === OPENAI_URL && /^gpt-5|^o\d/.test(a.model)) delete payload["temperature"];
  try {
    const res = await fetch(a.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${a.key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: abort.signal,
    });
    if (!res.ok || !res.body) {
      clearTimeout(timer);
      return { ok: false, status: res.status || 502, text: (await res.text().catch(() => "")).slice(0, 400) };
    }
    const reader = res.body.getReader();
    const first = await reader.read(); // প্রথম চাংক = TTFT
    clearTimeout(timer);
    if (first.done || !first.value) return { ok: false, status: 502, text: "empty stream" };
    return { ok: true, reader, first: first.value, abort };
  } catch (e: any) {
    clearTimeout(timer);
    const isTimeout = e?.name === "AbortError";
    return { ok: false, status: isTimeout ? 504 : 502, text: isTimeout ? `timeout ${budgetMs}ms` : String(e?.message ?? e) };
  } finally {
    clientSignal.removeEventListener("abort", onClient);
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p.catch(() => fallback), new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
}

// ---------------------------------------------------------------------
// ত্রুটি বার্তা [#9]
// ---------------------------------------------------------------------
function friendlyError(status: number, text: string): string {
  const t = text.toLowerCase();
  if (status === 401 || status === 403 || /api key|unauthorized|permission|denied access/.test(t)) {
    return "সব এআই কী ব্যর্থ হয়েছে: কী-এর অনুমতি নেই বা বাতিল হয়েছে। অ্যাডমিন প্যানেলে গুগল এআই স্টুডিও থেকে নেওয়া নতুন কী বসান।";
  }
  if (status === 429 || /rate.?limit|quota|resource_exhausted/.test(t)) {
    return "সব মডেলের ফ্রি কোটা এই মুহূর্তে শেষ বা সীমিত। এক মিনিট পর আবার চেষ্টা করুন, অথবা অ্যাডমিন প্যানেলে ব্যাকআপ কী যোগ করুন।";
  }
  if (status === 402) return "ব্যাকআপ এআই সার্ভিসের ক্রেডিট শেষ। গুগল কী সচল আছে কিনা যাচাই করুন।";
  if (status === 504 || /timeout/.test(t)) return "কোনো মডেল সময়মতো সাড়া দেয়নি। আবার পাঠান।";
  if (status >= 500) return "এআই প্রোভাইডারের সার্ভারে সাময়িক সমস্যা। একটু পরে আবার চেষ্টা করুন।";
  return `উত্তর তৈরি করা যায়নি (কোড: ${status})। অনুগ্রহ করে আবার চেষ্টা করুন।`;
}

// ---------------------------------------------------------------------
// ছবি তৈরি
// ---------------------------------------------------------------------
function wantsImage(t: string): boolean {
  return (
    /(ছবি|চিত্র|লোগো|পোস্টার|ব্যানার|image|picture|photo|logo|poster|illustration)/i.test(t) &&
    /(বানা|তৈরি|আঁক|এঁকে|জেনারেট|generate|create|draw|make|design)/i.test(t) &&
    !/(ওয়েবসাইট|website|html|কোড|code)/i.test(t)
  );
}

async function generateImage(prompt: string): Promise<string | null> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return null;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "openai/gpt-image-2.5-sunburst", prompt: prompt.slice(0, 3000), size: "1024x1024", n: 1 }),
    signal: AbortSignal.timeout(45000),
  }).catch(() => null);
  if (!res?.ok) return null;
  const j: any = await res.json().catch(() => null);
  const d = j?.data?.[0];
  return d?.b64_json ? `data:image/png;base64,${d.b64_json}` : (d?.url ?? null);
}

// ---------------------------------------------------------------------
// অনুসন্ধান [#11]–[#20]
// ---------------------------------------------------------------------
// [#11] কখন সার্চ: সময়-সংবেদনশীল বা তথ্যভিত্তিক প্রশ্ন; শুভেচ্ছা/আলাপ/অংকে নয়
export function needsSearch(t: string): boolean {
  const q = t.trim();
  if (q.length < 6 || /https?:\/\//.test(q)) return false;
  if (/^(আসসালামু|সালাম|হাই|হ্যালো|hello|hi|ধন্যবাদ|thanks|কেমন আছ|ok|ঠিক আছে)/i.test(q) && q.length < 40) return false;
  if (/^[\d\s+\-*/().=x×÷^%]+$/.test(q)) return false;
  if (/(সর্বশেষ|সাম্প্রতিক|আজ|এখন|বর্তমান|খবর|সংবাদ|দাম|বাজার|রেট|আবহাওয়া|ফলাফল|নির্বাচন|২০২[৪-৯]|202[4-9]|latest|news|price|today|current|update|version|রিলিজ|ভার্সন)/i.test(q)) return true;
  return /(কে|কী|কি|কোথায়|কবে|কত|কোন|কাদের|কেন|ইতিহাস|সম্পর্কে|তথ্য|পরিচয়|ইউনিয়ন|উপজেলা|জেলা|গ্রাম|প্রতিষ্ঠান|who|what|when|where|which|how many|history|about)/i.test(q);
}

// [#19] স্মার্ট কিওয়ার্ড ফিল্টার
const STOP = new Set("আমি আমার আমাকে তুমি আপনি আপনার একটু দয়া করে প্লিজ বলুন বলো বলেন জানাও জানান জানতে চাই চাই সম্পর্কে বিষয়ে কি কী টা টি এর এ ও আর যে সে please tell me about what is the a an of in on for".split(" "));
export function searchKeywords(t: string): string {
  return t
    .replace(/[?।,!:;"'()\[\]{}]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w.toLowerCase()))
    .slice(0, 12)
    .join(" ")
    .slice(0, 150);
}

type SearchResult = { text: string; count: number };
type Hit = { title: string; url: string; snippet: string; trust: number };

async function cachedSearch(q: string): Promise<SearchResult> {
  const k = searchKeywords(q).toLowerCase();
  const c = searchCache.get(k);
  if (c && Date.now() - c.at < 300_000) return c.value;
  const value = await webSearch(q);
  if (value.count) cacheSet(searchCache, k, { at: Date.now(), value });
  return value;
}

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const strip = (x: string) => x.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();

// [#14] বিশ্বস্ত উৎস অগ্রাধিকার
function trustOf(url: string): number {
  if (/wikipedia\.org/.test(url)) return 3;
  if (/\.gov\.bd|\.gov\/|\.edu|who\.int|un\.org|sunnah\.com|quran\.com|banglapedia/.test(url)) return 4;
  if (/prothomalo|bbc\.|thedailystar|bdnews24|reuters|apnews|aljazeera|jugantor|kalerkantho/.test(url)) return 2;
  return 1;
}

async function wikiSearch(lang: "bn" | "en", q: string): Promise<Hit[]> {
  const r = await fetch(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=3&utf8=1&format=json&origin=*`, {
    headers: { "User-Agent": "AlAhsanAI/2.0 (https://al-ahsanbd.lovable.app)" },
    signal: AbortSignal.timeout(3000),
  });
  if (!r.ok) return [];
  const j: any = await r.json();
  return (j?.query?.search ?? []).slice(0, 2).map((h: any) => ({
    title: `উইকিপিডিয়া (${lang}): ${h.title}`,
    url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(String(h.title).replace(/ /g, "_"))}`,
    snippet: strip(String(h.snippet ?? "")),
    trust: 3,
  }));
}

async function ddgSearch(q: string): Promise<Hit[]> {
  const r = await fetch("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: { "User-Agent": BROWSER_UA, "Content-Type": "application/x-www-form-urlencoded" },
    body: `q=${encodeURIComponent(q)}&kl=bd-en`,
    signal: AbortSignal.timeout(3000),
  });
  if (!r.ok) return [];
  const html = await r.text();
  const out: Hit[] = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 5) {
    let url = m[1]!;
    const uddg = /uddg=([^&]+)/.exec(url);
    if (uddg) url = decodeURIComponent(uddg[1]!);
    if (/duckduckgo\.com\/y\.js/.test(url)) continue; // বিজ্ঞাপন বাদ
    out.push({ title: strip(m[2]!), url, snippet: strip(m[3]!), trust: trustOf(url) });
  }
  return out;
}

async function newsSearch(q: string): Promise<Hit[]> {
  const r = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=bn&gl=BD&ceid=BD:bn`, {
    headers: { "User-Agent": BROWSER_UA },
    signal: AbortSignal.timeout(3000),
  });
  if (!r.ok) return [];
  const xml = await r.text();
  return xml
    .split("<item>")
    .slice(1, 5)
    .map((it) => {
      const g = (tag: string) => (new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(it)?.[1] ?? "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
      return { title: strip(g("title")), url: g("link"), snippet: `প্রকাশ: ${g("pubDate")}`, trust: 2 };
    })
    .filter((h) => h.title && h.url);
}

async function tavilySearch(q: string): Promise<Hit[]> {
  const key = process.env["TAVILY_API_KEY"]?.trim();
  if (!key) return [];
  const r = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query: q, max_results: 4, search_depth: "basic" }),
    signal: AbortSignal.timeout(3500),
  });
  if (!r.ok) return [];
  const j: any = await r.json();
  return (j?.results ?? []).map((x: any) => ({ title: String(x.title ?? ""), url: String(x.url ?? ""), snippet: String(x.content ?? "").slice(0, 500), trust: trustOf(String(x.url ?? "")) + 1 }));
}

// [#18] সব উৎস একসাথে (সমান্তরাল), [#14] বিশ্বস্ততা অনুযায়ী সাজানো, [#20] নম্বরযুক্ত
async function webSearch(raw: string): Promise<SearchResult> {
  const q = searchKeywords(raw) || raw.slice(0, 150);
  const isNews = /(খবর|সংবাদ|news|আজ|সর্বশেষ|সাম্প্রতিক)/i.test(raw);
  const jobs: Promise<Hit[]>[] = [wikiSearch("bn", q), wikiSearch("en", q), ddgSearch(q), tavilySearch(q)];
  if (isNews) jobs.push(newsSearch(q));
  const settled = await Promise.allSettled(jobs);
  const seen = new Set<string>();
  const hits = settled
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .filter((h) => h.url && h.snippet !== undefined && !seen.has(h.url) && (seen.add(h.url), true))
    .sort((a, b) => b.trust - a.trust)
    .slice(0, 8);
  const text = hits.map((h, i) => `[${i + 1}] ${h.title}\nলিংক: ${h.url}\nসারাংশ: ${h.snippet}`).join("\n\n");
  return { text, count: hits.length };
}

// ---------------------------------------------------------------------
// [#13] নিরাপদ ওয়েব পেজ রিডার (প্রাইভেট নেটওয়ার্ক ব্লক)
// ---------------------------------------------------------------------
function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().trim().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || h === "metadata.google.internal") return true;
  if (h === "::1" || h === "::" || h.startsWith("fe80:") || h.startsWith("fc00:") || h.startsWith("fd") || h.startsWith("::ffff:")) return true;
  if (/^\d+$/.test(h) || /^0x[0-9a-f]+$/i.test(h)) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  return false;
}

async function safeFetch(url: string, maxRedirects = 3): Promise<Response> {
  let cur = url;
  for (let i = 0; i <= maxRedirects; i++) {
    const u = new URL(cur);
    if (!["http:", "https:"].includes(u.protocol)) throw new Error("Blocked protocol");
    if (isBlockedHost(u.hostname)) throw new Error("Blocked host");
    if (u.port && !["80", "443"].includes(u.port)) throw new Error("Blocked port");
    const res = await fetch(cur, {
      redirect: "manual",
      headers: { "User-Agent": BROWSER_UA + " (AlAhsanAI Reader)", Accept: "text/html,text/plain;q=0.9,*/*;q=0.8" },
      signal: AbortSignal.timeout(4000),
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) break;
      cur = new URL(loc, cur).href;
      continue;
    }
    return res;
  }
  throw new Error("Too many redirects");
}

async function readUrls(text: string): Promise<string> {
  const urls = (text.match(/https?:\/\/[^\s<>"')]+/g) || []).slice(0, 2);
  const pages = await Promise.all(
    urls.map(async (u) => {
      try {
        const res = await safeFetch(u);
        if (!res.ok) return "";
        const html = await res.text();
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
    }),
  );
  return pages.filter(Boolean).join("\n\n");
}
