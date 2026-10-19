import { expect, it } from "vitest";
import { recentVoiceContext } from "./voice-context";

it("keeps the eight latest nonempty chat turns in their original roles", () => {
  const messages = Array.from({ length: 10 }, (_, i) => ({ role: "user" as const, content: String(i) }));
  const context = recentVoiceContext([...messages, { role: "assistant", content: "" }]);
  expect(context).toHaveLength(8);
  expect(context[0]).toEqual({ role: "user", content: "2" });
  expect(context.at(-1)?.content).toBe("9");
});