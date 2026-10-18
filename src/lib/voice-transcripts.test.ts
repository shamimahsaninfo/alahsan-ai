import { describe, expect, it } from "vitest";
import { groupVoiceTranscripts } from "./voice-transcripts";

describe("voice context preservation", () => {
  it("keeps every word and correction when consolidating adjacent fragments", () => {
    expect(groupVoiceTranscripts([
      { role: "user", text: "বর্গমূল " }, { role: "user", text: "দুই নয়, " }, { role: "user", text: "তিনের প্রমাণ দিন।" },
      { role: "assistant", text: "ঠিক " }, { role: "assistant", text: "আছে।" }, { role: "user", text: "সম্পূর্ণ প্রমাণ।" },
    ])).toEqual([
      { role: "user", content: "বর্গমূল দুই নয়, তিনের প্রমাণ দিন।" },
      { role: "assistant", content: "ঠিক আছে।" }, { role: "user", content: "সম্পূর্ণ প্রমাণ।" },
    ]);
  });
  it("does not merge speech across different speakers", () => {
    expect(groupVoiceTranscripts([{ role: "user", text: "প্রথম" }, { role: "assistant", text: "উত্তর" }, { role: "user", text: "সংশোধন" }])).toHaveLength(3);
    expect(groupVoiceTranscripts([])).toEqual([]);
  });
});