// Pure helpers shared by the browser and the server. Holds no secrets and imports no server-only code.
import type { ProviderId } from "./models";

export type KeyProvider = Exclude<ProviderId, "lovable">;

export const KEY_PROVIDERS: ReadonlyArray<{
  id: KeyProvider;
  label: string;
  /** Name of the server-side fallback secret, used only when no key is typed in the app. */
  envName: string;
  keyUrl: string;
  placeholder: string;
}> = [
  {
    id: "groq",
    label: "Groq",
    envName: "GROQ_API_KEY",
    keyUrl: "https://console.groq.com/keys",
    placeholder: "gsk_…",
  },
  {
    id: "gemini",
    label: "Gemini",
    envName: "GEMINI_API_KEY",
    keyUrl: "https://aistudio.google.com/app/apikey",
    placeholder: "AIza…",
  },
];

const MIN_KEY_LENGTH = 20;
const MAX_KEY_LENGTH = 200;

/** Returns the trimmed key, or undefined when the value cannot be a real API key. */
export function normalizeKey(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const key = raw.trim();
  if (key.length < MIN_KEY_LENGTH || key.length > MAX_KEY_LENGTH) return undefined;
  if (/\s/.test(key)) return undefined;
  return key;
}

/** Shows only the last four characters so a saved key can be recognised without being revealed. */
export function maskKey(key: string): string {
  return `••••${key.slice(-4)}`;
}

export type StoredSettings = {
  model?: string;
  keys: Partial<Record<KeyProvider, string>>;
};

/** Reads the browser's saved settings defensively: broken or hand-edited data falls back to empty values. */
export function parseStoredSettings(raw: string | null): StoredSettings {
  const empty: StoredSettings = { keys: {} };
  if (!raw) return empty;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return empty;
  }
  if (!data || typeof data !== "object") return empty;
  const { model, keys } = data as { model?: unknown; keys?: unknown };
  const result: StoredSettings = { keys: {} };
  if (typeof model === "string") result.model = model;
  if (keys && typeof keys === "object") {
    for (const provider of KEY_PROVIDERS) {
      const key = normalizeKey((keys as Record<string, unknown>)[provider.id]);
      if (key) result.keys[provider.id] = key;
    }
  }
  return result;
}

/**
 * Picks the key for one request: the key typed in the app wins, then the server secret.
 * Lovable AI never uses these keys.
 */
export function chooseApiKey(
  provider: ProviderId,
  userKey: unknown,
  env: Record<string, string | undefined>,
): string | undefined {
  if (provider === "lovable") return undefined;
  const entry = KEY_PROVIDERS.find((p) => p.id === provider);
  if (!entry) return undefined;
  return normalizeKey(userKey) ?? normalizeKey(env[entry.envName]);
}
