// Customer-chosen website addresses ("ইউআরএল দিন"). Each customer picks the whole slug.
export const RESERVED_SLUGS = new Set(["api", "chat", "admin", "salat", "p", "img", "login", "auth", "index", "assets", "favicon.ico", "robots.txt", "manifest.webmanifest"]);

export function normalizeSlug(raw: string): string {
  return raw.trim().toLowerCase().replace(/^https?:\/\/[^/]+\//, "").replace(/^\/+|\/+$/g, "").replace(/\s+/g, "-");
}

export function slugError(slug: string): string | null {
  if (!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug)) return "ইউআরএল ৩–৬০ অক্ষরের হবে; শুধু ইংরেজি ছোট অক্ষর, সংখ্যা ও হাইফেন (-) ব্যবহার করুন।";
  if (RESERVED_SLUGS.has(slug) || /^project\d+$/.test(slug)) return "এই ইউআরএলটি সংরক্ষিত, অন্য একটি দিন।";
  return null;
}
