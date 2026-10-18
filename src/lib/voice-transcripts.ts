/** Preserve every transcript fragment while avoiding one model message per fragment. */
export function groupVoiceTranscripts(fragments: ReadonlyArray<{ role: "user" | "assistant"; text: string }>) {
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const fragment of fragments) {
    const previous = messages.at(-1);
    if (previous?.role === fragment.role) previous.content += fragment.text;
    else messages.push({ role: fragment.role, content: fragment.text });
  }
  return messages;
}