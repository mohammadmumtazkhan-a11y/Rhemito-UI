/**
 * Invoice API helpers — Send Invoice MVP1
 *
 * Thin wrappers over apiRequest plus the raw octet-stream document upload
 * (kept separate because the global fetch helper always sends JSON).
 */

import { apiRequest } from "@/lib/queryClient";
import type { InvoiceExpiry, InvoiceItem } from "@shared/schema";
import type { InvoiceTotals } from "@shared/invoice-logic";

export interface InvoiceFees {
  invoiceAmount: number;
  fee: number;
  senderReceives: number;
  clientPays: number;
}

export interface PayoutAccountSnapshot {
  bank: string;
  accountNumber: string;
  name: string;
  currency: string;
}

export type { InvoiceItem, InvoiceTotals };

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  amount: string;
  currency: string;
  absorbFee: boolean;
  payoutAccountBank: string;
  payoutAccountNumber: string;
  payoutAccountName: string;
  payoutAccountCurrency: string;
  paymentMethod: string | null;
  fees: InvoiceFees;
  dueDate: string | null;
  expiryDate: string;
  expiresAt: string;
  expiryTimezone: string;
  status: string;
  paymentRef: string | null;
  documentId: string | null;
  source: string; // "generated" | "uploaded"
  items: InvoiceItem[] | null;
  taxRate: string | null;
  discountType: string | null;
  discountValue: string | null;
  notes: string | null;
  totals: InvoiceTotals | null;
  sentAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  newLinkRequestedAt: string | null;
  newLinkRequestedBy: string | null;
}

export interface InvoiceEventJSON {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  actor: string | null;
  createdAt: string | null;
}

export interface InvoiceEmailJSON {
  id: string;
  type: string;
  toEmail: string;
  subject: string;
  attachmentFileName: string | null;
  status: string;
  attemptCount: number;
  lastAttemptAt: string | null;
  createdAt: string | null;
}

export interface InvoiceDetails extends InvoiceListItem {
  senderName: string;
  clientType: string;
  clientPhoneCode: string | null;
  clientPhoneNumber: string | null;
  expiredAt: string | null;
  cancelledBy: string | null;
  documentId: string | null;
  events: InvoiceEventJSON[];
  emails: InvoiceEmailJSON[];
}

export interface PublicInvoice {
  invoiceNumber: string;
  senderName: string;
  amount: string;
  currency: string;
  fees: InvoiceFees;
  hasDocument: boolean;
  clientType: "individual" | "business";
  clientFirstName: string | null;
  clientMiddleName: string | null;
  clientLastName: string | null;
  clientBusinessName: string | null;
  dueDate: string | null;
  expiryDate: string;
  expiryTimezone: string;
  status: string;
  paymentRef: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  newLinkRequestedAt: string | null;
  // Generated-invoice document rendered on the payment page
  source: string; // "generated" | "uploaded"
  items: InvoiceItem[] | null;
  taxRate: string | null;
  discountType: string | null;
  discountValue: string | null;
  notes: string | null;
  totals: InvoiceTotals | null;
}

interface ConfirmInvoiceBasePayload {
  currency: string;
  absorbFee: boolean;
  /** Server-owned verified account — raw bank details never come from the browser. */
  payoutAccountId: string;
  clientType: "individual" | "business";
  clientFirstName?: string;
  clientMiddleName?: string;
  clientLastName?: string;
  clientBusinessName?: string;
  clientEmail: string;
  clientPhoneCode?: string;
  clientPhoneNumber?: string;
  dueDate?: string;
  expiry: InvoiceExpiry;
  idempotencyKey: string;
}

/** Upload mode — attach a document, manual amount (the original MVP1 contract). */
export interface UploadInvoicePayload extends ConfirmInvoiceBasePayload {
  documentId: string;
  invoiceAmount: string;
}

/** Generate mode — line items; the server computes the total authoritatively. */
export interface GenerateInvoicePayload extends ConfirmInvoiceBasePayload {
  source: "generated";
  items: Array<{
    name: string;
    description?: string;
    quantity: number;
    unitAmount: number;
    discountType?: "percent" | "fixed";
    discountValue?: number;
  }>;
  taxRate?: number;
  discountType?: "percent" | "fixed";
  discountValue?: number;
  notes?: string;
}

export type ConfirmInvoicePayload = UploadInvoicePayload | GenerateInvoicePayload;

export interface CreateInvoiceResponse {
  data: {
    invoice: InvoiceListItem;
    paymentLink: string;
    alreadyExisted: boolean;
  };
}

export interface InvoiceListResponse {
  data: InvoiceListItem[];
  meta: { page: number; pageSize: number; total: number };
}

/** Temporary document upload — raw binary body so 10MB files clear the JSON limit. */
export async function uploadInvoiceDocument(file: File): Promise<string> {
  const res = await fetch(
    `/api/invoices/documents?fileName=${encodeURIComponent(file.name)}&mimeType=${encodeURIComponent(file.type)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: file,
      credentials: "include",
    },
  );
  if (!res.ok) {
    let message = "The document could not be uploaded. Please try again.";
    try {
      const json = await res.json();
      if (json?.error?.message) message = json.error.message;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }
  const json = (await res.json()) as { data: { documentId: string } };
  return json.data.documentId;
}

export async function confirmAndSendInvoice(
  payload: ConfirmInvoicePayload,
): Promise<CreateInvoiceResponse["data"]> {
  const res = await apiRequest("POST", "/api/invoices", payload);
  return ((await res.json()) as CreateInvoiceResponse).data;
}

export interface InvoiceListParams {
  search?: string;
  status?: string;
  sentFrom?: string;
  sentTo?: string;
  page?: number;
}

export function invoiceListUrl(params: InvoiceListParams): string {
  const q = new URLSearchParams();
  if (params.search) q.set("search", params.search);
  if (params.status && params.status !== "all") q.set("status", params.status);
  if (params.sentFrom) q.set("sentFrom", params.sentFrom);
  if (params.sentTo) q.set("sentTo", params.sentTo);
  if (params.page && params.page > 1) q.set("page", String(params.page));
  const qs = q.toString();
  return `/api/invoices${qs ? `?${qs}` : ""}`;
}

export class InvoiceActionError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function cancelInvoiceRequest(id: string, reason: string): Promise<InvoiceListItem> {
  const res = await fetch(`/api/invoices/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
    credentials: "include",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new InvoiceActionError(
      res.status,
      json?.error?.message ?? json?.message ?? "The invoice could not be cancelled.",
    );
  }
  return json.data as InvoiceListItem;
}

export async function resendInvoiceNotificationRequest(id: string): Promise<void> {
  await apiRequest("POST", `/api/invoices/${id}/resend-notification`, {});
}

export async function getPublicInvoice(token: string): Promise<PublicInvoice> {
  const res = await fetch(`/api/public/invoices/${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error(String(res.status));
  const json = (await res.json()) as { data: PublicInvoice };
  return json.data;
}

export function publicInvoiceDocumentUrl(token: string): string {
  return `/api/public/invoices/${encodeURIComponent(token)}/document`;
}

/** Payer identification: send a 6-digit PIN to an unregistered email (demo mode echoes devPin). */
export async function sendInvoiceClientPin(
  token: string,
  email: string
): Promise<{ sent: boolean; expiresInSeconds: number; resendAfterSeconds: number; devPin?: string }> {
  const res = await fetch(`/api/public/invoices/${encodeURIComponent(token)}/verification/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw Object.assign(new Error(json?.error?.message ?? "The PIN could not be sent."), {
      status: res.status,
      code: json?.error?.code,
    });
  }
  return json.data;
}

/** Payer identification: verify the 6-digit PIN for the email. */
export async function verifyInvoiceClientPin(token: string, email: string, code: string): Promise<void> {
  const res = await fetch(`/api/public/invoices/${encodeURIComponent(token)}/verification/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, code }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw Object.assign(new Error(json?.error?.message ?? "The PIN could not be verified."), {
      status: res.status,
      code: json?.error?.code,
    });
  }
}

export async function initiateInvoicePayment(
  token: string,
  method?: "card" | "bank_transfer",
): Promise<{ status: string; paymentRef: string }> {
  const res = await fetch(`/api/public/invoices/${encodeURIComponent(token)}/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error?.message ?? "The payment could not be started.");
  }
  return json.data as { status: string; paymentRef: string };
}

export async function requestNewPaymentLinkRequest(token: string): Promise<{ alreadyRequested: boolean }> {
  const res = await fetch(`/api/public/invoices/${encodeURIComponent(token)}/request-new-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error?.message ?? "The request could not be sent.");
  }
  return json.data as { alreadyRequested: boolean };
}
