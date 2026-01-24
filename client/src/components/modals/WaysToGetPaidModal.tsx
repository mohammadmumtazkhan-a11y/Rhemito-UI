import { motion, AnimatePresence } from "framer-motion";
import { X, Link2, FileText, QrCode, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface WaysToGetPaidModalProps {
  isOpen: boolean;
  onClose: () => void;
  senderEmail?: string;
}

export function WaysToGetPaidModal({ isOpen, onClose, senderEmail }: WaysToGetPaidModalProps) {
  const [, setLocation] = useLocation();

  const handleOptionClick = (path: string) => {
    const url = senderEmail ? `${path}?sender=${encodeURIComponent(senderEmail)}` : path;
    setLocation(url);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
          >
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h2 className="text-xl font-semibold font-display">Ways to get paid</h2>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                  data-testid="button-close-modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-3">
                <button
                  onClick={() => handleOptionClick("/request-payment")}
                  className="w-full p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all flex items-center gap-4 text-left group"
                  data-testid="option-request-payment"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Link2 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Request payment link</p>
                    <p className="text-sm text-muted-foreground">Generate a shareable payment link</p>
                  </div>
                </button>

                <button
                  onClick={() => handleOptionClick("/send-invoice")}
                  className="w-full p-4 rounded-xl border border-border hover:border-teal hover:bg-teal/5 transition-all flex items-center gap-4 text-left group"
                  data-testid="option-send-invoice"
                >
                  <div className="w-12 h-12 rounded-xl bg-teal/10 flex items-center justify-center group-hover:bg-teal/20 transition-colors">
                    <FileText className="w-6 h-6 text-teal" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Send invoice</p>
                    <p className="text-sm text-muted-foreground">Create and send a professional invoice</p>
                  </div>
                </button>

                <button
                  onClick={() => handleOptionClick("/show-qr-code")}
                  className="w-full p-4 rounded-xl border border-border hover:border-purple hover:bg-purple/5 transition-all flex items-center gap-4 text-left group"
                  data-testid="option-show-qr-code"
                >
                  <div className="w-12 h-12 rounded-xl bg-purple/10 flex items-center justify-center group-hover:bg-purple/20 transition-colors">
                    <QrCode className="w-6 h-6 text-purple" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Show QR code</p>
                    <p className="text-sm text-muted-foreground">Display a scannable QR code for payment</p>
                  </div>
                </button>

                <button
                  onClick={() => handleOptionClick("/group-pay/create")}
                  className="w-full p-4 rounded-xl border border-border hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center gap-4 text-left group"
                  data-testid="option-group-campaign"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Start funding campaign</p>
                    <p className="text-sm text-muted-foreground">Collect funds from multiple contributors</p>
                  </div>
                </button>
              </div>

              <div className="p-6 bg-muted/30 border-t border-border">
                <Button variant="outline" className="w-full" onClick={onClose}>
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
