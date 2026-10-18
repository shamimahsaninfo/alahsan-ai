import { expect, it } from "vitest";
import { geminiLiveConfig } from "./gemini-live-config";
import { encodePcm, decodePcm } from "./pcm-audio";
it("locks Google calls to a masculine voice", () => {
  expect(geminiLiveConfig.speechConfig?.voiceConfig?.prebuiltVoiceConfig?.voiceName).toBe("Fenrir");
});
it("interrupts the current answer when new speech starts", () => {
  expect(geminiLiveConfig.realtimeInputConfig?.activityHandling).toBe("START_OF_ACTIVITY_INTERRUPTS");
});
it("encodes 16kHz signed PCM without losing amplitude or sign", () => {
  const result = decodePcm(encodePcm(new Float32Array([-1, 0, 0.5, 1]), 16000));
  expect(result.length).toBe(4);
  expect(result[0]).toBe(-1);
  expect(result[1]).toBe(0);
  expect(result[2]).toBeCloseTo(0.5, 3);
  expect(result[3]).toBeCloseTo(1, 3);
});