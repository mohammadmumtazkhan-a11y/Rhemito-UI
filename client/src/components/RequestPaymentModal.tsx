import { motion } from "framer-motion";
import { Receipt, FileText, QrCode } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface RequestPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (option: "request" | "invoice" | "qrcode") => void;
}

const options = [
  {
    id: "request" as const,
    icon: Receipt,
    title: "Request Money",
    description: "Send a payment link to receive funds",
    color: "bg-teal",
  },
  {
    id: "invoice" as const,
    icon: FileText,
    title: "Send Invoice",
    description: "Upload and share an invoice",
    color: "bg-primary",
  },
  {
    id: "qrcode" as const,
    icon: QrCode,
    title: "Show QR Code",
    description: "Let sender scan to pay instantly",
    color: "bg-purple",
  },
];

export function RequestPaymentModal({ open, onOpenChange, onSelect }: RequestPaymentModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center font-display text-xl">Ways to get paid</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-3 gap-4 py-6">
          {options.map((option, index) => (
            <motion.button
              key={option.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelect(option.id)}
              className="flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-muted transition-colors"
              data-testid={`button-${option.id}`}
            >
              <div className={`w-14 h-14 ${option.color} rounded-full flex items-center justify-center`}>
                <option.icon className="w-6 h-6 text-white" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">{option.title}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-tight">{option.description}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
