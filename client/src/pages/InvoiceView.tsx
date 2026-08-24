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
  ArrowRight, ChevronLeft, FileText, ShieldCheck,
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
        <div className="flex h-full flex-col">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Secure checkout</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950 font-display">Complete your payment</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Review the invoice details, then continue to choose how you would like to pay.
            </p>
          </div>

          <div className="mt-7 space-y-4">
          {isOverdue && (
            <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3" data-testid="overdue-banner">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900">
                This invoice is overdue, but you can still make payment until {formatHumanDate(invoice.expiryDate)}.
              </p>
            </div>
          )}
          <div className="rounded-lg bg-emerald-50/60 border border-emerald-100 px-4 py-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Protected by Rhemito</p>
              <p className="mt-1 text-sm text-slate-600 leading-6">
                Payments are processed securely. Start payment before {formatHumanDate(invoice.expiryDate)} at 11:59 p.m.
              </p>
            </div>
          </div>
          {invoice.hasDocument && (
            <Button
              variant="outline"
              className="h-12 w-full justify-between border-slate-200 px-4 text-slate-800 hover:bg-slate-50"
              onClick={() => window.open(publicInvoiceDocumentUrl(token!), "_blank")}
              data-testid="button-view-invoice-document"
            >
              <span className="flex items-center gap-2.5"><FileText className="h-4 w-4 text-slate-500" />View invoice document</span>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </Button>
          )}
          </div>
          <Button
            onClick={() => setPayStep("choose_method")}
            className="mt-auto h-14 w-full justify-between bg-blue-600 px-5 text-base hover:bg-blue-700"
            size="lg"
            data-testid="button-pay-invoice"
          >
            <span>Pay {sym}{invoice.fees.clientPays.toFixed(2)} {invoice.currency}</span>
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      );
    }

    if (payStep === "choose_method") {
      return (
        <div className="flex h-full flex-col" data-testid="payment-methods">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Payment method</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950 font-display">How would you like to pay?</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Choose a secure payment method to continue.</p>
          </div>
          <div className="mt-7 space-y-3">
          <button
            className="group w-full flex items-center gap-4 p-4 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 text-left transition-colors"
            onClick={() => handleInitiatePayment("card")}
            disabled={startingPayment}
            data-testid="button-pay-card"
          >
            <div className="w-11 h-11 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">Card Payment</p>
              <p className="mt-0.5 text-sm text-slate-500">Pay instantly by debit or credit card</p>
            </div>
            <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-blue-600" />
          </button>
          <button
            className="group w-full flex items-center gap-4 p-4 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 text-left transition-colors"
            onClick={() => handleInitiatePayment("bank_transfer")}
            disabled={startingPayment}
            data-testid="button-pay-bank"
          >
            <div className="w-11 h-11 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">Bank Transfer</p>
              <p className="mt-0.5 text-sm text-slate-500">Pay directly from your bank account</p>
            </div>
            <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-blue-600" />
          </button>
          </div>
          <Button variant="ghost" className="mt-auto w-fit px-2 text-slate-600" onClick={() => setPayStep("landing")} data-testid="button-back-to-summary">
            <ChevronLeft className="mr-1 h-4 w-4" /> Back to summary
          </Button>
        </div>
      );
    }

    return null;
  };

  return (
    <Shell>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-2xl shadow-slate-300/40">
          <div className="grid min-h-[570px] md:grid-cols-[minmax(300px,5fr)_minmax(420px,7fr)]">
            {/* Summary panel */}
            <div className="p-7 md:p-10 bg-slate-900 text-white flex flex-col justify-between gap-8">
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                  <FileText className="h-5 w-5 text-white/80" />
                </div>
                <p className="mt-6 text-xs font-semibold uppercase text-white/50">Invoice</p>
                <p className="text-2xl font-bold font-display mt-2 break-words" data-testid="public-invoice-number">{invoice.invoiceNumber}</p>
                <p className="text-sm text-white/60 mt-2">Issued by <span className="font-medium text-white/90">{invoice.senderName}</span></p>
              </div>

              <div className="space-y-6">
                <div>
                  <p className="text-xs font-medium text-white/50">Invoice amount</p>
                  <p className="mt-1 text-lg font-semibold" data-testid="public-invoice-amount">
                    {sym}{invoice.fees.invoiceAmount.toFixed(2)} {invoice.currency}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-white/50">Total to pay, including fees</p>
                  <p className="mt-1 text-4xl font-bold text-emerald-400" data-testid="public-client-pays">
                    {sym}{invoice.fees.clientPays.toFixed(2)} {invoice.currency}
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-sm border-t border-white/10 pt-5">
                {invoice.dueDate && (
                  <div className="flex justify-between">
                    <span className="text-white/60">Due Date</span>
                    <span className="font-medium text-right">{formatHumanDate(invoice.dueDate)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-white/60">Payment Link Expiry</span>
                  <span className="font-medium text-right">{formatHumanDate(invoice.expiryDate)}</span>
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
            <CardContent className="p-7 md:p-10">
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
    <div className="min-h-screen bg-[#f5f7fb] flex flex-col items-center justify-center px-4 py-8 md:px-8 md:py-12 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-blue-600/30 pointer-events-none" />
      <div className="w-full max-w-5xl mb-7 flex items-center justify-center md:justify-start relative z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center">
            <img src={logo} alt="Rhemito Logo" className="w-full h-full object-contain" />
          </div>
          <span className="text-lg md:text-xl font-bold text-slate-800 tracking-tight font-display">Rhemito</span>
        </div>
      </div>
      <div className="w-full max-w-5xl relative z-10">{children}</div>
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
    <motion.div className="mx-auto max-w-md" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
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
