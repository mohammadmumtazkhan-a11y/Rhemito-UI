/**
 * Invoice Details — Send Invoice MVP1.
 * Full sender-side view: invoice & client data, fees, dates, payment info,
 * cancellation details, new-link request status, document download and the
 * important-events timeline. Status-based actions only — never Edit/Extend/Reactivate.
 */

import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft, Download, FilePlus2, XCircle, Mail, Clock, User, Building2, CalendarDays, Receipt,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { CancelInvoiceDialog } from "@/components/invoices/CancelInvoiceDialog";
import { resendInvoiceNotificationRequest, type InvoiceDetails } from "@/lib/invoices";
import { formatHumanDate, formatShortDate } from "@shared/invoice-logic";

const CURRENCY_SYMBOLS: Record<string, string> = { GBP: "£", USD: "$", EUR: "€", NGN: "₦" };

const EVENT_LABELS: Record<string, string> = {
  invoice_generated: "Invoice generated",
  notification_queued: "Invoice notification queued",
  due_reminder_sent: "Due Date reminder sent",
  expiry_reminder_sent: "Expiry reminder sent",
  payment_initiated: "Payment initiated",
  payment_processing: "Payment processing",
  payment_completed: "Payment completed",
  payment_failed: "Payment failed — invoice returned to active status",
  invoice_expired: "Invoice expired",
  new_link_requested: "New payment link requested",
  invoice_cancelled: "Invoice cancelled",
};

function isoToDateStr(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

export default function SentInvoiceDetails() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showCancel, setShowCancel] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const { data, isLoading, error } = useQuery<{ data: InvoiceDetails }>({
    queryKey: [`/api/invoices/${id}`],
    // Status, payment results and reminders change server-side — never show a
    // stale cached detail view.
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-5xl mx-auto py-16 text-center text-muted-foreground text-sm">Loading invoice…</div>
      </DashboardLayout>
    );
  }

  if (error || !data?.data) {
    return (
      <DashboardLayout>
        <div className="max-w-5xl mx-auto py-16 text-center space-y-4">
          <p className="text-muted-foreground">Invoice not found or you do not have access to it.</p>
          <Button variant="outline" onClick={() => setLocation("/sent-invoices")} data-testid="button-back-to-list">
            Back to Sent Invoices
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const invoice = data.data;
  const sym = CURRENCY_SYMBOLS[invoice.currency] ?? "";
  const canCancel = invoice.status === "sent" || invoice.status === "overdue";
  const canResend = invoice.status === "sent" || invoice.status === "overdue";
  const isExpired = invoice.status === "expired";

  const handleResend = async () => {
    setIsResending(true);
    try {
      await resendInvoiceNotificationRequest(invoice.id);
      toast({
        title: "Notification resent",
        description: `The invoice email was resent to ${invoice.clientEmail} using the same payment link.`,
      });
    } catch (err) {
      toast({
        title: "Resend failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Button
            variant="ghost"
            onClick={() => setLocation("/sent-invoices")}
            className="mb-4 -ml-2"
            data-testid="button-back-to-list"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Sent Invoices
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold font-display">{invoice.invoiceNumber}</h1>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
          <p className="text-muted-foreground mt-1">
            {invoice.clientType === "business" ? "Business client" : "Individual client"} • Sent{" "}
            {invoice.sentAt ? formatShortDate(isoToDateStr(invoice.sentAt)) : "—"}
          </p>
        </motion.div>

        {/* Status-based actions */}
        <div className="flex flex-wrap gap-2 mb-6" data-testid="invoice-detail-actions">
          {canCancel && (
            <Button
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              onClick={() => setShowCancel(true)}
              data-testid="button-cancel-invoice-detail"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Cancel Invoice
            </Button>
          )}
          {canResend && (
            <Button variant="outline" disabled={isResending} onClick={handleResend} data-testid="button-resend-detail">
              <Mail className="w-4 h-4 mr-2" />
              {isResending ? "Resending…" : "Resend Notification"}
            </Button>
          )}
          {isExpired && (
            <Button onClick={() => setLocation("/send-invoice")} data-testid="button-create-new-detail">
              <FilePlus2 className="w-4 h-4 mr-2" />
              Create New Invoice
            </Button>
          )}
          {invoice.status === "payment_processing" && (
            <p className="text-sm text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2" data-testid="text-processing-note">
              A payment is being processed. This invoice cannot be cancelled while the payment is in flight.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Invoice & amounts */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Receipt className="w-5 h-5 text-primary" />
                Invoice
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-border divide-y divide-border">
                <Row label="Sender" value={invoice.senderName} />
                <Row label="Invoice Amount" value={`${sym}${invoice.fees.invoiceAmount.toFixed(2)} ${invoice.currency}`} />
                <Row label="Fee Treatment" value={invoice.absorbFee ? "3% fee absorbed by you" : "3% fee added to client"} />
                <Row label="Applicable Fees (3%)" value={`${sym}${invoice.fees.fee.toFixed(2)} ${invoice.currency}`} />
                <Row label="Client Pays" value={`${sym}${invoice.fees.clientPays.toFixed(2)} ${invoice.currency}`} />
                <Row label="You Receive" value={`${sym}${invoice.fees.senderReceives.toFixed(2)} ${invoice.currency}`} />
                <Row
                  label="Receiving Payout Account"
                  value={`${invoice.payoutAccountBank ?? "—"} (****${(invoice.payoutAccountNumber ?? "").slice(-4)}) • ${invoice.payoutAccountName ?? "—"} • ${invoice.payoutAccountCurrency ?? ""}`}
                />
              </div>
              {invoice.documentId && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open(`/api/invoices/${invoice.id}/document`, "_blank")}
                  data-testid="button-download-document"
                >
                  <Download className="w-4 h-4 mr-2" />
                  View Invoice Document
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Client */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                {invoice.clientType === "business" ? (
                  <Building2 className="w-5 h-5 text-primary" />
                ) : (
                  <User className="w-5 h-5 text-primary" />
                )}
                Client
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-border divide-y divide-border">
                <Row label="Name" value={invoice.clientName} />
                <Row label="Email" value={invoice.clientEmail} />
                <Row
                  label="Phone"
                  value={invoice.clientPhoneNumber ? `${invoice.clientPhoneCode ?? ""} ${invoice.clientPhoneNumber}` : "Not provided"}
                />
              </div>
            </CardContent>
          </Card>

          {/* Dates & payment */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-primary" />
                Dates & Payment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-border divide-y divide-border">
                <Row label="Sent Date" value={invoice.sentAt ? formatHumanDate(isoToDateStr(invoice.sentAt)) : "—"} />
                <Row label="Due Date" value={invoice.dueDate ? formatHumanDate(invoice.dueDate) : "No due date"} />
                <Row
                  label="Payment Link Expiry"
                  value={`${formatHumanDate(invoice.expiryDate)} at 11:59 p.m. (${invoice.expiryTimezone})`}
                />
                {invoice.paymentRef && <Row label="Payment Reference" value={invoice.paymentRef} />}
                {invoice.paymentMethod && (
                  <Row
                    label="Payment Method"
                    value={invoice.paymentMethod === "card" ? "Card Payment" : "Bank Transfer"}
                  />
                )}
                {invoice.paidAt && (
                  <Row label="Paid On" value={formatHumanDate(isoToDateStr(invoice.paidAt))} />
                )}
                {invoice.expiredAt && (
                  <Row label="Expired On" value={formatHumanDate(isoToDateStr(invoice.expiredAt))} />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Cancellation / new link request */}
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Cancellation & Link Requests
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {invoice.status === "cancelled" && invoice.cancelledAt ? (
                <div className="rounded-xl border border-red-200 bg-red-50 divide-y divide-red-100" data-testid="cancellation-details">
                  <Row label="Cancelled On" value={formatHumanDate(isoToDateStr(invoice.cancelledAt))} />
                  <Row label="Cancelled By" value={invoice.cancelledBy ?? "—"} />
                  <div className="px-4 py-2.5 text-sm">
                    <p className="text-muted-foreground">Reason (shared with the client):</p>
                    <p className="font-medium mt-1">{invoice.cancellationReason}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">This invoice has not been cancelled.</p>
              )}

              {invoice.newLinkRequestedAt ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm" data-testid="new-link-request">
                  <p className="font-medium text-amber-900">New payment link requested</p>
                  <p className="text-amber-800 mt-1 text-xs">
                    Requested by {invoice.newLinkRequestedBy ?? invoice.clientEmail} on{" "}
                    {formatHumanDate(isoToDateStr(invoice.newLinkRequestedAt))}. To accept the request, create and
                    send a new invoice.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No new payment link has been requested.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Important events timeline */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="font-display text-lg">Important Invoice Events</CardTitle>
          </CardHeader>
          <CardContent>
            {invoice.events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events recorded.</p>
            ) : (
              <ol className="relative border-l-2 border-border ml-3 space-y-6" data-testid="invoice-events">
                {invoice.events.map((event) => (
                  <li key={event.id} className="ml-4">
                    <div className="absolute -left-[7px] w-3 h-3 rounded-full bg-primary border-2 border-white mt-1" />
                    <p className="text-sm font-medium">{EVENT_LABELS[event.type] ?? event.type}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {event.createdAt ? new Date(event.createdAt).toLocaleString() : "—"}
                      {event.actor ? ` • by ${event.actor}` : ""}
                    </p>
                    {event.type === "invoice_cancelled" && event.payload?.reason ? (
                      <p className="text-xs text-muted-foreground mt-1">Reason: {String(event.payload.reason)}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {/* Client email delivery */}
        <Card className="mt-6 mb-4">
          <CardHeader>
            <CardTitle className="font-display text-lg">Client Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            {invoice.emails.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notifications have been sent.</p>
            ) : (
              <div className="space-y-2" data-testid="invoice-emails">
                {invoice.emails.map((email) => (
                  <div key={email.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-2.5 text-sm">
                    <div>
                      <p className="font-medium">{email.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        To {email.toEmail}
                        {email.attachmentFileName ? ` • Attached: ${email.attachmentFileName}` : ""}
                        {" • "}
                        {email.lastAttemptAt ? new Date(email.lastAttemptAt).toLocaleString() : "—"}
                      </p>
                    </div>
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {email.status === "sent" ? "Delivered" : email.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CancelInvoiceDialog invoice={invoice} open={showCancel} onOpenChange={setShowCancel} />
    </DashboardLayout>
  );
}
