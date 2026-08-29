/**
 * Invoices — dedicated invoice management page.
 *
 * The single hub for every invoice (generated on the go or uploaded): summary
 * counts per status, status/source filters, search, paginated table with the
 * same status-based row actions as the unified Transactions table (view
 * details, resend notification, cancel — never edit), and a Create Invoice
 * entry point into the Send Invoice page.
 */

import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Search, Plus, Eye, Mail, XCircle, ChevronLeft, ChevronRight,
  Sparkles, Upload, FileText, RefreshCw,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { CancelInvoiceDialog } from "@/components/invoices/CancelInvoiceDialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { invoiceActionable } from "@/lib/unifiedTransactions";
import {
  invoiceListUrl,
  resendInvoiceNotificationRequest,
  type InvoiceListItem,
  type InvoiceListResponse,
} from "@/lib/invoices";
import { formatShortDate } from "@shared/invoice-logic";
import { cn } from "@/lib/utils";

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  NGN: "₦",
};

type StatusFilter = "all" | "sent" | "overdue" | "payment_processing" | "paid" | "expired" | "cancelled";
type SourceFilter = "all" | "generated" | "uploaded";

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string; dot: string }> = [
  { value: "all", label: "All", dot: "bg-blue-500" },
  { value: "sent", label: "Sent", dot: "bg-blue-500" },
  { value: "overdue", label: "Overdue", dot: "bg-amber-500" },
  { value: "payment_processing", label: "Payment Processing", dot: "bg-purple-500" },
  { value: "paid", label: "Paid", dot: "bg-emerald-500" },
  { value: "expired", label: "Expired", dot: "bg-slate-400" },
  { value: "cancelled", label: "Cancelled", dot: "bg-red-500" },
];

const SOURCE_FILTERS: Array<{ value: SourceFilter; label: string }> = [
  { value: "all", label: "All Sources" },
  { value: "generated", label: "Generated" },
  { value: "uploaded", label: "Uploaded" },
];

const INVOICES_PAGE_SIZE = 10;

/** Fetch every invoice by following the list endpoint's pagination. */
async function fetchAllInvoices(): Promise<InvoiceListItem[]> {
  const firstRes = await apiRequest("GET", invoiceListUrl({ page: 1 }));
  const first = (await firstRes.json()) as InvoiceListResponse;
  const pageCount = Math.ceil(first.meta.total / Math.max(1, first.meta.pageSize));
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pageCount - 1) }, (_, i) =>
      apiRequest("GET", invoiceListUrl({ page: i + 2 }))
        .then((res) => res.json() as Promise<InvoiceListResponse>)
        .then((json) => json.data)
        .catch(() => [] as InvoiceListItem[]),
    ),
  );
  return [...first.data, ...rest.flat()];
}

function SourceBadge({ source }: { source: string }) {
  const isGenerated = source === "generated";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
        isGenerated
          ? "bg-purple-50 text-purple-700 border-purple-200"
          : "bg-slate-100 text-slate-600 border-slate-200",
      )}
      data-testid={`badge-source-${isGenerated ? "generated" : "uploaded"}`}
    >
      {isGenerated ? <Sparkles className="w-3 h-3" /> : <Upload className="w-3 h-3" />}
      {isGenerated ? "Generated" : "Uploaded"}
    </span>
  );
}

export default function Invoices() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const searchParams = useSearch();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [page, setPage] = useState(1);
  const [invoiceToCancel, setInvoiceToCancel] = useState<InvoiceListItem | null>(null);
  const [resendingInvoiceId, setResendingInvoiceId] = useState<string | null>(null);

  // Deep-linkable status filter (?status=), same convention as Transactions' ?type=
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const status = params.get("status");
    if (status && STATUS_FILTERS.some((f) => f.value === status)) {
      setStatusFilter(status as StatusFilter);
    }
  }, [searchParams]);

  const invoicesQuery = useQuery({
    queryKey: ["/api/invoices", "invoices-page"],
    queryFn: fetchAllInvoices,
    refetchOnMount: "always",
    refetchInterval: 5000,
  });
  const invoices = useMemo(() => invoicesQuery.data ?? [], [invoicesQuery.data]);

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: invoices.length, sent: 0, overdue: 0, payment_processing: 0, paid: 0, expired: 0, cancelled: 0,
    };
    for (const inv of invoices) {
      if (inv.status in counts) counts[inv.status as StatusFilter] += 1;
    }
    return counts;
  }, [invoices]);

  const searched = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return invoices;
    return invoices.filter((inv) =>
      inv.invoiceNumber.toLowerCase().includes(query) ||
      inv.clientName.toLowerCase().includes(query) ||
      inv.clientEmail.toLowerCase().includes(query),
    );
  }, [invoices, search]);

  const filtered = useMemo(() => {
    return searched.filter((inv) => {
      const statusOk = statusFilter === "all" || inv.status === statusFilter;
      const sourceOk =
        sourceFilter === "all" || (sourceFilter === "generated" ? inv.source === "generated" : inv.source !== "generated");
      return statusOk && sourceOk;
    });
  }, [searched, statusFilter, sourceFilter]);

  // Reset pagination whenever the filters change so the user never lands on a
  // page beyond the filtered result set.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sourceFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / INVOICES_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (currentPage - 1) * INVOICES_PAGE_SIZE,
    currentPage * INVOICES_PAGE_SIZE,
  );

  const handleResend = async (invoice: InvoiceListItem) => {
    setResendingInvoiceId(invoice.id);
    try {
      await resendInvoiceNotificationRequest(invoice.id);
      toast({
        title: "Notification resent",
        description: `The invoice email was resent to ${invoice.clientEmail} using the same payment link.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    } catch (err) {
      toast({
        title: "Notification not sent",
        description: err instanceof Error ? err.message : "Please try again shortly.",
        variant: "destructive",
      });
    } finally {
      setResendingInvoiceId(null);
    }
  };

  const isLoading = invoicesQuery.isLoading;

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto space-y-6"
        data-testid="section-invoices-page"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold font-display flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              Invoices
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Generate invoices on the go or upload a document — track every invoice here.
            </p>
          </div>
          <Button
            onClick={() => setLocation("/send-invoice")}
            className="bg-primary hover:bg-primary/90 shrink-0"
            data-testid="button-create-invoice"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Invoice
          </Button>
        </div>

        {/* Summary cards per status */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
          {STATUS_FILTERS.filter((f) => f.value !== "all").map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatusFilter(statusFilter === filter.value ? "all" : filter.value)}
              className={cn(
                "text-left p-3 sm:p-4 rounded-xl border bg-white transition-all hover:shadow-md active:scale-[0.98]",
                statusFilter === filter.value ? "border-primary/40 ring-2 ring-primary/20" : "border-border",
              )}
              data-testid={`summary-card-${filter.value}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={cn("w-2 h-2 rounded-full shrink-0", filter.dot)} />
                <span className="text-xs font-medium text-muted-foreground truncate">{filter.label}</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold font-display text-foreground">
                {isLoading ? "—" : statusCounts[filter.value]}
              </p>
            </button>
          ))}
        </div>

        {/* Table card */}
        <Card className="border-border/60">
          <CardContent className="p-0">
            {/* Filters + search */}
            <div className="p-4 md:p-6 space-y-3 border-b border-border/60">
              <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                <div className="relative w-full lg:max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by invoice number, client or email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-invoices"
                  />
                </div>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                  {SOURCE_FILTERS.map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setSourceFilter(filter.value)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                        sourceFilter === filter.value
                          ? "bg-purple-600 text-white border-purple-600"
                          : "bg-white text-muted-foreground border-border hover:border-muted-foreground/40",
                      )}
                      data-testid={`chip-source-${filter.value.replace("_", "-")}`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {STATUS_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setStatusFilter(filter.value)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                      statusFilter === filter.value
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-muted-foreground border-border hover:border-muted-foreground/40",
                    )}
                    data-testid={`chip-status-${filter.value.replace("_", "-")}`}
                  >
                    <span className={cn("w-1.5 h-1.5 rounded-full", statusFilter === filter.value ? "bg-white" : filter.dot)} />
                    {filter.label}
                    <span className="font-semibold">
                      {isLoading ? "" : ` ${filter.value === "all" ? statusCounts.all : statusCounts[filter.value]}`}
                    </span>
                  </button>
                ))}
                {(statusFilter !== "all" || sourceFilter !== "all" || search) && (
                  <button
                    type="button"
                    onClick={() => { setStatusFilter("all"); setSourceFilter("all"); setSearch(""); }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="button-clear-filters"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <Table data-testid="table-invoices">
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice No.</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="hidden md:table-cell">Source</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="hidden sm:table-cell">Sent</TableHead>
                    <TableHead className="hidden lg:table-cell">Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground" data-testid="loading-invoices">
                        Loading invoices…
                      </TableCell>
                    </TableRow>
                  ) : pageRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground" data-testid="empty-invoices">
                        No invoices match your search or filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageRows.map((invoice) => (
                      <TableRow key={invoice.id} data-testid={`row-invoice-${invoice.id}`}>
                        <TableCell className="font-medium text-foreground">
                          {invoice.invoiceNumber}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-foreground text-sm">{invoice.clientName || "—"}</p>
                          <p className="text-xs text-muted-foreground">{invoice.clientEmail}</p>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <SourceBadge source={invoice.source} />
                        </TableCell>
                        <TableCell className="text-right font-semibold text-foreground">
                          {CURRENCY_SYMBOLS[invoice.currency] ?? ""}
                          {invoice.fees.invoiceAmount.toFixed(2)}{" "}
                          <span className="text-xs font-normal text-muted-foreground">{invoice.currency}</span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {invoice.sentAt ? formatShortDate(invoice.sentAt.slice(0, 10)) : "—"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {invoice.dueDate ? formatShortDate(invoice.dueDate.slice(0, 10)) : "—"}
                        </TableCell>
                        <TableCell>
                          <InvoiceStatusBadge status={invoice.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => setLocation(`/sent-invoices/${invoice.id}`)}
                              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white h-8"
                              data-testid={`button-view-${invoice.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {invoiceActionable(invoice.status) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0"
                                    disabled={resendingInvoiceId === invoice.id}
                                    onClick={() => void handleResend(invoice)}
                                    data-testid={`button-resend-${invoice.id}`}
                                  >
                                    <Mail className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Resend Notification</TooltipContent>
                              </Tooltip>
                            )}
                            {invoiceActionable(invoice.status) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:border-destructive/40"
                                    onClick={() => setInvoiceToCancel(invoice)}
                                    data-testid={`button-cancel-${invoice.id}`}
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Cancel Invoice</TooltipContent>
                              </Tooltip>
                            )}
                            {invoice.status === "expired" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() => setLocation("/send-invoice")}
                                data-testid={`button-recreate-${invoice.id}`}
                              >
                                Create New Invoice
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {filtered.length > INVOICES_PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 md:px-6 py-4 border-t border-border/60">
                <p className="text-xs text-muted-foreground">
                  Showing {(currentPage - 1) * INVOICES_PAGE_SIZE + 1} to{" "}
                  {Math.min(currentPage * INVOICES_PAGE_SIZE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage(currentPage + 1)}
                    data-testid="button-next-page"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <CancelInvoiceDialog
          invoice={invoiceToCancel}
          open={invoiceToCancel !== null}
          onOpenChange={(open) => { if (!open) setInvoiceToCancel(null); }}
        />
      </motion.div>
    </DashboardLayout>
  );
}
