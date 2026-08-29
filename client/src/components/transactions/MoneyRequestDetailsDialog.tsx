/**
 * Money Request details dialog — opened from the Dashboard transactions
 * table's View button. Carries every column of the removed /payment-requests
 * page (sender pays, you receive, payout account, created, expires, status)
 * plus its per-status actions (resend email, copy payment link, cancel).
 */

import { Copy, Mail, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CURRENCY_SYMBOLS } from "@shared/currencies";
import { formatShortDate } from "@shared/invoice-logic";
import type { MoneyRequestView } from "@/lib/requests";
import { cn } from "@/lib/utils";
import { moneyRequestAwaiting, moneyRequestLinkShareable, moneyRequestStatusInfo } from "@/lib/unifiedTransactions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MoneyRequestDetailsDialogProps {
  request: MoneyRequestView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResendEmail: (request: MoneyRequestView) => void;
  onCopyPaymentLink: (request: MoneyRequestView) => void;
  /** Hands the request to the cancel confirmation dialog. */
  onCancelRequest: (request: MoneyRequestView) => void;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium text-slate-800">{children}</span>
    </div>
  );
}

export function MoneyRequestDetailsDialog({
  request,
  open,
  onOpenChange,
  onResendEmail,
  onCopyPaymentLink,
  onCancelRequest,
}: MoneyRequestDetailsDialogProps) {
  if (!request) return null;

  const awaiting = moneyRequestAwaiting(request.status);
  const linkShareable = moneyRequestLinkShareable(request.status);
  const status = moneyRequestStatusInfo(request.status);
  const paySymbol = CURRENCY_SYMBOLS[request.payInCurrency] ?? "";
  const payoutSymbol = CURRENCY_SYMBOLS[request.payoutCurrency] ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-request-details">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Money Request Details</DialogTitle>
          <DialogDescription>
            Track this request across its lifecycle — link, email and QR all share one secure URL
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span
              className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", status.pill)}
              data-testid={`request-status-${request.status}`}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full", status.dot)} />
              {status.label}
            </span>
            <span className="font-mono text-xs font-semibold text-slate-800">{request.requestNumber}</span>
          </div>
          {request.failureReason && (
            <p className="text-xs text-red-600" data-testid="request-failure-reason">{request.failureReason}</p>
          )}

          <div className="rounded-xl border border-border divide-y divide-border text-sm">
            <DetailRow label="Sender">
              <span>
                {request.senderName}
                <span className="block text-xs font-normal text-muted-foreground">{request.senderEmail}</span>
              </span>
            </DetailRow>
            <DetailRow label="Sender Pays">
              {paySymbol}{request.senderPaysAmount} {request.payInCurrency}
            </DetailRow>
            <DetailRow label="You Receive">
              <span className="text-primary">
                {payoutSymbol}{request.payoutAmount ?? request.payInAmount} {request.payoutCurrency}
              </span>
              <span className="block text-xs font-normal text-muted-foreground">
                {request.absorbFee ? `after ${request.feeAmount} fee` : `${request.feeAmount} fee charged to sender`}
              </span>
            </DetailRow>
            <DetailRow label="Settlement Bank Account">
              <span>
                {request.payoutAccount.bankName}
                <span className="block text-xs font-normal text-muted-foreground">{request.payoutAccount.maskedNumber}</span>
              </span>
            </DetailRow>
            <DetailRow label="Created">
              {request.createdAt ? formatShortDate(request.createdAt.slice(0, 10)) : "—"}
            </DetailRow>
            <DetailRow label="Expires">
              {formatShortDate(request.expiresAt.slice(0, 10))}
            </DetailRow>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          {awaiting && (
            <Button variant="outline" size="sm" onClick={() => onResendEmail(request)} data-testid="button-details-resend-email">
              <Mail className="w-4 h-4 mr-1.5" />
              Resend Email
            </Button>
          )}
          {linkShareable && (
            <Button variant="outline" size="sm" onClick={() => onCopyPaymentLink(request)} data-testid="button-details-copy-link">
              <Copy className="w-4 h-4 mr-1.5" />
              Copy Payment Link
            </Button>
          )}
          {awaiting && (
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              onClick={() => onCancelRequest(request)}
              data-testid="button-details-cancel-request"
            >
              <XCircle className="w-4 h-4 mr-1.5" />
              Cancel Request
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
