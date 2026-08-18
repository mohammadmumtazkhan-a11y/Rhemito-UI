/**
 * Public payment-request checkout — /pay/:token.
 *
 * Mobile-first: opening the link on a phone goes straight to the checkout
 * ("Open payment request"), never a "scan to pay" prompt. The payer can pay as
 * a guest or (future provider work) as an authenticated Rhemito user. Funding
 * only happens through the provider webhook — the browser alone can never mark
 * a request paid.
 */

import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle, CheckCircle2, Flag, LifeBuoy, Loader2, Lock, ShieldCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// @ts-ignore
import logo from "../assets/rhemito-logo-blue.png";
import {
  createIntent, devAuthorizeIntent, getPublicRequest, reportRequest,
  METHOD_LABELS, type PublicRequestView,
} from "@/lib/requests";
import { CURRENCY_SYMBOLS } from "@shared/currencies";
import { formatHumanDate } from "@shared/invoice-logic";

type Stage = "checkout" | "authorizing" | "status" | "report";

export default function RequestCheckout() {
  const { id: token } = useParams<{ id: string }>();
  const [stage, setStage] = useState<Stage>("checkout");
  const [intentId, setIntentId] = useState<string | null>(null);
  const [method, setMethod] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [reportSent, setReportSent] = useState(false);

  const { data: request, isError, refetch } = useQuery<PublicRequestView>({
    queryKey: [`/api/public/requests/${token}`],
    queryFn: () => getPublicRequest(token!),
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "payment_pending" || s === "funded" || s === "payout_pending" ? 1500 : false;
    },
    retry: false,
  });

  // Follow the payment through the provider webhook to final status.
  useEffect(() => {
    if (!request) return;
    if (request.status === "funded" || request.status === "payout_pending" || request.status === "paid_out") {
      setStage("status");
    }
  }, [request?.status]);

  if (isError) {
    return (
      <Shell>
        <StatusCard icon={<Lock className="w-8 h-8 text-slate-600" />} title="Payment link not valid" testId="invalid-link">
          <p className="text-sm text-slate-700">This payment link does not exist or is no longer available.</p>
          <p className="text-xs text-muted-foreground">If you believe this is a mistake, contact the requester or Rhemito support.</p>
        </StatusCard>
      </Shell>
    );
  }

  if (!request) {
    return (
      <Shell>
        <div className="py-20 flex items-center justify-center gap-2 text-slate-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading payment request…
        </div>
      </Shell>
    );
  }

  const symbol = CURRENCY_SYMBOLS[request.currency] ?? "";
  const terminal =
    request.status === "paid_out" || request.status === "funded" || request.status === "payout_pending";
  const blocked =
    request.status === "cancelled"
      ? "This request was cancelled by the requester."
      : request.status === "expired"
        ? "This request has expired. Please ask the requester for a new link."
        : terminal
          ? "This request has already been paid."
          : null;

  const handleMethod = async (chosen: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const intent = await createIntent(token!, chosen);
      setIntentId(intent.intentId);
      setMethod(chosen);
      setStage("authorizing");
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The payment could not be started.");
    } finally {
      setBusy(false);
    }
  };

  const handleAuthorize = async () => {
    if (!intentId || busy) return;
    setBusy(true);
    setError("");
    try {
      // Development provider simulation: completes the provider authorisation
      // and settles via the signed webhook boundary (same as production).
      await devAuthorizeIntent(intentId);
      setStage("status");
      // Kick off the status polling (the interval re-evaluates after each refetch).
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authorisation failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleReport = async () => {
    if (!reportReason.trim()) return;
    try {
      await reportRequest(token!, reportReason.trim());
      setReportSent(true);
    } catch {
      setError("The report could not be submitted. Please try again.");
    }
  };

  // ─── Status page ────────────────────────────────────────────────────────────

  if (stage === "status" || blocked) {
    const statusText: Record<string, string> = {
      payment_pending: "Authorising your payment…",
      funded: "Payment received — payout to the requester is being processed.",
      payout_pending: "Payment received — payout to the requester is being processed.",
      paid_out: "Payment complete",
      cancelled: "Request cancelled",
      expired: "Request expired",
    };
    return (
      <Shell>
        <StatusCard
          icon={
            request.status === "paid_out"
              ? <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              : blocked
                ? <AlertTriangle className="w-8 h-8 text-amber-600" />
                : <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          }
          title={statusText[request.status] ?? request.status}
          testId="status-card"
        >
          <div className="rounded-xl border border-border divide-y divide-border text-sm">
            <Row label="Request" value={request.requestNumber} />
            <Row label="Amount" value={`${symbol}${request.amount} ${request.currency}`} />
            <Row label="Paid to" value={request.requesterName} />
          </div>
          {(request.status === "funded" || request.status === "payout_pending") && (
            <p className="text-xs text-muted-foreground">This page updates automatically.</p>
          )}
          {request.status === "paid_out" && (
            <p className="text-xs text-muted-foreground">A confirmation has been sent to the requester.</p>
          )}
        </StatusCard>
      </Shell>
    );
  }

  // ─── Provider authorisation (development simulation) ────────────────────────

  if (stage === "authorizing" && intentId) {
    return (
      <Shell>
        <StatusCard
          icon={<ShieldCheck className="w-8 h-8 text-primary" />}
          title="Authorise your payment"
          testId="authorize-card"
        >
          <p className="text-sm text-slate-700">
            You are paying <strong>{symbol}{request.amount} {request.currency}</strong> to {request.requesterName} using{" "}
            <strong>{METHOD_LABELS[method ?? ""] ?? method}</strong>.
          </p>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900" data-testid="dev-provider-notice">
            <strong>Development provider simulation.</strong> In production this step redirects to the provider-hosted
            authorisation (bank app, 3-D Secure) and Rhemito is notified by a signed webhook — the browser alone can
            never mark the payment complete.
          </div>
          {error && <p className="text-xs text-destructive" data-testid="error-authorize">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { setStage("checkout"); setIntentId(null); }}>
              Back
            </Button>
            <Button className="flex-1 bg-primary hover:bg-primary/90" disabled={busy} onClick={handleAuthorize} data-testid="button-authorize">
              {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…</> : "Authorise payment"}
            </Button>
          </div>
        </StatusCard>
      </Shell>
    );
  }

  // ─── Report flow ────────────────────────────────────────────────────────────

  if (stage === "report") {
    return (
      <Shell>
        <StatusCard icon={<Flag className="w-8 h-8 text-red-600" />} title="Report this request" testId="report-card">
          {reportSent ? (
            <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-3" data-testid="report-sent">
              Thank you. Our team will review this request. Do not send money if you have any doubts.
            </p>
          ) : (
            <>
              <textarea
                className="w-full rounded-xl border border-border p-3 text-sm min-h-24 bg-white"
                placeholder="Tell us why you are reporting this request (e.g. unexpected request, suspicious sender)"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                data-testid="input-report-reason"
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStage("checkout")}>Back</Button>
                <Button variant="destructive" className="flex-1" disabled={!reportReason.trim()} onClick={handleReport} data-testid="button-submit-report">
                  Submit report
                </Button>
              </div>
            </>
          )}
        </StatusCard>
      </Shell>
    );
  }

  // ─── Checkout (guest payer — no Rhemito account needed) ─────────────────────

  return (
    <Shell>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Card className="shadow-xl">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 space-y-3" data-testid="checkout-summary">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/60">Payment request</p>
              <p className="text-xs font-mono text-white/70">{request.requestNumber}</p>
            </div>
            <p className="text-4xl font-bold tracking-tight" data-testid="checkout-amount">
              {symbol}{request.amount} <span className="text-lg text-white/70">{request.currency}</span>
            </p>
            <div className="space-y-1 text-sm border-t border-white/10 pt-3">
              <div className="flex justify-between"><span className="text-white/60">Requested by</span><span className="font-medium">{request.requesterName}</span></div>
              <div className="flex justify-between"><span className="text-white/60">Identity</span><span className="text-white/80 text-xs">{request.requesterIdentity}</span></div>
              <div className="flex justify-between"><span className="text-white/60">Purpose</span><span className="font-medium capitalize">{request.purpose.replace(/_/g, " ")}</span></div>
              {request.reference && <div className="flex justify-between"><span className="text-white/60">Reference</span><span className="font-medium">{request.reference}</span></div>}
              <div className="flex justify-between"><span className="text-white/60">Expires</span><span className="font-medium">{formatHumanDate(request.expiryDate)}</span></div>
            </div>
          </div>

          <CardContent className="p-5 space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Open payment request — choose how to pay</p>
              {request.methods.map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={busy}
                  onClick={() => handleMethod(m)}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 text-left transition-colors disabled:opacity-50"
                  data-testid={`button-method-${m}`}
                >
                  <span className="text-sm font-medium text-slate-900">{METHOD_LABELS[m] ?? m}</span>
                  <span className="text-xs text-slate-500">{symbol}{request.amount}</span>
                </button>
              ))}
              {busy && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Starting payment…</p>}
              {error && <p className="text-xs text-destructive" data-testid="error-checkout">{error}</p>}
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-[11px] text-slate-600 space-y-1.5" data-testid="checkout-disclosures">
              <p>{request.senderFeeNote}</p>
              <p>Estimated delivery: {request.estimatedDeliveryTime}.</p>
              <p className="flex items-start gap-1.5 text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                Anti-scam warning: Rhemito never asks for your password, full card number or one-time codes. Only pay
                requests you expect.
              </p>
              <p>{request.legalEntity.displayName} — {request.legalEntity.safeguardingStatement}</p>
            </div>

            <div className="flex items-center justify-between text-xs">
              <button type="button" className="text-red-600 font-medium hover:underline flex items-center gap-1" onClick={() => setStage("report")} data-testid="button-report">
                <Flag className="w-3.5 h-3.5" /> Report this request
              </button>
              <span className="text-muted-foreground flex items-center gap-1">
                <LifeBuoy className="w-3.5 h-3.5" /> Support: {request.legalEntity.supportUrl}
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </Shell>
  );
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 sm:p-8">
      <div className="w-full max-w-md mb-5 flex items-center gap-2.5">
        <img src={logo} alt="Rhemito Logo" className="w-9 h-9 object-contain" />
        <span className="text-lg font-bold text-slate-800 font-display">Rhemito</span>
      </div>
      {children}
    </div>
  );
}

function StatusCard(props: { icon: React.ReactNode; title: string; testId: string; children?: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
      <Card className="shadow-xl" data-testid={props.testId}>
        <div className="bg-slate-100/80 p-5 border-b border-border flex flex-col items-center text-center gap-2">
          <div className="w-14 h-14 rounded-full bg-white border border-slate-200 flex items-center justify-center">
            {props.icon}
          </div>
          <h1 className="text-lg font-bold text-slate-900 font-display">{props.title}</h1>
        </div>
        <CardContent className="p-5 space-y-3">{props.children}</CardContent>
      </Card>
    </motion.div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between px-3.5 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
