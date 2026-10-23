import { describe, expect, it } from "vitest";
import { prepareSpeechChunks } from "@/hooks/use-gemini-tts";

describe("prepareSpeechChunks", () => {
  it("returns an empty array when given an empty or whitespace string", () => {
    expect(prepareSpeechChunks("")).toEqual([]);
    expect(prepareSpeechChunks("   \n  ")).toEqual([]);
  });

  it("keeps short sentences together in a single chunk", () => {
    const text = "আসসালামু আলাইকুম। আপনি কেমন আছেন?";
    const chunks = prepareSpeechChunks(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe("আসসালামু আলাইকুম। আপনি কেমন আছেন?");
  });

  it("splits long paragraphs into sensible chunks and strips markdown formatting", () => {
    const raw = "### শিরোনাম\n**প্রথম বাক্যটি** এখানে দেওয়া হলো। দ্বিতীয় বাক্যটিও এখানে রয়েছে এবং এটি বেশ বিস্তারিত। " +
      "তৃতীয় বাক্যটিতে আরো কিছু বিবরণ যুক্ত করা হলো। ".repeat(10);
    const chunks = prepareSpeechChunks(raw);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.length).toBeLessThanOrEqual(4);
    expect(chunks[0]).not.toContain("###");
    expect(chunks[0]).not.toContain("**");
  });
});
