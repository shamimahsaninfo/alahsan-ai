export type Provider = "lovable" | "claude" | "google" | "openai" | "deepseek" | "groq" | "openrouter" | "ollama";

export const LOVABLE_MODELS = [
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (সবচেয়ে শক্তিশালী যুক্তি)" },
  { id: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash (দ্রুত ও শক্তিশালী)" },
  { id: "google/gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite (সাশ্রয়ী)" },
  { id: "openai/gpt-6-astra", label: "GPT-6 Astra (সর্বোচ্চ ক্ষমতা)" },
  { id: "openai/gpt-6.1-sol", label: "GPT-6.1 Sol" },
  { id: "openai/gpt-6-luna", label: "GPT-6 Luna" },
];

export const CLAUDE_MODELS = [
  { id: "claude-sonnet-5", label: "Claude Sonnet 5 (গতি, বুদ্ধি ও কোডিংয়ের ভারসাম্য)" },
  { id: "claude-opus-5", label: "Claude Opus 5 (গভীর বিশ্লেষণ ও জটিল সমস্যা)" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (অতি দ্রুত)" },
  { id: "claude-3-7-sonnet-20250219", label: "Claude 3.7 Sonnet (Anthropic API)" },
];

export const GOOGLE_MODELS = [
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash (দ্রুত ও শক্তিশালী - ডিফল্ট)" },
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite (অতি দ্রুত ও ফ্রি টিয়ার)" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (গভীর বিশ্লেষণ)" },
];

export const OPENAI_MODELS = [
  { id: "gpt-6-astra", label: "GPT-6 Astra (অফিশিয়াল OpenAI - গভীর যুক্তি ও কোডিং)" },
  { id: "gpt-6.1-sol", label: "GPT-6.1 Sol (ভারসাম্যপূর্ণ ও শক্তিশালী)" },
  { id: "gpt-6-luna", label: "GPT-6 Luna (দ্রুত ও সাশ্রয়ী)" },
  { id: "gpt-4o", label: "GPT-4o (পূর্ববর্তী OpenAI মডেল)" },
  { id: "o3-mini", label: "o3-mini (উন্নত যুক্তি ও কোডিং)" },
];

export const DEEPSEEK_MODELS = [
  { id: "deepseek-flash", label: "DeepSeek Flash (অফিশিয়াল API, দ্রুত)" },
  { id: "deepseek-reasoner", label: "DeepSeek-R1 / Reasoner (গভীর যুক্তি ও চিন্তাশীল)" },
  { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
];

export const GROQ_MODELS = [
  { id: "openai/gpt-oss-120b", label: "GPT OSS 120B (Groq, reasoning ও tools)" },
  { id: "openai/gpt-oss-20b", label: "GPT OSS 20B (Groq, দ্রুত)" },
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile" },
  { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant (দ্রুত)" },
];

export const OPENROUTER_MODELS = [
  { id: "openrouter/free", label: "OpenRouter Free Router (স্বয়ংক্রিয় ফ্রি মডেল)" },
  { id: "google/gemma-4-31b-it:free", label: "Google Gemma 4 31B (ফ্রি)" },
  { id: "cohere/north-mini-code:free", label: "Cohere North Mini Code (ফ্রি)" },
  { id: "recursive/flint-v1.0:free", label: "Recursive Flint (ফ্রি; কোডিং)" },
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
  openai: "gpt-6-astra",
  deepseek: "deepseek-flash",
  groq: "llama-3.3-70b-versatile",
  openrouter: "openrouter/free",
  ollama: "deepseek-r1:latest",
};
