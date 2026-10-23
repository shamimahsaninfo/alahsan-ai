import { describe, expect, it } from "vitest";
import { pcmToWav } from "./speech-audio";

describe("pcmToWav", () => {
  it("writes a mono 24kHz 16-bit PCM WAV header and samples", () => {
    const buffer = pcmToWav(new Float32Array([-1, 0, 1]));
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe("WAVE");
    expect(view.getUint32(24, true)).toBe(24000);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getInt16(44, true)).toBe(-32768);
    expect(view.getInt16(46, true)).toBe(0);
    expect(view.getInt16(48, true)).toBe(32767);
  });
});
