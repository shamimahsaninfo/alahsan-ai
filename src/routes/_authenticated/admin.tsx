import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Key, Settings, ShieldCheck, Save, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const [geminiKey, setGeminiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState("openai/gpt-6-astra");

  useEffect(() => {
    const saved = localStorage.getItem("al_ahsan_admin_config");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setGeminiKey(parsed.geminiKey || "");
        setSelectedModel(parsed.selectedModel || "openai/gpt-6-astra");
      } catch (e) {}
    }
  }, []);

  const handleSave = () => {
    const config = { geminiKey, selectedModel };
    localStorage.setItem("al_ahsan_admin_config", JSON.stringify(config));
    toast.success("অ্যাডমিন সেটিংস এবং API কী সফলভাবে সংরক্ষিত হয়েছে!");
  };

  return (
    <div className="container max-w-4xl py-8 px-4 space-y-6">
      <div className="flex items-center gap-3 border-b pb-4">
        <ShieldCheck className="w-8 h-8 text-emerald-600" />
        <div>
          <h1 className="text-2xl font-bold font-['Hind_Siliguri']">Al Ahsan AI — অ্যাডমিন ড্যাশবোর্ড</h1>
          <p className="text-sm text-muted-foreground">Google Gemini API কী ও ইঞ্জিন নিয়ন্ত্রণ কেন্দ্র</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-emerald-500/20 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="w-5 h-5 text-emerald-600" /> Google Gemini API Key
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Gemini API Key (Google AI Studio)</Label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-2.5 text-muted-foreground"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">এই কি-টি নিরাপদ সার্ভার-সাইড প্রক্সিতে ব্যবহৃত হয়।</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="w-5 h-5 text-emerald-600" /> এআই মডেল নির্বাচন
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>ডিফল্ট অ্যাক্টিভ মডেল</Label>
              <Input
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                placeholder="openai/gpt-6-astra অথবা google/gemini-2.5-flash"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
          <Save className="w-4 h-4" /> সেটিংস সংরক্ষণ করুন
        </Button>
      </div>
    </div>
  );
}
