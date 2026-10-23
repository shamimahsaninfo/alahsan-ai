import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export type Issue = {
  id: string;
  area: string;
  title: string;
  detail: string;
  severity: "critical" | "warning" | "info";
  root_cause: string;
  agent_solution: string;
  fix?: string;
  fixLabel?: string;
};

export type Scan = {
  issues: Issue[];
  passed: string[];
  at: string;
  agent_summary?: string;
  repaired?: { ok: boolean; message: string; details?: string[] };
};

type Ctx = {
  admin: any;
  settings: any;
  keys: any;
  issues: Issue[];
  passed: string[];
};

const FOUNDER = "alahsanfoundation.info@gmail.com";
const GOOGLE_CHAT = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const OPENAI_CHAT = "https://api.openai.com/v1/chat/completions";
const DEEPSEEK_CHAT = "https://api.deepseek.com/chat/completions";
const WORKING_GOOGLE_MODELS = ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-3.1-flash-lite"];
const TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const TABLES = ["ai_settings", "ai_keys", "conversations", "messages", "pages", "health_checks", "chat_usage", "user_roles", "user_memories"];

async function safeChatCall(url: string, key: string, model: string, content: unknown, isReasoning = false) {
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content }],
  };

  if (isReasoning) {
    body["max_completion_tokens"] = 256;
    body["reasoning_effort"] = "low";
  } else {
    body["max_tokens"] = 50;
  }

  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  }).catch((e) => new Response(String(e), { status: 599 }));

  const text = await r.text();
  return { ok: r.ok, status: r.status, text: text.slice(0, 400) };
}

function classifyError(status: number, text: string) {
  const t = text.toLowerCase();
  if (status === 401) return { label: "এপিআই কী অবৈধ বা এক্সপায়ার্ড (Invalid API Key)", type: "auth" };
  if (status === 403) return { label: "অনুমতি নেই বা একাউন্ট সীমাবদ্ধ (Forbidden)", type: "permission" };
  if (status === 429 || /rate|quota|exhausted|insufficient_quota|credit/.test(t)) {
    return { label: "কোটা বা ব্যালেন্স শেষ অথবা রেট লিমিট (Quota Exceeded / Rate Limit)", type: "quota" };
  }
  if (status === 404 || /model_not_found|not found|does not exist/.test(t)) {
    return { label: "মডেল পাওয়া যায়নি বা এই কী দিয়ে অ্যাক্সেস নেই (Model Not Found)", type: "model" };
  }
  if (status === 400) {
    if (/reasoning_effort/.test(t)) return { label: "প্যারামিটার অমিল: এই মডেলে reasoning_effort গ্রহণযোগ্য নয়", type: "param" };
    if (/max_tokens|max_completion_tokens/.test(t)) return { label: "টোকেন সীমা অমিল (Token Limit Mismatch)", type: "param" };
    return { label: "রিকোয়েস্ট ফরম্যাটে সমস্যা (Bad Request 400)", type: "bad_request" };
  }
  if (status === 599) return { label: "নেটওয়ার্ক টাইমআউট বা সংযোগ ব্যর্থ", type: "network" };
  if (status >= 500) return { label: "প্রোভাইডারের নিজস্ব সার্ভারে ত্রুটি (Server 5xx)", type: "server" };
  return { label: `ত্রুটি ${status}`, type: "unknown" };
}

const PROBES: Record<string, (c: Ctx) => Promise<void>> = {
  async database(c) {
    for (const t of TABLES) {
      const { error } = await c.admin.from(t).select("*", { head: true, count: "exact" });
      if (error) {
        c.issues.push({
          id: `db:${t}`,
          area: "ডাটাবেস",
          title: `"${t}" টেবিল অ্যাক্সেস করা যাচ্ছে না`,
          detail: error.message,
          severity: "critical",
          root_cause: `Supabase-এর ${t} টেবিল/স্কিমা বা সার্ভার-সাইড ডাটাবেস সংযোগে ত্রুটি দেখা দিয়েছে।`,
          agent_solution: "ডাটাবেস সংযোগ পুনঃযাচাই করুন অথবা স্কিমা পারমিশন আপডেট করুন।",
        });
      }
    }
    if (!c.issues.some((issue) => issue.area === "ডাটাবেস")) c.passed.push("ডাটাবেস (সকল প্রয়োজনীয় টেবিল সচল)");
  },

  async settingsConsistency(c) {
    if (!c.settings) {
      c.issues.push({
        id: "settings:missing",
        area: "সেটিংস",
        title: "এআই সেটিংস অনুপস্থিত",
        detail: "ডাটাবেসে ai_settings পাওয়া যায়নি",
        severity: "critical",
        root_cause: "সিস্টেমের ডিফল্ট এআই কনফিগারেশন মুছে গেছে বা সেট করা হয়নি।",
        agent_solution: "এআই এজেন্ট স্বয়ংক্রিয়ভাবে ডিফল্ট সেটিংস (Google Gemini / GPT) তৈরি করে দেবে।",
        fix: "create_settings",
        fixLabel: "ডিফল্ট সেটিংস তৈরি করুন",
      });
      return;
    }

    if (c.settings.chat_enabled === false) {
      c.issues.push({
        id: "settings:chat_off",
        area: "চ্যাট",
        title: "ব্যবহারকারীদের জন্য চ্যাট বন্ধ রাখা হয়েছে",
        detail: "chat_enabled = false",
        severity: "warning",
        root_cause: "অ্যাডমিন প্যানেল থেকে চ্যাট বন্ধ করা আছে, ফলে সাধারণ ইউজাররা প্রশ্ন করতে পারছেন না।",
        agent_solution: "এক ক্লিকে সবার জন্য চ্যাট পুনরায় চালু করতে পারেন।",
        fix: "enable_chat",
        fixLabel: "চ্যাট চালু করুন",
      });
    }

    const provider = c.settings.provider;
    const rawPool = Array.isArray(c.keys?.key_pool) ? c.keys.key_pool : [];

    if (provider === "openai" && !c.keys?.openai_key?.trim() && !rawPool.some((p: any) => p?.provider === "openai" && p?.key?.trim())) {
      c.issues.push({
        id: "settings:no_openai_key",
        area: "OpenAI এপিআই",
        title: "OpenAI প্রোভাইডার নির্বাচিত কিন্তু কোনো OpenAI API Key নেই",
        detail: "অ্যাডমিন প্যানেলে OpenAI কী প্রদান করা হয়নি",
        severity: "critical",
        root_cause: "সক্রিয় এআই প্রোভাইডার হিসেবে OpenAI রাখা হয়েছে, কিন্তু উপযুক্ত OpenAI কী অনুপস্থিত।",
        agent_solution: "একটি বৈধ OpenAI API Key প্রদান করুন অথবা স্বয়ংক্রিয়ভাবে সচল প্রোভাইডারে সুইচ করুন।",
        fix: "switch_to_working_provider",
        fixLabel: "সচল প্রোভাইডারে সুইচ করুন",
      });
    }

    if (provider === "deepseek" && !rawPool.some((p: any) => p?.provider === "deepseek" && p?.key?.trim()) && !process.env["DEEPSEEK_API_KEY"]) {
      c.issues.push({
        id: "settings:no_deepseek_key",
        area: "DeepSeek এপিআই",
        title: "DeepSeek প্রোভাইডার নির্বাচিত কিন্তু কোনো DeepSeek API Key নেই",
        detail: "DeepSeek কী সেট করা নেই",
        severity: "critical",
        root_cause: "DeepSeek নির্বাচিত থাকা সত্ত্বেও কোনো DeepSeek API Key নেই।",
        agent_solution: "DeepSeek API Key দিন অথবা সচল প্রোভাইডারে সুইচ করুন।",
        fix: "switch_to_working_provider",
        fixLabel: "সচল প্রোভাইডারে সুইচ করুন",
      });
    }

    c.passed.push("কনফিগারেশন ও সেটিংস সামঞ্জস্য");
  },

  async googleProvider(c) {
    const key = c.keys?.google_key?.trim() || process.env["GOOGLE_API_KEY"];
    if (!key) {
      if (c.settings?.provider === "google") {
        c.issues.push({
          id: "google:nokey",
          area: "Google Gemini",
          title: "Google Gemini API Key সেট করা নেই",
          detail: "ai_keys টেবিলে google_key অনুপস্থিত",
          severity: "critical",
          root_cause: "Google Gemini মোড চালু আছে কিন্তু কোনো API Key দেওয়া হয়নি।",
          agent_solution: "Google AI Studio থেকে একটি বিনামূল্যে API Key এনে অ্যাডমিনে বসান।",
        });
      }
      return;
    }

    const testModel = c.settings?.provider === "google" ? (c.settings?.model || "gemini-3.8-flash") : "gemini-2.5-flash";
    const res = await safeChatCall(GOOGLE_CHAT, key, testModel, "Test ok");
    if (res.ok) {
      c.passed.push(`Google Gemini API (${testModel} সচল ও সাড়া দিচ্ছে)`);
      return;
    }

    const err = classifyError(res.status, res.text);
    c.issues.push({
      id: "google:failing",
      area: "Google Gemini",
      title: `Google Gemini কাজ করছে না — ${err.label}`,
      detail: `${testModel} [HTTP ${res.status}]: ${res.text.slice(0, 160)}`,
      severity: "critical",
      root_cause: `Google এপিআই রেসপন্স কোড ${res.status}: ${res.text}`,
      agent_solution: err.type === "model" ? "মডেল পরিবর্তন করে সচল gemini-2.5-flash বা gemini-3.8-flash নির্বাচন করুন।" : "API Key ও কোটা যাচাই করুন।",
      ...(err.type === "model" ? { fix: "switch_google_model", fixLabel: "সচল Google মডেলে পরিবর্তন করুন" } : {}),
    });
  },

  async openaiProvider(c) {
    const rawPool = Array.isArray(c.keys?.key_pool) ? c.keys.key_pool : [];
    const key = c.keys?.openai_key?.trim() || rawPool.find((p: any) => p?.provider === "openai")?.key?.trim() || process.env["OPENAI_API_KEY"];
    if (!key) {
      if (c.settings?.provider === "openai") {
        c.issues.push({
          id: "openai:nokey",
          area: "OpenAI",
          title: "OpenAI API Key সেট করা নেই",
          detail: "OpenAI কী অনুপস্থিত",
          severity: "critical",
          root_cause: "OpenAI মোড চালু আছে কিন্তু API Key দেওয়া নেই।",
          agent_solution: "OpenAI প্ল্যাটফর্ম (platform.openai.com) থেকে API Key এনে সেকশন ৪-এ দিন।",
        });
      }
      return;
    }

    const testModel = "gpt-6-astra";
    const res = await safeChatCall(OPENAI_CHAT, key, testModel, "Reply with OK.", true);
    if (res.ok) {
      c.passed.push("OpenAI API (gpt-6-astra সচল ও সঠিক)");
      return;
    }

    const err = classifyError(res.status, res.text);
    c.issues.push({
      id: "openai:failing",
      area: "OpenAI",
      title: `OpenAI API কাজ করছে না — ${err.label}`,
      detail: `gpt-6-astra [HTTP ${res.status}]: ${res.text.slice(0, 160)}`,
      severity: "critical",
      root_cause: `OpenAI এন্ডপয়েন্ট রেসপন্স কোড ${res.status}: ${res.text}`,
      agent_solution: err.type === "quota"
        ? "OpenAI অ্যাকাউন্টে পর্যাপ্ত ক্রেডিট (Billing Credit Balance) নেই। ক্রেডিট যোগ করুন অথবা অন্য সচল প্রোভাইডারে সুইচ করুন।"
        : err.type === "auth"
        ? "OpenAI API Key-টি ভুল বা নিষ্ক্রিয়। নতুন কী জেনারেট করে অ্যাডমিনে বসান।"
        : "এআই এজেন্টের স্বয়ংক্রিয় হিলিং দিয়ে মডেল কনফিগারেশন ঠিক করুন।",
      fix: "fix_openai",
      fixLabel: "OpenAI কনফিগারেশন মেরামত করুন",
    });
  },

  async deepseekProvider(c) {
    const rawPool = Array.isArray(c.keys?.key_pool) ? c.keys.key_pool : [];
    const key = rawPool.find((p: any) => p?.provider === "deepseek")?.key?.trim() || process.env["DEEPSEEK_API_KEY"];
    if (!key) {
      if (c.settings?.provider === "deepseek") {
        c.issues.push({
          id: "deepseek:nokey",
          area: "DeepSeek",
          title: "DeepSeek API Key সেট করা নেই",
          detail: "DeepSeek কী পাওয়া যায়নি",
          severity: "critical",
          root_cause: "DeepSeek প্রোভাইডার নির্বাচিত হলেও কোনো কী পুলে বা সেটিংসে নেই।",
          agent_solution: "অ্যাডমিন প্যানেলে DeepSeek API Key যোগ করুন।",
        });
      }
      return;
    }

    const testModel = "deepseek-flash";
    const res = await safeChatCall(DEEPSEEK_CHAT, key, testModel, "Test ok", false);
    if (res.ok) {
      c.passed.push("DeepSeek API (deepseek-flash সচল)");
      return;
    }

    const err = classifyError(res.status, res.text);
    c.issues.push({
      id: "deepseek:failing",
      area: "DeepSeek",
      title: `DeepSeek API কাজ করছে না — ${err.label}`,
      detail: `[HTTP ${res.status}]: ${res.text.slice(0, 160)}`,
      severity: "critical",
      root_cause: `DeepSeek এন্ডপয়েন্ট রেসপন্স: ${res.text}`,
      agent_solution: err.type === "quota" ? "DeepSeek অ্যাকাউন্টে টপ-আপ ব্যালেন্স যোগ করুন।" : "DeepSeek কী যাচাই করুন।",
      fix: "fix_deepseek",
      fixLabel: "DeepSeek মেরামত করুন",
    });
  },

  async claudeProvider(c) {
    const hasGateway = !!process.env["LOVABLE_API_KEY"];
    const rawPool = Array.isArray(c.keys?.key_pool) ? c.keys.key_pool : [];
    const directAnthropic = rawPool.find((p: any) => (p?.provider === "claude" || p?.provider === "anthropic") && p?.key?.trim());
    const configured = !!directAnthropic || hasGateway;
    if (c.settings?.provider !== "claude") return;
    if (!configured) {
      c.issues.push({
        id: "claude:nokey",
        area: "Claude",
        title: "Claude চালানোর জন্য কোনো API Key নেই",
        detail: "Anthropic API Key বা Lovable Gateway কী পাওয়া যায়নি",
        severity: "critical",
        root_cause: "Claude নির্বাচন করা আছে কিন্তু Anthropic API Key বা গেটওয়ে নেই।",
        agent_solution: "Anthropic API Key যোগ করুন অথবা সচল প্রোভাইডারে সুইচ করুন।",
        fix: "switch_to_working_provider",
        fixLabel: "সচল প্রোভাইডারে সুইচ করুন",
      });
      return;
    }
    c.issues.push({
      id: "claude:unverified",
      area: "Claude",
      title: "Claude কী কনফিগার করা আছে, তবে লাইভ পরীক্ষা করা হয়নি",
      detail: directAnthropic ? "Anthropic key pool entry পাওয়া গেছে; provider auth/model live যাচাই বাকি।" : "Lovable Gateway key আছে; Claude Messages API-তে live request করা হয়নি।",
      severity: "info",
      root_cause: "স্ক্যান কেবল কী উপস্থিতি দেখে; এটিকে সচল API পরীক্ষা হিসেবে ধরা যাবে না।",
      agent_solution: "চ্যাটে Claude নির্বাচন করে একটি পরীক্ষামূলক অনুরোধ পাঠান; স্ক্যান এটিকে সচল বলে গণ্য করছে না।",
    });
  },

  async keyPool(c) {
    const pool: any[] = Array.isArray(c.keys?.key_pool) ? c.keys.key_pool : [];
    await Promise.all(
      pool.map(async (p, i) => {
        if (p?.active === false || (!p?.key?.trim() && p?.provider !== "ollama")) return;

        let url = GOOGLE_CHAT;
        let model = p?.model?.trim() || "gemini-2.5-flash";

        if (p.provider === "openai") {
          url = OPENAI_CHAT;
          model = p?.model?.trim() || "gpt-6-astra";
        } else if (p.provider === "deepseek") {
          url = DEEPSEEK_CHAT;
          model = p?.model?.trim() || "deepseek-flash";
        } else if (p.provider === "custom" && p.base_url?.startsWith("https://")) {
          const b = p.base_url.replace(/\/$/, "");
          url = b.endsWith("/chat/completions") ? b : b.endsWith("/v1") ? `${b}/chat/completions` : `${b}/v1/chat/completions`;
        } else if (p.provider === "ollama") {
          if (!p.base_url?.startsWith("https://")) {
            c.issues.push({
              id: `pool:ollama:${i}`,
              area: "কী-পুল",
              title: `Ollama কী #${i + 1}-এ সঠিক HTTPS URL নেই`,
              detail: "ক্লাউড অ্যাপ থেকে লোকালহোস্টে সরাসরি পৌঁছানো যায় না",
              severity: "warning",
              root_cause: "Ollama সার্ভারের জন্য পাবলিক HTTPS রিচেবল ডোমেন প্রয়োজন।",
              agent_solution: "Cloudflare Tunnel বা এনগ্রক দিয়ে Ollama এক্সপোজ করুন এবং HTTPS URL দিন।",
            });
            return;
          }
          return;
        }

        const r = await safeChatCall(url, p.key.trim(), model, "ok");
        if (r.ok) {
          c.passed.push(`ব্যাকআপ ইঞ্জিন #${i + 1}: ${p.name || p.provider}`);
        } else {
          const err = classifyError(r.status, r.text);
          c.issues.push({
            id: `pool:${i}`,
            area: "কী-পুল",
            title: `ব্যাকআপ কী "${p.name || `কী ${i + 1}`}" কাজ করছে না — ${err.label}`,
            detail: `${model} [HTTP ${r.status}]: ${r.text.slice(0, 140)}`,
            severity: "warning",
            root_cause: `ব্যাকআপ কী ব্যর্থতার বিবরণ: ${r.text}`,
            agent_solution: "নিষ্ক্রিয় বা অকার্যকর কী-টিকে নিষ্ক্রিয় (inactive) করে দিন যাতে চ্যাটে অপ্রয়োজনীয় দেরি না হয়।",
            fix: `disable_pool:${i}`,
            fixLabel: "কী নিষ্ক্রিয় করুন",
          });
        }
      })
    );
  },

  async vision(c) {
    const key = c.keys?.google_key?.trim() || process.env["GOOGLE_API_KEY"];
    if (!key) return;
    const r = await safeChatCall(GOOGLE_CHAT, key, "gemini-2.5-flash", [
      { type: "text", text: "What color? one word" },
      { type: "image_url", image_url: { url: TINY_PNG } },
    ]);
    if (r.ok) {
      c.passed.push("ছবি বিশ্লেষণ ও মাল্টিমোডাল এআই");
    } else {
      c.issues.push({
        id: "vision",
        area: "ছবি",
        title: `ছবি বিশ্লেষণ ব্যর্থ হয়েছে`,
        detail: r.text.slice(0, 160),
        severity: "warning",
        root_cause: "মাল্টিমোডাল টেস্ট ইমেজে এআই রেসপন্স দেয়নি।",
        agent_solution: "Google Gemini মডেল আপডেট করুন।",
      });
    }
  },

  async search(c) {
    const r = await fetch("https://html.duckduckgo.com/html/", {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
        Accept: "text/html",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "q=bangladesh",
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);

    if (r?.ok && /result__a/.test(await r.text())) {
      c.passed.push("ওয়েব অনুসন্ধান ইঞ্জিন (DuckDuckGo সচল)");
      return;
    }

    const b = await fetch("https://www.bing.com/search?q=bangladesh", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36" },
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);

    if (b?.ok && /b_algo/.test(await b.text())) {
      c.passed.push("ওয়েব অনুসন্ধান (Bing ব্যাকআপ সচল)");
      return;
    }

    c.issues.push({
      id: "search",
      area: "ওয়েব অনুসন্ধান",
      title: "ওয়েব সার্চ ইঞ্জিন সাড়া দিচ্ছে না",
      detail: `স্ট্যাটাস ${r?.status ?? "নেটওয়ার্ক"}`,
      severity: "warning",
      root_cause: "সার্চ ইঞ্জিনের রেট লিমিট বা আইপি ব্লকিংয়ের কারণে লাইভ তথ্য আসতে দেরি হতে পারে।",
      agent_solution: "অ্যাপ নিজস্ব জ্ঞান ও মেমরি থেকে সতর্কতা দিয়ে উত্তর প্রদান অব্যাহত রাখবে।",
    });
  },

  async memory(c) {
    const { error } = await c.admin.from("user_memories").select("id", { head: true, count: "exact" });
    if (error) {
      c.issues.push({
        id: "memory",
        area: "স্মৃতি",
        title: "ব্যবহারকারীর দীর্ঘমেয়াদী স্মৃতি পড়া যাচ্ছে না",
        detail: error.message,
        severity: "warning",
        root_cause: "user_memories টেবিলে RLS বা ইনডেক্স সমস্যা।",
        agent_solution: "স্মৃতি টেবিলের এক্সেস রিস্টোর করুন।",
      });
      return;
    }
    c.passed.push("ব্যবহারকারীর দীর্ঘমেয়াদী স্মৃতি ও মেমরি ইঞ্জিন");
  },

  async adminCheck(c) {
    const { data } = await c.admin.auth.admin.listUsers({ perPage: 1000 });
    const u = data?.users?.find((x: any) => x.email?.toLowerCase() === FOUNDER);
    if (!u) {
      c.issues.push({
        id: "admin:nouser",
        area: "অ্যাডমিন",
        title: "প্রতিষ্ঠাতার একাউন্ট পাওয়া যায়নি",
        detail: `${FOUNDER} দিয়ে লগইন করা প্রয়োজন`,
        severity: "critical",
        root_cause: "প্রতিষ্ঠাতার ইমেইল সিস্টেমে রেজিস্টার্ড নেই।",
        agent_solution: `${FOUNDER} দিয়ে অন্তত একবার লগইন সম্পন্ন করুন।`,
      });
      return;
    }

    const { data: ok } = await c.admin.rpc("has_role", { _user_id: u.id, _role: "admin" });
    if (!ok) {
      c.issues.push({
        id: "admin:role",
        area: "অ্যাডমিন",
        title: "প্রতিষ্ঠাতাকে অ্যাডমিন হিসেবে চিহ্নিত করা যাচ্ছে না",
        detail: FOUNDER,
        severity: "critical",
        root_cause: "user_roles টেবিলে প্রতিষ্ঠাতার অ্যাডমিন ভূমিকা অনুপস্থিত।",
        agent_solution: "এক ক্লিকে অ্যাডমিন রোল স্বয়ংক্রিয়ভাবে পুনরুদ্ধার করুন।",
        fix: "restore_admin",
        fixLabel: "অ্যাডমিন পুনরুদ্ধার করুন",
      });
    } else {
      c.passed.push("অ্যাডমিন ভূমিকা (মোঃ শামীম আহসান - প্রতিষ্ঠাতা)");
    }
  },
};

async function scan(admin: any): Promise<{ issues: Issue[]; passed: string[]; at: string; agent_summary: string }> {
  const [{ data: settings }, { data: keys }] = await Promise.all([
    admin.from("ai_settings").select("*").eq("id", 1).maybeSingle(),
    admin.from("ai_keys").select("*").eq("id", 1).maybeSingle(),
  ]);

  const c: Ctx = { admin, settings, keys, issues: [], passed: [] };

  await Promise.all(
    Object.entries(PROBES).map(async ([name, fn]) => {
      try {
        await fn(c);
      } catch (e) {
        c.issues.push({
          id: `crash:${name}`,
          area: name,
          title: `অপ্রত্যাশিত ব্যতিক্রম (${name})`,
          detail: e instanceof Error ? e.message : String(e),
          severity: "warning",
          root_cause: `প্রোব চলাকালীন এরর: ${String(e)}`,
          agent_solution: "সিস্টেম স্বয়ংক্রিয়ভাবে অন্যান্য প্রোভাইডার ব্যবহার করবে।",
        });
      }
    })
  );

  const criticalCount = c.issues.filter((i) => i.severity === "critical").length;
  const warningCount = c.issues.filter((i) => i.severity === "warning").length;

  let agent_summary = "✅ স্ক্যান করা পরীক্ষা সফল হয়েছে। এটি শুধু তালিকাভুক্ত সংযোগ ও সেটিংস পরীক্ষা করেছে, পুরো সিস্টেমের ত্রুটিমুক্তির নিশ্চয়তা নয়।";
  if (criticalCount > 0) {
    agent_summary = `⚠️ ডায়াগনস্টিক ${criticalCount}টি গুরুতর সমস্যা এবং ${warningCount}টি সতর্কতা শনাক্ত করেছে। নিচের নির্দিষ্ট মেরামতই চালানো যাবে; API কী, বিলিং বা কোড স্বয়ংক্রিয়ভাবে পরিবর্তন করা হবে না।`;
  } else if (warningCount > 0) {
    agent_summary = `ℹ️ ডায়াগনস্টিক ${warningCount}টি সতর্কতা শনাক্ত করেছে। সফল স্ক্যান কেবল তালিকাভুক্ত পরীক্ষাগুলোর ফল, সব ফিচারের নিশ্চয়তা নয়।`;
  }

  return { issues: c.issues, passed: c.passed, at: new Date().toISOString(), agent_summary };
}

async function repair(admin: any, fix: string): Promise<string> {
  // Automated repair is intentionally bounded: do not enable chat, restore roles,
  // disable keys, or alter billing/security settings without explicit user action.
  if (fix === "heal_all" || fix === "auto_heal" || fix === "switch_to_working_provider") {
    const { data: s } = await admin.from("ai_settings").select("provider,model").eq("id", 1).maybeSingle();
    const { data: k } = await admin.from("ai_keys").select("google_key,openai_key,key_pool").eq("id", 1).maybeSingle();
    const pool: any[] = Array.isArray(k?.key_pool) ? k.key_pool.filter((p: any) => p?.active !== false) : [];
    const candidates: { provider: string; model: string; url: string; key: string; gateway?: boolean }[] = [];

    const googleKey = k?.google_key?.trim() || process.env["GOOGLE_API_KEY"] || pool.find((p) => p?.provider === "google" && p?.key?.trim())?.key?.trim();
    if (googleKey) for (const model of WORKING_GOOGLE_MODELS) candidates.push({ provider: "google", model, url: GOOGLE_CHAT, key: googleKey });
    const openaiKey = k?.openai_key?.trim() || process.env["OPENAI_API_KEY"] || pool.find((p) => p?.provider === "openai" && p?.key?.trim())?.key?.trim();
    if (openaiKey) candidates.push({ provider: "openai", model: "gpt-6-astra", url: OPENAI_CHAT, key: openaiKey });
    const deepseekKey = process.env["DEEPSEEK_API_KEY"] || pool.find((p) => p?.provider === "deepseek" && p?.key?.trim())?.key?.trim();
    if (deepseekKey) candidates.push({ provider: "deepseek", model: "deepseek-flash", url: DEEPSEEK_CHAT, key: deepseekKey });
    const lovableKey = process.env["LOVABLE_API_KEY"];
    if (lovableKey) candidates.push({ provider: "lovable", model: "openai/gpt-6-astra", url: "https://ai.gateway.lovable.dev/v1/chat/completions", key: lovableKey });

    // Prefer the selected provider if its live probe succeeds; otherwise use the first verified fallback.
    candidates.sort((a, b) => Number(b.provider === s?.provider) - Number(a.provider === s?.provider));
    for (const c of candidates) {
      const result = await safeChatCall(c.url, c.key, c.model, "Reply with OK.");
      if (!result.ok) continue;
      if (c.provider !== s?.provider || c.model !== s?.model) {
        const { error } = await admin.from("ai_settings").update({ provider: c.provider, model: c.model }).eq("id", 1);
        if (error) throw new Error(`সচল প্রোভাইডার পাওয়া গেছে, কিন্তু সেটিংস সংরক্ষণ ব্যর্থ: ${error.message}`);
        return `যাচাইকৃত ${c.provider} (${c.model}) সচল পাওয়া গেছে এবং সক্রিয় প্রোভাইডার হিসেবে সেট করা হয়েছে। চ্যাট চালু/বন্ধ সেটিংস অপরিবর্তিত আছে।`;
      }
      return `বর্তমান ${c.provider} (${c.model}) কী-তে পরীক্ষামূলক অনুরোধ সফল হয়েছে; প্রোভাইডার সেটিংস অপরিবর্তিত রাখা হয়েছে।`;
    }
    throw new Error("কনফিগার করা Gemini, OpenAI বা DeepSeek API-র কোনোটিতেই সফল পরীক্ষামূলক উত্তর পাওয়া যায়নি। কী, মডেল, অনুমতি ও provider billing dashboard যাচাই করুন; কোনো সেটিংস বদলানো হয়নি।");
  }

  // 2. Specific Individual Fixes
  if (fix === "enable_chat") {
    await admin.from("ai_settings").update({ chat_enabled: true }).eq("id", 1);
    return "চ্যাট সফলভাবে চালু করা হয়েছে";
  }

  if (fix === "create_settings") {
    await admin.from("ai_settings").upsert({
      id: 1,
      provider: "google",
      model: "gemini-3.8-flash",
      chat_enabled: true,
      reasoning_effort: "low",
    });
    return "ডিফল্ট সেটিংস সফলভাবে তৈরি হয়েছে";
  }

  if (fix === "fix_openai") {
    const { data: k } = await admin.from("ai_keys").select("openai_key,key_pool").eq("id", 1).maybeSingle();
    const pool: any[] = Array.isArray(k?.key_pool) ? k.key_pool : [];
    const key = k?.openai_key?.trim() || pool.find((p) => p?.provider === "openai" && p?.key?.trim())?.key?.trim() || process.env["OPENAI_API_KEY"];
    if (!key) throw new Error("OpenAI API key পাওয়া যায়নি; কোনো সেটিংস বদলানো হয়নি।");
    const test = await safeChatCall(OPENAI_CHAT, key, "gpt-6-astra", "Reply with OK.", true);
    if (!test.ok) throw new Error(`OpenAI-এর live test ব্যর্থ (HTTP ${test.status}); কী, quota বা access যাচাই করুন। কোনো সেটিংস বদলানো হয়নি।`);
    const { error } = await admin.from("ai_settings").update({ provider: "openai", model: "gpt-6-astra" }).eq("id", 1);
    if (error) throw new Error(error.message);
    return "OpenAI gpt-6-astra-তে লাইভ পরীক্ষা সফল হয়েছে; যাচাইকৃত প্রোভাইডার সেট করা হয়েছে।";
  }

  if (fix === "fix_deepseek") {
    const { data: k } = await admin.from("ai_keys").select("key_pool").eq("id", 1).maybeSingle();
    const pool: any[] = Array.isArray(k?.key_pool) ? k.key_pool : [];
    const key = pool.find((p) => p?.provider === "deepseek" && p?.key?.trim())?.key?.trim() || process.env["DEEPSEEK_API_KEY"];
    if (!key) throw new Error("DeepSeek API key পাওয়া যায়নি; কোনো সেটিংস বদলানো হয়নি।");
    const test = await safeChatCall(DEEPSEEK_CHAT, key, "deepseek-flash", "Reply with OK.");
    if (!test.ok) throw new Error(`DeepSeek-এর live test ব্যর্থ (HTTP ${test.status}); কী, quota বা access যাচাই করুন। কোনো সেটিংস বদলানো হয়নি।`);
    const { error } = await admin.from("ai_settings").update({ provider: "deepseek", model: "deepseek-flash" }).eq("id", 1);
    if (error) throw new Error(error.message);
    return "DeepSeek deepseek-flash-এ লাইভ পরীক্ষা সফল হয়েছে; যাচাইকৃত প্রোভাইডার সেট করা হয়েছে।";
  }

  if (fix === "switch_google_model") {
    const { data: k } = await admin.from("ai_keys").select("google_key").eq("id", 1).maybeSingle();
    const key = k?.google_key?.trim() || process.env["GOOGLE_API_KEY"];
    for (const m of WORKING_GOOGLE_MODELS) {
      if ((await safeChatCall(GOOGLE_CHAT, key, m, "ok")).ok) {
        await admin.from("ai_settings").update({ model: m, provider: "google" }).eq("id", 1);
        return `সচল Google মডেল ${m}-এ পরিবর্তন করা হয়েছে`;
      }
    }
    throw new Error("কোনো সচল Google মডেল পাওয়া যায়নি");
  }

  if (fix === "switch_to_working_provider") {
    const { data: k } = await admin.from("ai_keys").select("*").eq("id", 1).maybeSingle();
    const gKey = k?.google_key?.trim() || process.env["GOOGLE_API_KEY"];
    if (gKey && (await safeChatCall(GOOGLE_CHAT, gKey, "gemini-3.8-flash", "ok")).ok) {
      await admin.from("ai_settings").update({ provider: "google", model: "gemini-3.8-flash" }).eq("id", 1);
      return "সচল Google Gemini (gemini-3.8-flash) প্রোভাইডারে সুইচ করা হয়েছে";
    }
    const oKey = k?.openai_key?.trim() || process.env["OPENAI_API_KEY"];
    if (oKey && (await safeChatCall(OPENAI_CHAT, oKey, "gpt-6-astra", "ok", true)).ok) {
      await admin.from("ai_settings").update({ provider: "openai", model: "gpt-6-astra" }).eq("id", 1);
      return "সচল OpenAI (gpt-6-astra) প্রোভাইডারে সুইচ করা হয়েছে";
    }
    if (process.env["LOVABLE_API_KEY"]) {
      await admin.from("ai_settings").update({ provider: "lovable", model: "openai/gpt-6-astra" }).eq("id", 1);
      return "বিল্ট-ইন Lovable AI প্রোভাইডারে সুইচ করা হয়েছে";
    }
    throw new Error("কোনো সচল এপিআই কী পাওয়া যায়নি — নতুন কী প্রদান করুন");
  }

  if (fix.startsWith("disable_pool:")) {
    const i = Number(fix.split(":")[1]);
    const { data: k } = await admin.from("ai_keys").select("key_pool").eq("id", 1).maybeSingle();
    const pool = Array.isArray(k?.key_pool) ? [...k.key_pool] : [];
    if (pool[i]) pool[i] = { ...pool[i], active: false };
    await admin.from("ai_keys").update({ key_pool: pool }).eq("id", 1);
    return "অকার্যকর কী-টি নিষ্ক্রিয় করা হয়েছে (মুছে ফেলা হয়নি)";
  }

  if (fix === "restore_admin") {
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const u = data?.users?.find((x: any) => x.email?.toLowerCase() === FOUNDER);
    if (!u) throw new Error("প্রতিষ্ঠাতার একাউন্ট পাওয়া যায়নি");
    await admin.from("user_roles").upsert({ user_id: u.id, role: "admin" }, { onConflict: "user_id,role" });
    return "প্রতিষ্ঠাতার অ্যাডমিন রোল সফলভাবে পুনরুদ্ধার করা হয়েছে";
  }

  throw new Error("অজানা সমাধান কমান্ড");
}

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });
        const pub = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: u, error: ue } = await pub.auth.getUser(token);
        if (ue || !u.user) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
        if (!isAdmin) return new Response("শুধু অ্যাডমিন", { status: 403 });

        const body = await request.json().catch(() => ({}));
        let repaired: { ok: boolean; message: string } | undefined;
        if (typeof body?.fix === "string") {
          try {
            repaired = { ok: true, message: await repair(supabaseAdmin, body.fix) };
          } catch (e) {
            repaired = { ok: false, message: e instanceof Error ? e.message : String(e) };
          }
        }
        const scanRes = await scan(supabaseAdmin);
        const results = { ...scanRes, repaired };
        await supabaseAdmin.from("health_checks").insert({ results });
        return Response.json(results);
      },
    },
  },
});
