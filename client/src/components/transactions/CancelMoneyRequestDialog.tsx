/**
 * Cancel Money Request confirmation dialog.
 * Ported from the removed /payment-requests page — same copy, layout and
 * test ids — now opened from the Dashboard transactions table.
 */

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CURRENCY_SYMBOLS } from "@shared/currencies";
import type { MoneyRequestView } from "@/lib/requests";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CancelMoneyRequestDialogProps {
  request: MoneyRequestView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (request: MoneyRequestView) => void | Promise<void>;
}

export function CancelMoneyRequestDialog({ request, open, onOpenChange, onConfirm }: CancelMoneyRequestDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-cancel-request">
        <DialogHeader>
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-2">
            <AlertCircle className="w-6 h-6" />
          </div>
          <DialogTitle className="font-display text-lg">Cancel Money Request?</DialogTitle>
          <DialogDescription>
            Are you sure you want to cancel this money request? The sender will no longer be able to make a payment using this request link.
          </DialogDescription>
        </DialogHeader>

        {request && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Request Number:</span>
              <span className="font-mono text-xs font-semibold text-slate-800">{request.requestNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sender:</span>
              <span className="font-medium text-slate-800">{request.senderName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount:</span>
              <span className="font-semibold text-slate-900">
                {CURRENCY_SYMBOLS[request.payInCurrency] || ""}{request.payInAmount} {request.payInCurrency}
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-dialog-keep-request"
          >
            Keep Request
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => request && void onConfirm(request)}
            data-testid="button-dialog-confirm-cancel"
          >
            Yes, Cancel Request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
