export const LIVE_VOICES = [
  { id: "meridian", label: "পুরুষ কণ্ঠ" },
] as const;
export type LiveVoice = (typeof LIVE_VOICES)[number]["id"];
export function resolveLiveVoice(value: unknown): LiveVoice {
  void value;
  return "meridian";
}