import { describe, expect, it } from "vitest";
import { clockContext, isClockQuestion, parseNewsRss, requiresLiveSearch } from "./chat-grounding";

describe("live facts", () => {
  it("uses Bangladesh time instead of mixing UTC with local time", () => {
    const context = clockContext(new Date("2026-10-19T00:22:00Z"));
    expect(context).toContain("৬:২২");
    expect(context).toContain("Asia/Dhaka");
  });
  it("answers English clock questions without web search", () => {
    expect(isClockQuestion("What time is it?")).toBe(true);
    expect(requiresLiveSearch("What time is it?")).toBe(false);
  });
  it("searches short Bengali news questions", () => {
    expect(requiresLiveSearch("আজকের খবর")).toBe(true);
    expect(requiresLiveSearch("বর্তমান প্রধানমন্ত্রী কে?")).toBe(true);
    expect(requiresLiveSearch("কেমন আছেন?")).toBe(false);
  });
  it("rejects stale and invalid headline dates", () => {
    const item = (date: string) => `<item><title>News</title><link>https://news.google.com/story</link><pubDate>${date}</pubDate></item>`;
    const now = new Date("2026-10-19T00:22:00Z");
    expect(parseNewsRss(item("2026-10-01"), now)).toBe("");
    expect(parseNewsRss(item("invalid"), now)).toBe("");
    expect(parseNewsRss(item("2026-10-18T23:00:00Z"), now, true)).toContain("News");
    expect(parseNewsRss(item("2026-10-18T01:00:00Z"), now, true)).toBe("");
  });
});