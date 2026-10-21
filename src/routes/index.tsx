import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Calculator, Languages, Code2 } from "lucide-react";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Al Ahsan AI — বাংলা ও ইংরেজি AI সহকারী" },
      { name: "description", content: "পড়াশোনা, গণিত, বিজ্ঞান, অনুবাদ, লেখালেখি ও প্রোগ্রামিংয়ে সাহায্যকারী বাংলা AI সহকারী।" },
      { property: "og:title", content: "Al Ahsan AI — বাংলা ও ইংরেজি AI সহকারী" },
      { property: "og:description", content: "পড়াশোনা, গণিত, বিজ্ঞান, অনুবাদ, লেখালেখি ও প্রোগ্রামিংয়ে সাহায্যকারী বাংলা AI সহকারী।" },
    ],
  }),
  component: Index,
});

const FEATURES = [
  { icon: BookOpen, t: "পড়াশোনা ও বিজ্ঞান", d: "যেকোনো বিষয় সহজ ভাষায় বুঝে নিন।" },
  { icon: Calculator, t: "গণিত", d: "ধাপে ধাপে সমাধান।" },
  { icon: Languages, t: "অনুবাদ ও লেখা", d: "বাংলা, ইংরেজি ও আরও ভাষায়।" },
  { icon: Code2, t: "প্রোগ্রামিং", d: "কোড লেখা, ব্যাখ্যা ও ডিবাগিং।" },
];

function Index() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <img src={logo} alt="Al-Ahsan Foundation লোগো" className="mx-auto h-32 w-32 rounded-full shadow-lg" />
        <h1 className="mt-8 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Al Ahsan AI</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          আপনার বিশ্বস্ত বাংলা AI সহকারী — প্রশ্ন করুন, শিখুন, সমাধান খুঁজুন।
        </p>
        <Link
          to="/chat"
          className="mt-8 inline-flex rounded-full bg-primary px-8 py-3 font-semibold text-primary-foreground shadow hover:opacity-90"
        >
          চ্যাট শুরু করুন
        </Link>
        <div className="mt-16 grid gap-4 text-left sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.t} className="rounded-2xl border bg-card p-5">
              <f.icon className="h-6 w-6 text-primary" />
              <h2 className="mt-3 font-semibold">{f.t}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="pb-8 text-center text-sm text-muted-foreground">© Al-Ahsan Foundation, Bangladesh</footer>
    </main>
  );
}
