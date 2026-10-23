export type Provider = "lovable" | "claude" | "google" | "openai" | "deepseek" | "ollama";

export const LOVABLE_MODELS = [
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (সবচেয়ে শক্তিশালী যুক্তি)" },
  { id: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash (দ্রুত ও শক্তিশালী)" },
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash" },
  { id: "google/gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite (সাশ্রয়ী)" },
  { id: "openai/gpt-6-astra", label: "GPT-6 Astra (সর্বোচ্চ ক্ষমতা)" },
  { id: "openai/gpt-6-sol", label: "GPT-6 Sol" },
  { id: "openai/gpt-5.5", label: "GPT-5.5" },
];

export const CLAUDE_MODELS = [
  { id: "claude-opus-5", label: "Claude Opus 5 (জটিল বিশ্লেষণ ও কোডিং)" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5 (গতি ও বুদ্ধিমত্তার ভারসাম্য)" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (দ্রুত)" },
];

export const GOOGLE_MODELS = [
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash (সর্বশেষ, দ্রুত ও শক্তিশালী)" },
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite (সাশ্রয়ী)" },
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash" },
  { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (পেইড কী লাগে)" },
];

export const OPENAI_MODELS = [
  { id: "gpt-5.5", label: "GPT-5.5" },
  { id: "gpt-4.1", label: "GPT-4.1" },
  { id: "gpt-4o", label: "GPT-4o" },
];

export const DEEPSEEK_MODELS = [
  { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro (গভীর বিশ্লেষণ)" },
  { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash (দ্রুত)" },
];

export const OLLAMA_MODELS = [
  { id: "deepseek-r1:latest", label: "DeepSeek R1 (নিজের Ollama সার্ভার)" },
  { id: "llama3.3:latest", label: "Llama 3.3 (নিজের Ollama সার্ভার)" },
  { id: "qwen2.5:latest", label: "Qwen 2.5 (নিজের Ollama সার্ভার)" },
  { id: "mistral:latest", label: "Mistral (নিজের Ollama সার্ভার)" },
];

export const DEFAULT_MODELS: Record<Provider, string> = {
  lovable: "openai/gpt-6-astra",
  claude: "claude-sonnet-5",
  google: "gemini-3.8-flash",
  openai: "gpt-5.5",
  deepseek: "deepseek-v4-flash",
  ollama: "deepseek-r1:latest",
};
