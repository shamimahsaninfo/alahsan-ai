import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Play } from "lucide-react";

export function CodePreviewDialog({
  isOpen,
  onClose,
  htmlCode,
}: {
  isOpen: boolean;
  onClose: () => void;
  htmlCode: string;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-4 bg-background">
        <DialogHeader className="border-b pb-2">
          <DialogTitle className="flex items-center gap-2 text-primary font-display">
            <Play className="w-5 h-5 text-primary" /> লাইভ ওয়েবসাইট প্রিভিউ (স্যান্ডবক্সড)
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 w-full h-full rounded-md border overflow-hidden bg-white mt-2">
          <iframe
            srcDoc={htmlCode}
            title="Live Sandbox Runner"
            sandbox="allow-scripts allow-forms allow-modals allow-popups"
            className="w-full h-full border-0"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
