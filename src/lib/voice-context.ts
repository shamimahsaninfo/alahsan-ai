export type VoiceContextMessage = { role: "user" | "assistant"; content: string };

export function recentVoiceContext(messages: VoiceContextMessage[]): VoiceContextMessage[] {
  return messages.filter(message => message.content.trim()).slice(-8).map(message => ({ role: message.role, content: message.content.slice(0, 2000) }));
}

export function voiceOpening(messages: VoiceContextMessage[]): string {
  return messages.length
    ? "ভয়েস কল শুরু হয়েছে। আগের চ্যাটের প্রসঙ্গ ধরে বাংলায় সংক্ষেপে বলুন: শুনছি, এই বিষয়েই কথা চালিয়ে যেতে পারেন। নতুন করে সালাম বা পরিচয় দেবেন না।"
    : "ভয়েস কল শুরু হয়েছে। বাংলায় সংক্ষেপে বলুন: বলুন, কী নিয়ে কথা বলতে চান? তারপর ব্যবহারকারীর কথা শুনুন।";
}