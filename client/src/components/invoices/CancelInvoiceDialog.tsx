/**
 * Cancel Invoice confirmation modal — Send Invoice MVP1.
 * Shown only for eligible invoices (Sent / Overdue, no accepted payment).
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  cancelInvoiceRequest,
  InvoiceActionError,
  type InvoiceListItem,
} from "@/lib/invoices";

interface CancelInvoiceDialogProps {
  invoice: InvoiceListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CancelInvoiceDialog({ invoice, open, onOpenChange }: CancelInvoiceDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  if (!invoice) return null;

  const reasonValid = reason.trim().length > 0 && reason.trim().length <= 500;

  const handleCancel = async () => {
    if (!reasonValid || isCancelling) return;
    setIsCancelling(true);
    setError("");
    try {
      const updated = await cancelInvoiceRequest(invoice.id, reason.trim());
      toast({
        title: "Invoice cancelled",
        description: `Invoice ${updated.invoiceNumber} was cancelled. Your client has been notified.`,
      });
      setReason("");
      onOpenChange(false);
      // Invoice list and any detail views must reflect the new status.
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${invoice.id}`] });
    } catch (err) {
      if (err instanceof InvoiceActionError && err.status === 404) {
        // The invoice no longer exists for this session (e.g. the prototype
        // server restarted or the account changed) — drop the stale row.
        toast({
          title: "Invoice no longer available",
          description: "This invoice could not be found. Your invoice list has been refreshed.",
        });
        setReason("");
        onOpenChange(false);
        queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
        return;
      }
      setError(err instanceof Error ? err.message : "The invoice could not be cancelled.");
      // Refresh anyway so the row reflects any status change from the server.
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!isCancelling) onOpenChange(next); }}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-cancel-invoice">
        <DialogHeader>
          <DialogTitle>Cancel Invoice</DialogTitle>
          <DialogDescription>
            This action is permanent. The invoice payment link will stop working immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-border divide-y divide-border text-sm" data-testid="cancel-summary">
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-muted-foreground">Invoice Number</span>
              <span className="font-medium">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-muted-foreground">Client</span>
              <span className="font-medium">{invoice.clientName}</span>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">
                {invoice.currency} {invoice.fees.invoiceAmount.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cancellationReason">
              Cancellation Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="cancellationReason"
              placeholder="Tell your client why this invoice is being cancelled"
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(""); }}
              rows={3}
              data-testid="input-cancel-reason"
            />
            <p className="text-xs text-muted-foreground">This reason will be shared with the client.</p>
            {reason.trim().length > 500 && (
              <p className="text-xs text-destructive">The cancellation reason must be 500 characters or fewer.</p>
            )}
            {error && <p className="text-xs text-destructive" data-testid="error-cancel">{error}</p>}
          </div>

          <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl">
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-xs text-red-900 leading-relaxed" data-testid="cancel-warning">
              Cancelling this invoice is permanent. Your client will no longer be able to pay using this link. To
              correct or replace the invoice, you must create a new invoice.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCancelling}
            data-testid="button-keep-invoice"
          >
            Keep Invoice
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={!reasonValid || isCancelling}
            data-testid="button-confirm-cancel"
          >
            {isCancelling ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Cancelling…
              </>
            ) : (
              "Cancel Invoice"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
