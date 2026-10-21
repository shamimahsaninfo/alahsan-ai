export type Provider = "lovable" | "google" | "openai";

export const LOVABLE_MODELS = [
  { id: "openai/gpt-6-astra", label: "GPT-6 Astra (সর্বোচ্চ ক্ষমতা ও গভীর যুক্তি)" },
  { id: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash (অতি দ্রুত ও শক্তিশালী)" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (জটিল প্রোগ্রামিং)" },
  { id: "google/gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite (সাশ্রয়ী)" },
  { id: "openai/gpt-5.5", label: "GPT-5.5" },
];

export const GOOGLE_MODELS = [
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash (সর্বশেষ Google API)" },
  { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" },
];

export const OPENAI_MODELS = [
  { id: "gpt-5.5", label: "GPT-5.5" },
  { id: "gpt-4.1", label: "GPT-4.1" },
  { id: "gpt-4o", label: "GPT-4o" },
];

export const DEFAULT_MODELS: Record<Provider, string> = {
  lovable: "openai/gpt-6-astra",
  google: "gemini-3.8-flash",
  openai: "gpt-5.5",
};
