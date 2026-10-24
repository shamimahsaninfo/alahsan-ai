import { describe, expect, it } from "vitest";
import { chooseApiKey, maskKey, normalizeKey, parseStoredSettings } from "@/lib/ai/keys";

const GROQ_KEY = "gsk_abcdefghijklmnopqrstuvwxyz123456";
const GEMINI_KEY = "AIzaSyAbcdefghijklmnopqrstuvwxyz1234";

describe("normalizeKey", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeKey(`  ${GROQ_KEY}\n`)).toBe(GROQ_KEY);
  });

  it("rejects non-strings, short values, values with spaces and oversized values", () => {
    expect(normalizeKey(undefined)).toBeUndefined();
    expect(normalizeKey(12345)).toBeUndefined();
    expect(normalizeKey("short")).toBeUndefined();
    expect(normalizeKey("gsk_abc def ghijklmnopqrstuvwxyz")).toBeUndefined();
    expect(normalizeKey("a".repeat(201))).toBeUndefined();
  });
});

describe("maskKey", () => {
  it("shows only the last four characters", () => {
    expect(maskKey(GROQ_KEY)).toBe("••••3456");
  });
});

describe("parseStoredSettings", () => {
  it("returns empty settings for missing or broken data", () => {
    expect(parseStoredSettings(null)).toEqual({ keys: {} });
    expect(parseStoredSettings("{not json")).toEqual({ keys: {} });
    expect(parseStoredSettings("42")).toEqual({ keys: {} });
  });

  it("keeps valid keys and drops invalid ones", () => {
    const parsed = parseStoredSettings(
      JSON.stringify({ model: "groq:openai/gpt-oss-20b", keys: { groq: GROQ_KEY, gemini: "bad" } }),
    );
    expect(parsed).toEqual({ model: "groq:openai/gpt-oss-20b", keys: { groq: GROQ_KEY } });
  });
});

describe("chooseApiKey", () => {
  it("never uses a key for the Lovable default", () => {
    expect(chooseApiKey("lovable", GROQ_KEY, { GROQ_API_KEY: GROQ_KEY })).toBeUndefined();
  });

  it("prefers the key typed in the app over the server secret", () => {
    expect(chooseApiKey("groq", GROQ_KEY, { GROQ_API_KEY: "gsk_serversecret_0000000000000" })).toBe(
      GROQ_KEY,
    );
  });

  it("falls back to the server secret when no valid app key is given", () => {
    expect(chooseApiKey("gemini", "bad", { GEMINI_API_KEY: GEMINI_KEY })).toBe(GEMINI_KEY);
  });

  it("returns undefined when neither source has a key", () => {
    expect(chooseApiKey("groq", undefined, {})).toBeUndefined();
  });
});
