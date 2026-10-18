import { expect, it } from "vitest";
import { serviceError, voiceError } from "./service-errors";
it("classifies exhausted credits without advising an automatic retry", () => {
  expect(serviceError(402)).toContain("ক্রেডিট বা ব্যালান্স শেষ");
});
it("classifies temporary service failure separately", () => {
  expect(serviceError(503)).toContain("স্বয়ংক্রিয়ভাবে নতুন অনুরোধ পাঠানো হয়নি");
});
it("keeps private provider details out of voice errors", () => {
  expect(voiceError({ httpStatus: 402, message: "private-provider-detail" })).not.toContain("private-provider-detail");
});