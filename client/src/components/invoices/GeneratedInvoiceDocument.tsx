/**
 * GeneratedInvoiceDocument — the rendered document for invoices created with
 * "generate on the go". Shown to the payer on the public payment page (with a
 * Print / Save-as-PDF action) and to the sender on the invoice detail page.
 * Print styling is scoped via the .print-invoice-area rules in index.css.
 */

import { Printer, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatHumanDate, type InvoiceTotals } from "@shared/invoice-logic";
import type { InvoiceItem } from "@shared/schema";

interface GeneratedInvoiceDocumentProps {
  invoiceNumber: string;
  senderName: string;
  clientName: string;
  clientType?: string;
  items: InvoiceItem[];
  currency: string;
  currencySymbol: string;
  totals: InvoiceTotals;
  taxRate?: string | null;
  discountType?: string | null;
  discountValue?: string | null;
  notes?: string | null;
  dueDate?: string | null;
  expiryDate?: string | null;
  /** Human-formatted issue date (sender view has sentAt; the public page omits it). */
  issuedOn?: string | null;
  showPrintAction?: boolean;
  className?: string;
}

export function GeneratedInvoiceDocument({
  invoiceNumber,
  senderName,
  clientName,
  clientType,
  items,
  currency,
  currencySymbol,
  totals,
  taxRate,
  discountType,
  discountValue,
  notes,
  dueDate,
  expiryDate,
  issuedOn,
  showPrintAction = false,
  className,
}: GeneratedInvoiceDocumentProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white overflow-hidden print-invoice-area",
        className,
      )}
      data-testid="generated-invoice-document"
    >
      {/* Header */}
      <div className="p-5 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Invoice</p>
            <p className="text-base font-bold text-slate-900 font-display" data-testid="generated-invoice-number">
              {invoiceNumber}
            </p>
          </div>
        </div>
        <div className="text-xs text-slate-500 space-y-1 sm:text-right">
          {issuedOn && (
            <p>
              <span className="text-slate-400">Issued:</span>{" "}
              <span className="font-medium text-slate-700">{issuedOn}</span>
            </p>
          )}
          {dueDate && (
            <p data-testid="generated-invoice-due">
              <span className="text-slate-400">Due:</span>{" "}
              <span className="font-medium text-slate-700">{formatHumanDate(dueDate)}</span>
            </p>
          )}
          {expiryDate && (
            <p>
              <span className="text-slate-400">Payment link expires:</span>{" "}
              <span className="font-medium text-slate-700">{formatHumanDate(expiryDate)}</span>
            </p>
          )}
        </div>
      </div>

      {/* From / Billed to */}
      <div className="px-5 md:px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/60 border-b border-slate-100">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">From</p>
          <p className="text-sm font-semibold text-slate-900">{senderName}</p>
          <p className="text-xs text-slate-500">via Rhemito</p>
        </div>
        <div className="sm:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Billed to</p>
          <p className="text-sm font-semibold text-slate-900" data-testid="generated-invoice-client">
            {clientName || "—"}
          </p>
          {clientType && (
            <p className="text-xs text-slate-500">{clientType === "business" ? "Business" : "Individual"}</p>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="px-5 md:px-6 py-2" data-testid="generated-invoice-items">
        <div className="hidden sm:grid grid-cols-[1fr_70px_110px_110px] gap-3 px-1 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-100">
          <span>Description</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Unit Price</span>
          <span className="text-right">Amount</span>
        </div>
        {items.map((item, index) => (
          <div
            key={`${item.name}-${index}`}
            className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_70px_110px_110px] gap-1 sm:gap-3 px-1 py-2.5 border-b border-slate-50 items-baseline"
            data-testid={`generated-invoice-item-${index}`}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">{item.name}</p>
              {item.description && (
                <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
              )}
              <p className="text-xs text-slate-400 mt-0.5 sm:hidden">
                {item.quantity} × {currencySymbol}{item.unitAmount.toFixed(2)}
              </p>
            </div>
            <span className="hidden sm:block text-right text-sm text-slate-600">{item.quantity}</span>
            <span className="hidden sm:block text-right text-sm text-slate-600">
              {currencySymbol}{item.unitAmount.toFixed(2)}
            </span>
            <span
              className="text-right text-sm font-semibold text-slate-900"
              data-testid={`generated-invoice-item-amount-${index}`}
            >
              {currencySymbol}
              {(Math.round(item.quantity * item.unitAmount * 100) / 100).toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="px-5 md:px-6 py-4 border-t border-slate-100">
        <div className="sm:ml-auto sm:max-w-xs space-y-1.5 text-sm" data-testid="generated-invoice-totals">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>
              {currencySymbol}{totals.subtotal.toFixed(2)} {currency}
            </span>
          </div>
          {totals.discountAmount > 0 && (
            <div className="flex justify-between text-teal-700" data-testid="generated-invoice-discount">
              <span>
                Discount{discountType === "percent" && discountValue ? ` (${discountValue}%)` : ""}
              </span>
              <span>
                -{currencySymbol}{totals.discountAmount.toFixed(2)} {currency}
              </span>
            </div>
          )}
          {totals.taxAmount > 0 && (
            <div className="flex justify-between text-slate-600" data-testid="generated-invoice-tax">
              <span>Tax{taxRate ? ` (${taxRate}%)` : ""}</span>
              <span>
                {currencySymbol}{totals.taxAmount.toFixed(2)} {currency}
              </span>
            </div>
          )}
          <div className="flex justify-between items-baseline pt-2 border-t border-slate-100">
            <span className="font-bold text-slate-900">Total</span>
            <span className="font-bold text-lg text-primary" data-testid="generated-invoice-total">
              {currencySymbol}{totals.total.toFixed(2)} {currency}
            </span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {notes && (
        <div className="px-5 md:px-6 py-4 border-t border-slate-100 bg-slate-50/60" data-testid="generated-invoice-notes">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Notes</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{notes}</p>
        </div>
      )}

      {showPrintAction && (
        <div className="px-5 md:px-6 py-3 border-t border-slate-100 flex justify-end print-invoice-actions">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="bg-white"
            data-testid="button-print-invoice"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print / Save as PDF
          </Button>
        </div>
      )}
    </div>
  );
}
