import { expect, it } from "vitest";
import { resolveLiveVoice } from "./live-voices";
it("uses the supported masculine voice when selected", () => {
  expect(resolveLiveVoice("meridian")).toBe("meridian");
});
it("always uses a masculine voice, including old feminine choices and missing input", () => {
  expect(resolveLiveVoice(undefined)).toBe("meridian");
  expect(resolveLiveVoice("marin")).toBe("meridian");
  expect(resolveLiveVoice("untrusted-voice")).toBe("meridian");
});