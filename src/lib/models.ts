// অনুমোদিত ৪টি মূল প্রোভাইডার
export type Provider = "google" | "groq" | "openrouter" | "openai";

export const GOOGLE_MODELS = [
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash (ডিফল্ট, দ্রুত ও শক্তিশালী)" },
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite (অতি দ্রুত ও ফ্রি টিয়ার)" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (গভীর বিশ্লেষণ)" },
];

export const GROQ_MODELS = [
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile" },
  { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant (দ্রুত)" },
  { id: "openai/gpt-oss-120b", label: "GPT OSS 120B (Groq reasoning)" },
  { id: "openai/gpt-oss-20b", label: "GPT OSS 20B (Groq দ্রুত)" },
];

export const OPENROUTER_MODELS = [
  { id: "openrouter/free", label: "OpenRouter Free Router (স্বয়ংক্রিয় সেরা ফ্রি মডেল)" },
  { id: "google/gemma-4-31b-it:free", label: "Google Gemma 4 31B (ফ্রি)" },
  { id: "cohere/north-mini-code:free", label: "Cohere North Mini Code (ফ্রি)" },
  { id: "recursive/flint-v1.0:free", label: "Recursive Flint (ফ্রি কোডিং)" },
];

export const OPENAI_MODELS = [
  { id: "gpt-6-astra", label: "GPT-6 Astra (অফিশিয়াল OpenAI - গভীর যুক্তি)" },
  { id: "gpt-6.1-sol", label: "GPT-6.1 Sol (ভারসাম্যপূর্ণ ও শক্তিশালী)" },
  { id: "gpt-6-luna", label: "GPT-6 Luna (দ্রুত ও সাশ্রয়ী)" },
  { id: "gpt-4o", label: "GPT-4o (পূর্ববর্তী OpenAI মডেল)" },
  { id: "o3-mini", label: "o3-mini (উন্নত যুক্তি ও কোডিং)" },
];

// ব্যবহারকারী চ্যাটবক্স পপওভারে প্রদর্শনের জন্য মডেল তালিকা (ডিফল্ট Google/OpenAI এর সেরা মডেল)
export const CHAT_PICKER_MODELS = [
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash (দ্রুত ও শক্তিশালী)" },
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite (হালকা ও দ্রুত)" },
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Groq)" },
  { id: "openrouter/free", label: "OpenRouter Free (ফ্রি অটো)" },
  { id: "gpt-6-astra", label: "GPT-6 Astra (OpenAI)" },
];

// Backward-compatibility alias
export const LOVABLE_MODELS = CHAT_PICKER_MODELS;

export const DEFAULT_MODELS: Record<Provider, string> = {
  google: "gemini-3.8-flash",
  groq: "llama-3.3-70b-versatile",
  openrouter: "openrouter/free",
  openai: "gpt-6-astra",
};
