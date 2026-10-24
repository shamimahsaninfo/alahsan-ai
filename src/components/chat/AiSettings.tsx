import { useState } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_MODEL_VALUE, MODEL_OPTIONS, findModel } from "@/lib/ai/models";
import { KEY_PROVIDERS, maskKey, normalizeKey, type KeyProvider } from "@/lib/ai/keys";
import { saveAiSettings, useAiSettings } from "@/lib/ai/settings-store";

const EMPTY_DRAFTS: Record<KeyProvider, string> = { groq: "", gemini: "" };

/** Sidebar section: model picker plus the API key dialog. */
export function AiSettings() {
  const settings = useAiSettings();
  const option = findModel(settings.model) ?? findModel(DEFAULT_MODEL_VALUE)!;
  const missingKey =
    option.provider !== "lovable" && !settings.keys[option.provider as KeyProvider];

  return (
    <div className="space-y-2 px-3 pb-3">
      <Label className="text-xs text-muted-foreground">AI মডেল</Label>
      <Select
        value={settings.model}
        onValueChange={(model) => saveAiSettings({ ...settings, model })}
      >
        <SelectTrigger aria-label="AI মডেল বাছুন" className="h-8 w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MODEL_OPTIONS.map((m) => (
            <SelectItem key={m.value} value={m.value} className="text-xs">
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {missingKey && <p className="text-xs text-destructive">এই মডেলের জন্য নিচে API কি বসান।</p>}
      <ApiKeyDialog />
    </div>
  );
}

function ApiKeyDialog() {
  const settings = useAiSettings();
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<KeyProvider, string>>(EMPTY_DRAFTS);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setDrafts(EMPTY_DRAFTS);
  }

  function saveKey(provider: KeyProvider, label: string) {
    const key = normalizeKey(drafts[provider]);
    if (!key) {
      toast.error("সঠিক API কি দিন। স্পেস বা লাইন ছাড়া কপি করুন।");
      return;
    }
    saveAiSettings({ ...settings, keys: { ...settings.keys, [provider]: key } });
    setDrafts((d) => ({ ...d, [provider]: "" }));
    toast.success(`${label} কি সংরক্ষিত হয়েছে`);
  }

  function removeKey(provider: KeyProvider) {
    const keys = { ...settings.keys };
    delete keys[provider];
    saveAiSettings({ ...settings, keys });
    toast.success("কি মুছে ফেলা হয়েছে");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start gap-2">
          <KeyRound className="h-4 w-4" /> API কি
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>API কি</DialogTitle>
          <DialogDescription>
            কি শুধু এই ব্রাউজারে সংরক্ষিত থাকে। বার্তা পাঠানোর সময় শুধু নির্বাচিত মডেলের কি
            সার্ভারে যায়, এবং সার্ভার সেটি কোথাও জমা রাখে না। অন্যের কম্পিউটারে এটি ব্যবহার করবেন
            না।
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {KEY_PROVIDERS.map((p) => {
            const saved = settings.keys[p.id];
            return (
              <div key={p.id} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`api-key-${p.id}`}>{p.label}</Label>
                  {saved ? (
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      সংরক্ষিত: {maskKey(saved)}
                      <button
                        type="button"
                        className="underline hover:text-destructive"
                        onClick={() => removeKey(p.id)}
                      >
                        মুছুন
                      </button>
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">সংরক্ষিত নয়</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    id={`api-key-${p.id}`}
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={saved ? "নতুন কি বসাতে এখানে লিখুন" : p.placeholder}
                    value={drafts[p.id]}
                    onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                  />
                  <Button
                    type="button"
                    onClick={() => saveKey(p.id, p.label)}
                    disabled={!drafts[p.id].trim()}
                  >
                    সংরক্ষণ
                  </Button>
                </div>
                <a
                  href={p.keyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary underline"
                >
                  {p.label} থেকে কি নিন
                </a>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
