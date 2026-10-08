/**
 * Receipt for a paid Send Money transfer: amount, fee, promo and bonus lines, total paid and what the
 * recipient gets. Opened from the Receipt button on a paid row in Transactions.
 */
import { Gift, Tag } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { receiptLines } from "@/lib/sendMoney";
import { SUPPORT_LINK_ENABLED, supportHref } from "@/lib/support";
import type { SendMoneyTransactionView } from "@shared/sendMoney";

interface SendMoneyReceiptDialogProps {
  transaction: SendMoneyTransactionView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const METHOD_LABELS: Record<string, string> = { card: "Card", manual_transfer: "Manual bank transfer" };

export function SendMoneyReceiptDialog({ transaction, open, onOpenChange }: SendMoneyReceiptDialogProps) {
  if (!transaction) return null;
  const lines = receiptLines(transaction);
  const paidOn = transaction.paidAt ? new Date(transaction.paidAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—";
  const method = transaction.paymentMethod ? (METHOD_LABELS[transaction.paymentMethod] ?? transaction.paymentMethod.replace(/_/g, " ")) : "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl" data-testid="send-money-receipt">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Receipt</DialogTitle>
          <DialogDescription>
            <span className="font-mono text-blue-600 font-semibold">{transaction.reference}</span> · to {transaction.recipientName}
          </DialogDescription>
        </DialogHeader>

        <div className="divide-y divide-slate-100 text-sm" data-testid="receipt-lines">
          {lines.map((l) => (
            <div
              key={l.key}
              data-testid={`receipt-line-${l.key}`}
              className={cn("flex items-center justify-between gap-4 py-2.5", l.tone === "total" && "font-bold text-slate-900 text-base")}
            >
              <span className={cn("flex items-center gap-1.5", l.tone === "discount" ? "text-teal-700" : "text-muted-foreground", l.tone === "total" && "text-slate-900")}>
                {l.key === "promo" && <Tag className="h-3.5 w-3.5" aria-hidden />}
                {(l.key === "bonus_pay_less" || l.key === "bonus_send_more") && <Gift className="h-3.5 w-3.5" aria-hidden />}
                {l.label}
              </span>
              <span className={cn("text-right font-medium tabular-nums", l.tone === "discount" ? "text-teal-700" : "text-slate-800", l.tone === "total" && "font-bold text-slate-900")}>{l.value}</span>
            </div>
          ))}
        </div>

        <div className="space-y-1 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          <div className="flex justify-between"><span>Paid with</span><span className="font-medium text-slate-800">{method}</span></div>
          <div className="flex justify-between"><span>Paid on</span><span className="font-medium text-slate-800">{paidOn}</span></div>
          <div className="flex justify-between"><span>Exchange rate</span><span className="font-medium text-slate-800">1 {transaction.sendCurrency} = {Number(transaction.exchangeRate).toLocaleString("en-GB")} {transaction.receiveCurrency}</span></div>
        </div>

        <p className="text-xs text-slate-500">
          Something look wrong?{" "}
          {SUPPORT_LINK_ENABLED ? (
            <a href={supportHref(`Receipt ${transaction.reference}`)} data-testid="receipt-contact-support" className="font-semibold text-blue-600 hover:underline">
              Contact support
            </a>
          ) : (
            <span aria-disabled="true" title="Coming soon" data-testid="receipt-contact-support" className="font-semibold text-slate-400 cursor-not-allowed">
              Contact support
            </span>
          )}
        </p>
      </DialogContent>
    </Dialog>
  );
}
