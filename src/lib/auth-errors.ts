export function authError(error: unknown): string {
  const message = error instanceof Error ? error.message : String((error as { message?: string } | null)?.message ?? "");
  if (/rate|too many|429/i.test(message)) return "অল্প সময়ে বেশি ইমেইল চাওয়া হয়েছে। কিছুক্ষণ অপেক্ষা করে আবার চেষ্টা করুন।";
  if (/expired|invalid.*(token|link)|otp/i.test(message)) return "লিংকটি মেয়াদোত্তীর্ণ বা ব্যবহার হয়ে গেছে। নতুন লিংক চেয়ে নিন।";
  if (/confirm/i.test(message)) return "ইমেইল আগে নিশ্চিত করুন। নিশ্চিতকরণ লিংক আবার চাইতে পারেন।";
  if (/password|credentials/i.test(message)) return "ইমেইল বা পাসওয়ার্ড যাচাই করুন; নতুন পাসওয়ার্ড আগেরটি থেকে আলাদা রাখুন।";
  return "কাজটি সম্পন্ন হয়নি। ইন্টারনেট যাচাই করে আবার চেষ্টা করুন।";
}