/**
 * Public invoice payment page — Send Invoice MVP1.
 * Renders the client-facing view of an invoice payment link at /invoice/:token.
 * All state comes from the public API (the server is authoritative for expiry,
 * cancellation and payment status). Payment submission is simulated end-to-end
 * by the server (no real PSP in the prototype).
 */

import { useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CheckCircle2, CreditCard, Building2, Lock, Loader2, AlertCircle, Clock, XCircle, Send,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// @ts-ignore
import logo from "../assets/rhemito-logo-blue.png";
import { useToast } from "@/hooks/use-toast";
import {
  getPublicInvoice,
  initiateInvoicePayment,
  requestNewPaymentLinkRequest,
  publicInvoiceDocumentUrl,
  type PublicInvoice,
} from "@/lib/invoices";
import { formatHumanDate } from "@shared/invoice-logic";

const CURRENCY_SYMBOLS: Record<string, string> = { GBP: "£", USD: "$", EUR: "€", NGN: "₦" };

type PayStep = "landing" | "choose_method" | "processing";

export default function InvoiceView() {
  const { id: token } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [payStep, setPayStep] = useState<PayStep>("landing");
  const [startingPayment, setStartingPayment] = useState(false);
  const [linkRequestState, setLinkRequestState] = useState<"idle" | "sent">("idle");
  const [requestingLink, setRequestingLink] = useState(false);

  const { data: invoice, isError, refetch } = useQuery<PublicInvoice>({
    queryKey: [`/api/public/invoices/${token}`],
    queryFn: () => getPublicInvoice(token!),
    refetchInterval: (query) =>
      query.state.data?.status === "payment_processing" ? 2000 : false,
    retry: false,
  });

  if (isError) {
    return <Shell><InvalidLinkCard /></Shell>;
  }
  if (!invoice) {
    return (
      <Shell>
        <div className="py-24 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading invoice…
        </div>
      </Shell>
    );
  }

  const sym = CURRENCY_SYMBOLS[invoice.currency] ?? "";
  const status = invoice.status;

  const handleInitiatePayment = async (method: "card" | "bank_transfer") => {
    if (startingPayment) return;
    setStartingPayment(true);
    try {
      await initiateInvoicePayment(token!, method);
      setPayStep("processing");
      // Refetch so the cached status becomes payment_processing, which starts
      // the polling loop that follows the payment through to completion.
      await refetch();
    } catch (err) {
      toast({
        title: "Payment not started",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setStartingPayment(false);
    }
  };

  const handleRequestNewLink = async () => {
    if (requestingLink) return;
    setRequestingLink(true);
    try {
      await requestNewPaymentLinkRequest(token!);
      setLinkRequestState("sent");
    } catch (err) {
      toast({
        title: "Request not sent",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setRequestingLink(false);
    }
  };

  // ─── Status-specific states ────────────────────────────────────────────────

  if (status === "paid") {
    return (
      <Shell>
        <PaidCard invoiceNumber={invoice.invoiceNumber} alreadyPaid />
      </Shell>
    );
  }

  if (status === "cancelled") {
    const cancelledOn = invoice.cancelledAt ? formatHumanDate(invoice.cancelledAt.slice(0, 10)) : "";
    return (
      <Shell>
        <StatusCard
          icon={<XCircle className="w-8 h-8 text-red-600" />}
          title="Invoice Cancelled"
          testId="cancelled-invoice-card"
        >
          <p className="text-sm text-slate-700" data-testid="text-cancelled">
            This invoice was cancelled by the sender on {cancelledOn}.
          </p>
          {invoice.cancellationReason && (
            <p className="text-sm text-slate-700" data-testid="text-cancellation-reason">
              Reason: {invoice.cancellationReason}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Payment can no longer be made using this invoice link.
          </p>
        </StatusCard>
      </Shell>
    );
  }

  if (status === "expired") {
    const alreadyRequested = linkRequestState === "sent" || invoice.newLinkRequestedAt !== null;
    return (
      <Shell>
        <StatusCard
          icon={<Clock className="w-8 h-8 text-slate-600" />}
          title="Payment Link Expired"
          testId="expired-invoice-card"
        >
          <p className="text-sm text-slate-700" data-testid="text-expired">
            This payment link expired on {formatHumanDate(invoice.expiryDate)}. Please request a new payment link
            from {invoice.senderName}.
          </p>

          {alreadyRequested ? (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3" data-testid="request-sent-state">
              <p className="text-sm text-emerald-900 font-medium" data-testid="text-request-sent">
                Your request has been sent to the invoice sender.
              </p>
              <Button disabled className="mt-3 w-full" variant="outline" data-testid="button-request-sent">
                <Send className="w-4 h-4 mr-2" />
                Request Sent
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleRequestNewLink}
              disabled={requestingLink}
              className="mt-1 w-full bg-primary hover:bg-primary/90"
              data-testid="button-request-new-link"
            >
              {requestingLink ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Request New Payment Link
            </Button>
          )}
        </StatusCard>
      </Shell>
    );
  }

  if (status === "payment_processing" || payStep === "processing") {
    return (
      <Shell>
        <StatusCard
          icon={<Loader2 className="w-8 h-8 animate-spin text-purple-600" />}
          title="Payment Processing"
          testId="processing-card"
        >
          <p className="text-sm text-slate-700" data-testid="text-processing">
            Your payment for invoice {invoice.invoiceNumber} has been accepted and is being processed. This page
            will update automatically when the payment completes.
          </p>
          {invoice.paymentRef && (
            <p className="text-xs text-muted-foreground">Reference: {invoice.paymentRef}</p>
          )}
        </StatusCard>
      </Shell>
    );
  }

  // ─── Active (Sent / Overdue) — payment journey ─────────────────────────────

  const isOverdue = status === "overdue";

  const payArea = () => {
    if (payStep === "landing") {
      return (
        <div className="space-y-4">
          {isOverdue && (
            <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3" data-testid="overdue-banner">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900">
                This invoice is overdue, but you can still make payment until {formatHumanDate(invoice.expiryDate)}.
              </p>
            </div>
          )}
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-4 flex items-start gap-3">
            <Lock className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 leading-relaxed">
              Payments are processed securely by Rhemito. Your payment must be started before{" "}
              {formatHumanDate(invoice.expiryDate)} at 11:59 p.m.
            </p>
          </div>
          {invoice.hasDocument && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open(publicInvoiceDocumentUrl(token!), "_blank")}
              data-testid="button-view-invoice-document"
            >
              View Invoice Document
            </Button>
          )}
          <Button
            onClick={() => setPayStep("choose_method")}
            className="w-full bg-primary hover:bg-primary/90"
            size="lg"
            data-testid="button-pay-invoice"
          >
            Pay {sym}{invoice.fees.clientPays.toFixed(2)} {invoice.currency}
          </Button>
        </div>
      );
    }

    if (payStep === "choose_method") {
      return (
        <div className="space-y-3" data-testid="payment-methods">
          <p className="text-sm font-medium text-slate-800">Choose how you want to pay</p>
          <button
            className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 text-left transition-colors"
            onClick={() => handleInitiatePayment("card")}
            disabled={startingPayment}
            data-testid="button-pay-card"
          >
            <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Card Payment</p>
              <p className="text-xs text-slate-500">Pay instantly by debit or credit card</p>
            </div>
          </button>
          <button
            className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 text-left transition-colors"
            onClick={() => handleInitiatePayment("bank_transfer")}
            disabled={startingPayment}
            data-testid="button-pay-bank"
          >
            <div className="w-11 h-11 rounded-xl bg-teal/10 text-teal-700 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Bank Transfer</p>
              <p className="text-xs text-slate-500">Pay directly from your bank account</p>
            </div>
          </button>
          <Button variant="ghost" className="w-full" onClick={() => setPayStep("landing")} data-testid="button-back-to-summary">
            Back
          </Button>
        </div>
      );
    }

    return null;
  };

  return (
    <Shell>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-none shadow-xl shadow-slate-200/60 bg-white/80 backdrop-blur-xl overflow-hidden">
          <div className="grid md:grid-cols-2">
            {/* Summary panel */}
            <div className="p-8 bg-gradient-to-br from-slate-900 to-slate-800 text-white flex flex-col justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-white/50">Invoice</p>
                <p className="text-xl font-bold font-display mt-1" data-testid="public-invoice-number">{invoice.invoiceNumber}</p>
                <p className="text-sm text-white/70 mt-2">From {invoice.senderName}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs text-white/50">Invoice Amount</p>
                  <p className="text-lg font-semibold" data-testid="public-invoice-amount">
                    {sym}{invoice.fees.invoiceAmount.toFixed(2)} {invoice.currency}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/50">You Pay (incl. fees)</p>
                  <p className="text-3xl font-bold text-teal" data-testid="public-client-pays">
                    {sym}{invoice.fees.clientPays.toFixed(2)} {invoice.currency}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-sm border-t border-white/10 pt-4">
                {invoice.dueDate && (
                  <div className="flex justify-between">
                    <span className="text-white/60">Due Date</span>
                    <span className="font-medium">{formatHumanDate(invoice.dueDate)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-white/60">Payment Link Expiry</span>
                  <span className="font-medium">{formatHumanDate(invoice.expiryDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Status</span>
                  <span className="font-medium capitalize" data-testid="public-invoice-status">
                    {status === "payment_processing" ? "Payment Processing" : status}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment area */}
            <CardContent className="p-8">
              {payArea()}
            </CardContent>
          </div>
        </Card>
      </motion.div>
    </Shell>
  );
}

// ─── Layout & shared cards ────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-blue-600/5 to-transparent pointer-events-none" />
      <div className="w-full max-w-4xl mb-6 flex items-center justify-center md:justify-start relative z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center">
            <img src={logo} alt="Rhemito Logo" className="w-full h-full object-contain" />
          </div>
          <span className="text-lg md:text-xl font-bold text-slate-800 tracking-tight font-display">Rhemito</span>
        </div>
      </div>
      <div className="w-full max-w-md relative z-10">{children}</div>
    </div>
  );
}

function StatusCard({
  icon, title, testId, children,
}: {
  icon: React.ReactNode;
  title: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
      <Card className="border-border shadow-xl bg-white" data-testid={testId}>
        <div className="bg-slate-100/80 p-6 border-b border-border text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-3 shadow-inner">
            {icon}
          </div>
          <h2 className="text-xl font-bold text-slate-900 font-display">{title}</h2>
        </div>
        <CardContent className="pt-6 pb-6 space-y-3">
          {children}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PaidCard({ invoiceNumber, alreadyPaid }: { invoiceNumber: string; alreadyPaid?: boolean }) {
  return (
    <StatusCard
      icon={<CheckCircle2 className="w-8 h-8 text-emerald-600" />}
      title="Payment Complete"
      testId="paid-card"
    >
      <p className="text-sm text-slate-700" data-testid="text-paid">
        {alreadyPaid
          ? `Invoice ${invoiceNumber} has already been paid. Payment cannot be made again using this link.`
          : `Your payment for invoice ${invoiceNumber} was completed successfully.`}
      </p>
      <p className="text-xs text-muted-foreground">A confirmation has been sent to the invoice sender.</p>
    </StatusCard>
  );
}

function InvalidLinkCard() {
  return (
    <StatusCard icon={<Lock className="w-8 h-8 text-slate-600" />} title="Payment Link Not Valid" testId="invalid-link-card">
      <p className="text-sm text-slate-700">
        This invoice payment link does not exist or is no longer valid. Please check the link you received or
        contact the invoice sender.
      </p>
    </StatusCard>
  );
}
