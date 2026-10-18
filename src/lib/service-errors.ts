export function serviceError(status: number, detail = ""): string {
  const text = detail.toLowerCase();
  if (status === 402 || /insufficient.*(credit|balance|fund)|payment.required|out of credits/.test(text))
    return "এআই সেবার ক্রেডিট বা ব্যালান্স শেষ হয়েছে। অ্যাপের মালিককে ক্রেডিট বা বিলিং ঠিক করতে বলুন; আপনার প্রশ্ন সংরক্ষিত আছে।";
  if (status === 429 || /rate.limit|quota|resource_exhausted/.test(text))
    return "এআই সেবার অনুরোধের সীমায় পৌঁছেছে। কিছুক্ষণ অপেক্ষা করে আবার চেষ্টা করুন; আপনার প্রশ্ন হারায়নি।";
  if (status === 503 || status >= 500)
    return "এআই সেবা এখন সাময়িকভাবে সাড়া দিচ্ছে না। কিছুক্ষণ পরে নিজে আবার চেষ্টা করুন; স্বয়ংক্রিয়ভাবে নতুন অনুরোধ পাঠানো হয়নি।";
  if (status === 401 || status === 403) return "অনুমতি বা লগইনের মেয়াদে সমস্যা হয়েছে। আবার লগইন করুন; সমস্যা থাকলে অ্যাপের মালিককে জানান।";
  return "অনুরোধ সম্পন্ন করা যায়নি। সংযোগ যাচাই করে আবার চেষ্টা করুন।";
}
export function voiceError(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const e = error as { httpStatus?: number; code?: string; message?: string };
    if (e.httpStatus || /credit|payment|quota|rate.limit|unavailable/i.test(e.code ?? ""))
      return serviceError(e.httpStatus ?? 503, `${e.code ?? ""} ${e.message ?? ""}`);
    if (e.message && /[\u0980-\u09ff]/.test(e.message)) return e.message;
  }
  return "ভয়েস সংযোগে সমস্যা হয়েছে। ইন্টারনেট ও মাইকের অনুমতি যাচাই করে নতুন কল শুরু করুন।";
}