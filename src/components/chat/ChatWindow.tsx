import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { ArrowUp, Square, Copy, Volume2, Mic, MicOff, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CodePreviewDialog } from "@/components/chat/CodePreviewDialog";
import logo from "@/assets/logo.png";

const SUGGESTIONS = [
      "নিউটনের গতির তিনটি সূত্র সহজভাবে বুঝিয়ে দাও",
        "2x + 5 = 17 সমীকরণটি ধাপে ধাপে সমাধান করো",
          "একটি আধুনিক ক্যালকুলেটর ওয়েবসাইট বানিয়ে দাও",
            "Python-এ একটি ফাইবোনাচি ফাংশন লিখে দাও",
];

export function ChatWindow({
      threadId,
        initialMessages,
          onFinished,
}: {
      threadId: string;
        initialMessages: UIMessage[];
          onFinished: () => void;
}) {
      const [input, setInput] = useState("");
        const [isListening, setIsListening] = useState(false);
          const [previewHtml, setPreviewHtml] = useState<string | null>(null);
            const inputRef = useRef<HTMLTextAreaElement>(null);
              const bottomRef = useRef<HTMLDivElement>(null);

                const { messages, sendMessage, status, stop, error } = useChat({
                        id: threadId,
                            messages: initialMessages,
                                transport: new DefaultChatTransport({
                                          api: "/api/chat",
                                                body: { threadId },
                                                      headers: async () => {
                                                                  const { data } = await supabase.auth.getSession();
                                                                          return { Authorization: `Bearer ${data.session?.access_token ?? ""}` };
                                                      },
                                }),
                                    onError: (e) => toast.error(readError(e)),
                                        onFinish: () => {
                                                  onFinished();
                                                        inputRef.current?.focus();
                                        },
                });

                  const busy = status === "submitted" || status === "streaming";

                    useEffect(() => {
                            inputRef.current?.focus();
                    }, []);

                      useEffect(() => {
                              bottomRef.current?.scrollIntoView({ block: "end" });
                      }, [messages, status]);

                        // ভয়েস ইনপুট হ্যান্ডলার (Web Speech API)
                          const toggleSpeechRecognition = () => {
                                  const SpeechRecognition =
                                        (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition ||
                                              (window
                                              )
                          }
                      })
                    })
                                        }
                                                      }
                                })
                })
}
}
})
]