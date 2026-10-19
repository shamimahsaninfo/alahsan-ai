export function isClockQuestion(text: string): boolean {
  if (/খবর|সংবাদ|news|আবহাওয়া|weather|স্কোর|score|দাম|price/i.test(text)) return false;
  return /কয়টা বাজে|কয়টা বাজে|কতটা বাজে|সময় কত|সময় কত|কত তারিখ|আজ.*(?:তারিখ|বার)|কি বার|কী বার|what time is it|current time|today.?s date|what day is it/i.test(text);
}

export function directSessionFact(text: string, model: string, now = new Date()): string | null {
  if (/^(?:এখন\s*)?(?:বাংলাদেশে?\s*)?(?:কয়টা বাজে|কয়টা বাজে|কতটা বাজে|সময় কত|সময় কত)\s*[?।]*$/i.test(text.trim()) || /^(?:what time is it|current time)\s*[?!.]*$/i.test(text.trim())) {
    return clockContext(now).split("।")[0] + "।";
  }
  if (/^(?:তোমার|আপনার|তুমি|আপনি).{0,30}(?:AI\s*)?মডেল.{0,25}(?:কোন|কি|কী)|^what (?:AI )?model (?:are you|do you use)/i.test(text.trim())) {
    return `আমি আল আহসান এআই। এই অনুরোধের জন্য নির্বাচিত মডেল: ${model}।`;
  }
  return null;
}

export function requiresLiveSearch(text: string): boolean {
  if (/https?:\/\/|=== সংযুক্ত ফাইল:/.test(text) || isClockQuestion(text)) return false;
  if (/কোন জায়গায়|কোথায় আছি|আমার অবস্থান|where am i/i.test(text)) return false;
  // শুধু আজকের তাজা খবর, লাইভ স্কোর বা বাজার দরের জন্য সার্চ হবে; সাধারণ ইতিহাস বা তথ্যের জন্য নয়
  return /আজকের খবর|তাজা খবর|সর্বশেষ খবর|আজকের সংবাদ|আজকের রেট|লাইভ স্কোর|আজকের বাজার দর|আজকের স্বর্ণের দাম|আজকের ডলার রেট|latest news|today's news|live score/i.test(text);
}

export function clockContext(now = new Date()): string {
  const dhaka = new Intl.DateTimeFormat("bn-BD", { timeZone: "Asia/Dhaka", weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(now);
  return `বাংলাদেশ সময় (Asia/Dhaka, UTC+06:00): ${dhaka}। এটি অনুরোধের সময়ের সার্ভার ঘড়ি; ব্যবহারকারীর অবস্থান নয়। অন্য দেশের সময় চাইলে সেই দেশের সময় অঞ্চল অনুযায়ী রূপান্তর করবে; অবস্থান অনুমান করবে না।`;
}

export function evidencePolicy(model: string): string {
  return `এই অনুরোধের প্রকৃত AI মডেল: ${model}। পরিচয় জানতে চাইলে আল আহসান এআই নাম এবং এই মডেলটিই বলবে; অন্য মডেল বা সংস্করণ অনুমান করবে না।
সর্বশেষ ব্যবহারকারীর বার্তায় সম্ভাষণ থাকলেই তার স্বাভাবিক জবাব দেবে; প্রশ্নে নিজে থেকে সালাম বা বারবার সম্ভাষণ নয়।
অনলাইন ফলাফল সহায়ক তথ্য হিসেবে ব্যবহার করবে। ফল না থাকলেও নিজস্ব নির্ভুল জ্ঞানভাণ্ডার থেকে ব্যবহারকারীর যেকোনো প্রশ্নের পূর্ণ ও বিস্তারিত উত্তর দেবে।`;
}

export function parseNewsRss(xml: string, now = new Date(), todayOnly = false): string {
  const decode = (text: string) => text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(x[\da-f]+|\d+);/gi, (_, n: string) => { const code = n.startsWith("x") ? parseInt(n.slice(1), 16) : Number(n); return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ""; }).replace(/<[^>]*>/g, " ").trim();
  const day = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  const items = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g)].flatMap((match) => {
    const field = (name: string) => decode(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`).exec(match[1] ?? "")?.[1] ?? "");
    const published = new Date(field("pubDate"));
    const age = now.getTime() - published.getTime();
    const title = field("title"), link = field("link");
    if (!title || !/^https:\/\//.test(link) || !Number.isFinite(age) || age < 0 || age > 48 * 3600_000 || (todayOnly && day(published) !== day(now))) return [];
    return [`- ${title}\n  প্রকাশ: ${published.toISOString()}\n  ${link}`];
  }).slice(0, 8);
  return items.length ? `=== সংবাদ শিরোনাম (Google News) ===\n${items.join("\n")}` : "";
}
