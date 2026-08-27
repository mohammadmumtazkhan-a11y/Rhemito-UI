/**
 * Sent Invoices dashboard — Send Invoice MVP1.
 * Lists every generated invoice for the authorised account with search,
 * status filter, sent-date range, pagination and status-based actions.
 */

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  FilePlus2, Eye, XCircle, Mail, Search, ChevronLeft, ChevronRight, FileText, Inbox,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { CancelInvoiceDialog } from "@/components/invoices/CancelInvoiceDialog";
import {
  invoiceListUrl,
  resendInvoiceNotificationRequest,
  type InvoiceListItem,
  type InvoiceListResponse,
} from "@/lib/invoices";
import { formatShortDate } from "@shared/invoice-logic";

const CURRENCY_SYMBOLS: Record<string, string> = { GBP: "£", USD: "$", EUR: "€", NGN: "₦" };

const STATUS_FILTERS = [
  { label: "All Statuses", value: "all" },
  { label: "Sent", value: "sent" },
  { label: "Overdue", value: "overdue" },
  { label: "Payment Processing", value: "payment_processing" },
  { label: "Paid", value: "paid" },
  { label: "Expired", value: "expired" },
  { label: "Cancelled", value: "cancelled" },
];

function isoToDateStr(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

export default function SentInvoices() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sentFrom, setSentFrom] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [page, setPage] = useState(1);
  const [cancelTarget, setCancelTarget] = useState<InvoiceListItem | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [status, sentFrom, sentTo]);

  const url = invoiceListUrl({ search, status, sentFrom, sentTo, page });
  const { data, isLoading } = useQuery<InvoiceListResponse>({
    queryKey: ["/api/invoices", { search, status, sentFrom, sentTo, page }],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load invoices");
      return res.json();
    },
    // Invoice state changes server-side (payments, expiry) and the prototype
    // store resets on restart — never show stale cached rows.
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    // Payments land from the public invoice link — keep the list live.
    refetchInterval: 5000,
  });

  const invoices = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const pageSize = data?.meta.pageSize ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleResend = async (invoice: InvoiceListItem) => {
    setResendingId(invoice.id);
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
      setResendingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-display">Sent Invoices</h1>
            <p className="text-muted-foreground mt-1">Track every invoice you have sent and its current status</p>
          </div>
          <Button onClick={() => setLocation("/send-invoice")} data-testid="button-new-invoice-header">
            <FilePlus2 className="w-4 h-4 mr-2" />
            New Invoice
          </Button>
        </motion.div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-end" data-testid="invoice-filters">
              <div className="space-y-1">
                <Label htmlFor="invoiceSearch" className="text-xs text-muted-foreground">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                  <Input
                    id="invoiceSearch"
                    placeholder="Invoice, client or email"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-invoices"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-full" data-testid="select-status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_FILTERS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="sentFrom" className="text-xs text-muted-foreground">Sent from</Label>
                <Input
                  id="sentFrom"
                  type="date"
                  value={sentFrom}
                  onChange={(e) => setSentFrom(e.target.value)}
                  data-testid="input-sent-from"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sentTo" className="text-xs text-muted-foreground">Sent to</Label>
                <Input
                  id="sentTo"
                  type="date"
                  value={sentTo}
                  onChange={(e) => setSentTo(e.target.value)}
                  data-testid="input-sent-to"
                />
              </div>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="py-16 text-center text-muted-foreground text-sm">Loading invoices…</div>
            ) : invoices.length === 0 ? (
              <div className="py-16 flex flex-col items-center text-center gap-3" data-testid="empty-invoices">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Inbox className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <p className="font-medium">No invoices found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Invoices appear here once you complete the Send Invoice process.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setLocation("/send-invoice")} data-testid="button-create-first-invoice">
                  Send your first invoice
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border" data-testid="sent-invoices-table">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3 font-semibold">Invoice</th>
                      <th className="px-4 py-3 font-semibold">Client</th>
                      <th className="px-4 py-3 font-semibold">Amount</th>
                      <th className="px-4 py-3 font-semibold">Sent</th>
                      <th className="px-4 py-3 font-semibold">Due</th>
                      <th className="px-4 py-3 font-semibold">Expiry</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Paid On</th>
                      <th className="px-4 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-muted/30" data-testid={`invoice-row-${inv.invoiceNumber}`}>
                        <td className="px-4 py-3">
                          <button
                            className="font-medium text-primary hover:underline inline-flex items-center gap-1.5"
                            onClick={() => setLocation(`/sent-invoices/${inv.id}`)}
                            data-testid={`link-invoice-${inv.invoiceNumber}`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {inv.invoiceNumber}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{inv.clientName}</div>
                          <div className="text-xs text-muted-foreground">{inv.clientEmail}</div>
                        </td>
                        <td className="px-4 py-3 font-medium whitespace-nowrap">
                          {CURRENCY_SYMBOLS[inv.currency] ?? ""}{inv.fees.invoiceAmount.toFixed(2)} {inv.currency}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{inv.sentAt ? formatShortDate(isoToDateStr(inv.sentAt)) : "—"}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{inv.dueDate ? formatShortDate(inv.dueDate) : "—"}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatShortDate(inv.expiryDate)}</td>
                        <td className="px-4 py-3"><InvoiceStatusBadge status={inv.status} /></td>
                        <td className="px-4 py-3 whitespace-nowrap">{inv.paidAt ? formatShortDate(isoToDateStr(inv.paidAt)) : "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="View Invoice"
                              onClick={() => setLocation(`/sent-invoices/${inv.id}`)}
                              data-testid={`button-view-${inv.invoiceNumber}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {(inv.status === "sent" || inv.status === "overdue") && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Resend Notification"
                                  disabled={resendingId === inv.id}
                                  onClick={() => handleResend(inv)}
                                  data-testid={`button-resend-${inv.invoiceNumber}`}
                                >
                                  <Mail className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Cancel Invoice"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => setCancelTarget(inv)}
                                  data-testid={`button-cancel-${inv.invoiceNumber}`}
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            {inv.status === "expired" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setLocation("/send-invoice")}
                                data-testid={`button-create-new-${inv.invoiceNumber}`}
                              >
                                <FilePlus2 className="w-4 h-4 mr-1.5" />
                                Create New Invoice
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {total > 0 && (
              <div className="flex items-center justify-between pt-2" data-testid="invoice-pagination">
                <p className="text-xs text-muted-foreground">
                  {total} invoice{total === 1 ? "" : "s"} • Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    data-testid="button-next-page"
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CancelInvoiceDialog
        invoice={cancelTarget}
        open={cancelTarget !== null}
        onOpenChange={(open) => { if (!open) setCancelTarget(null); }}
      />
    </DashboardLayout>
  );
}
