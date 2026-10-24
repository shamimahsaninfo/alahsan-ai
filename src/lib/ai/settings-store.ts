// Browser-only store for the model choice and the user's own API keys (kept in this browser's localStorage).
import { useSyncExternalStore } from "react";
import { DEFAULT_MODEL_VALUE, findModel } from "./models";
import { parseStoredSettings, type KeyProvider } from "./keys";

export type AiSettings = {
  model: string;
  keys: Partial<Record<KeyProvider, string>>;
};

const STORAGE_KEY = "alahsan-ai-settings";

function readFromStorage(): AiSettings {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    /* storage unavailable: settings last for this page only */
  }
  const parsed = parseStoredSettings(raw);
  return {
    model: findModel(parsed.model) ? parsed.model! : DEFAULT_MODEL_VALUE,
    keys: parsed.keys,
  };
}

let snapshot: AiSettings = readFromStorage();
const listeners = new Set<() => void>();

export function getAiSettings(): AiSettings {
  return snapshot;
}

export function saveAiSettings(next: AiSettings) {
  snapshot = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: keep the settings for this page only */
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAiSettings(): AiSettings {
  return useSyncExternalStore(subscribe, getAiSettings, getAiSettings);
}
