/**
 * Payment Requests dashboard — Request Money.
 * Server-backed statuses across the full lifecycle; requester actions
 * (cancel, rotate link, resend email) honour server-side state rules.
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Inbox, ArrowLeftRight, RefreshCw, Mail, XCircle, AlertCircle } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { cancelRequest, getRequests, resendEmail, rotateToken, type MoneyRequestView } from "@/lib/requests";
import { formatShortDate } from "@shared/invoice-logic";
import { CURRENCY_SYMBOLS } from "@shared/currencies";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-blue-50 text-blue-700 border-blue-200",
  viewed: "bg-indigo-50 text-indigo-700 border-indigo-200",
  payment_pending: "bg-purple-50 text-purple-700 border-purple-200",
  funded: "bg-teal-50 text-teal-700 border-teal-200",
  payout_pending: "bg-teal-50 text-teal-700 border-teal-200",
  paid_out: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  expired: "bg-slate-100 text-slate-600 border-slate-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Sent",
  viewed: "Viewed",
  payment_pending: "Payment Pending",
  funded: "Funded",
  payout_pending: "Paying Out",
  paid_out: "Paid Out",
  failed: "Failed",
  expired: "Expired",
  cancelled: "Cancelled",
};

export default function PaymentRequests() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [requestToCancel, setRequestToCancel] = useState<MoneyRequestView | null>(null);

  const { data, isLoading } = useQuery<MoneyRequestView[]>({
    queryKey: ["/api/request-money/requests"],
    queryFn: getRequests,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: (query) =>
      (query.state.data ?? []).some((r) => ["payment_pending", "funded", "payout_pending"].includes(r.status))
        ? 3000
        : false,
  });

  const requests = data ?? [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/request-money/requests"] });

  const run = async (action: string, fn: () => Promise<unknown>, successMessage: string) => {
    try {
      await fn();
      toast({ title: successMessage });
      refresh();
    } catch (err) {
      toast({
        title: `${action} failed`,
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display">Payment Requests</h1>
            <p className="text-muted-foreground mt-1">Track every request across its lifecycle — link, email and QR all share one secure URL</p>
          </div>
          <Button onClick={() => setLocation("/request-payment")} data-testid="button-new-request-header">
            <ArrowLeftRight className="w-4 h-4 mr-2" />
            New Request
          </Button>
        </motion.div>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="py-16 text-center text-muted-foreground text-sm">Loading payment requests…</div>
            ) : requests.length === 0 ? (
              <div className="py-16 flex flex-col items-center text-center gap-3" data-testid="empty-requests">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Inbox className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <p className="font-medium">No payment requests yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Requests appear here once you create one.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setLocation("/request-payment")} data-testid="button-create-first-request">
                  Create your first request
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border" data-testid="payment-requests-table">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3 font-semibold">Request</th>
                      <th className="px-4 py-3 font-semibold">Sender</th>
                      <th className="px-4 py-3 font-semibold">Sender Pays</th>
                      <th className="px-4 py-3 font-semibold">You Receive</th>
                      <th className="px-4 py-3 font-semibold">Payout Account</th>
                      <th className="px-4 py-3 font-semibold">Created</th>
                      <th className="px-4 py-3 font-semibold">Expires</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {requests.map((req) => {
                      const paySymbol = CURRENCY_SYMBOLS[req.payInCurrency] ?? "";
                      const payoutSymbol = CURRENCY_SYMBOLS[req.payoutCurrency] ?? "";
                      const awaiting = req.status === "active" || req.status === "viewed";
                      return (
                        <tr key={req.id} className="hover:bg-muted/30" data-testid={`request-row-${req.requestNumber}`}>
                          <td className="px-4 py-3 font-medium">{req.requestNumber}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{req.senderName}</div>
                            <div className="text-xs text-muted-foreground">{req.senderEmail}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-medium">
                            {paySymbol}{req.senderPaysAmount} {req.payInCurrency}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-medium text-primary">
                              {payoutSymbol}{req.payoutAmount ?? req.payInAmount} {req.payoutCurrency}
                            </span>
                            <div className="text-xs text-muted-foreground">
                              {req.absorbFee ? `after ${req.feeAmount} fee` : `${req.feeAmount} fee charged to sender`}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs">
                            {req.payoutAccount.bankName}
                            <div className="text-muted-foreground">{req.payoutAccount.maskedNumber}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">{req.createdAt ? formatShortDate(req.createdAt.slice(0, 10)) : "—"}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{formatShortDate(req.expiresAt.slice(0, 10))}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={cn(STATUS_STYLES[req.status] ?? STATUS_STYLES.active)} data-testid={`request-status-${req.status}`}>
                              {STATUS_LABELS[req.status] ?? req.status}
                            </Badge>
                            {req.failureReason && <div className="text-[10px] text-red-600 mt-1">{req.failureReason}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {awaiting && (
                                <>
                                  <Button variant="ghost" size="sm" title="Resend email" onClick={() => run("Resend", () => resendEmail(req.id), "Email resent.")} data-testid={`button-resend-${req.requestNumber}`}>
                                    <Mail className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" title="Rotate link (old link stops working)" onClick={() => run("Rotate", () => rotateToken(req.id), "New link generated — the old link no longer works.")} data-testid={`button-rotate-${req.requestNumber}`}>
                                    <RefreshCw className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:bg-red-50"
                                    title="Cancel request"
                                    onClick={() => {
                                      setRequestToCancel(req);
                                      setCancelModalOpen(true);
                                    }}
                                    data-testid={`button-cancel-${req.requestNumber}`}
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cancel Confirmation Dialog */}
        <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
          <DialogContent className="max-w-md" data-testid="dialog-cancel-request">
            <DialogHeader>
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-2">
                <AlertCircle className="w-6 h-6" />
              </div>
              <DialogTitle className="font-display text-lg">Cancel Payment Request?</DialogTitle>
              <DialogDescription>
                Are you sure you want to cancel this payment request? The sender will no longer be able to make a payment using this request link.
              </DialogDescription>
            </DialogHeader>

            {requestToCancel && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Request Number:</span>
                  <span className="font-mono text-xs font-semibold text-slate-800">{requestToCancel.requestNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sender:</span>
                  <span className="font-medium text-slate-800">{requestToCancel.senderName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-semibold text-slate-900">
                    {CURRENCY_SYMBOLS[requestToCancel.payInCurrency] || ""}{requestToCancel.payInAmount} {requestToCancel.payInCurrency}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCancelModalOpen(false);
                  setRequestToCancel(null);
                }}
                data-testid="button-dialog-keep-request"
              >
                Keep Request
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={async () => {
                  if (!requestToCancel) return;
                  const reqId = requestToCancel.id;
                  setCancelModalOpen(false);
                  setRequestToCancel(null);
                  await run("Cancel", () => cancelRequest(reqId), "Payment request cancelled successfully.");
                }}
                data-testid="button-dialog-confirm-cancel"
              >
                Yes, Cancel Request
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
